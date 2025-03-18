import { useCallback, useRef, useMemo, useState, MutableRefObject } from 'react';
import { useStateWithHistory } from 'react-use/lib/useStateWithHistory';
import i18n from 'i18next';
import pMap from 'p-map';
import invariant from 'tiny-invariant';
import sortBy from 'lodash/sortBy';

import { detectSceneChanges as ffmpegDetectSceneChanges, readFrames, mapTimesToSegments, findKeyframeNearTime } from '../ffmpeg';
import { handleError, shuffleArray } from '../util';
import { errorToast } from '../swal';
import { showParametersDialog } from '../dialogs/parameters';
import { createNumSegments as createNumSegmentsDialog, createFixedByteSixedSegments as createFixedByteSixedSegmentsDialog, createRandomSegments as createRandomSegmentsDialog, labelSegmentDialog, askForShiftSegments, askForAlignSegments, selectSegmentsByLabelDialog, selectSegmentsByExprDialog, mutateSegmentsByExprDialog, askForSegmentDuration } from '../dialogs';
import { createSegment, sortSegments, invertSegments, combineOverlappingSegments as combineOverlappingSegments2, combineSelectedSegments as combineSelectedSegments2, isDurationValid, addSegmentColorIndex, filterNonMarkers, makeDurationSegments, isInitialSegment } from '../segments';
import { parameters as allFfmpegParameters, FfmpegDialog } from '../ffmpegParameters';
import { maxSegmentsAllowed } from '../util/constants';
import { DefiniteSegmentBase, ParseTimecode, SegmentBase, segmentTagsSchema, SegmentToExport, StateSegment, UpdateSegAtIndex } from '../types';
import safeishEval from '../worker/eval';
import { ScopeSegment } from '../../../../types';
import { FFprobeFormat, FFprobeStream } from '../../../../ffprobe';

const { ffmpeg: { blackDetect, silenceDetect } } = window.require('@electron/remote').require('./index.js');


function useSegments({ filePath, workingRef, setWorking, setProgress, videoStream, fileDuration, getRelevantTime, maxLabelLength, checkFileOpened, invertCutSegments, segmentsToChaptersOnly, timecodePlaceholder, parseTimecode, appendFfmpegCommandLog, fileDurationNonZero, mainFileMeta, seekAbs, activeVideoStreamIndex, activeAudioStreamIndexes }: {
  filePath?: string | undefined,
  workingRef: MutableRefObject<boolean>,
  setWorking: (w: { text: string, abortController?: AbortController } | undefined) => void,
  setProgress: (a: number | undefined) => void,
  videoStream: FFprobeStream | undefined,
  fileDuration?: number | undefined,
  getRelevantTime: () => number,
  maxLabelLength: number,
  checkFileOpened: () => boolean,
  invertCutSegments: boolean,
  segmentsToChaptersOnly: boolean,
  timecodePlaceholder: string,
  parseTimecode: ParseTimecode,
  appendFfmpegCommandLog: (args: string[]) => void,
  fileDurationNonZero: number,
  mainFileMeta: { formatData: FFprobeFormat } | undefined,
  seekAbs: (val: number | undefined) => void,
  activeVideoStreamIndex: number | undefined,
  activeAudioStreamIndexes: Set<number>,
}) {
  // Segment related state
  const segColorCounterRef = useRef(0);

  const createIndexedSegment = useCallback(({ segment, incrementCount }: {
    segment?: Parameters<typeof createSegment>[0],
    incrementCount?: boolean,
  } = {}) => {
    if (incrementCount) segColorCounterRef.current += 1;
    return addSegmentColorIndex(createSegment(segment), segColorCounterRef.current);
  }, []);

  const [cutSegments, setCutSegments, cutSegmentsHistory] = useStateWithHistory<StateSegment[], StateSegment[]>(
    [],
    100,
  );

  const [currentSegIndex, setCurrentSegIndex] = useState(0);

  const [ffmpegParameters, setFfmpegParameters] = useState(() => Object.fromEntries(Object.entries(allFfmpegParameters).map(([dialogType, parameters]) => ([
    dialogType,
    Object.fromEntries(Object.entries(parameters).map(([k2, v2]) => [k2, v2.value])),
  ] as const))));

  const setFfmpegParametersForDialog = useCallback((dialogType: FfmpegDialog, newParams: Record<string, string>) => setFfmpegParameters((existing) => ({
    ...existing,
    [dialogType]: {
      ...existing[dialogType],
      ...newParams,
    },
  })), []);


  const clearSegColorCounter = useCallback(() => {
    // eslint-disable-next-line no-param-reassign
    segColorCounterRef.current = 0;
  }, [segColorCounterRef]);

  const clampValue = useCallback((val: number | undefined) => {
    if (val == null || Number.isNaN(val)) return undefined;
    const clamped = Math.max(val, 0);
    if (fileDuration == null) return clamped;
    return Math.min(clamped, fileDuration);
  }, [fileDuration]);

  const safeSetCutSegments = useCallback((newSegmentsOrFn: StateSegment[] | ((a: StateSegment[]) => StateSegment[])) => {
    // delete "initial" after modifying segments
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const map = (newSegments: StateSegment[]) => newSegments.map(({ start, end, initial: _ignored, ...rest }) => ({
      ...rest,
      start: clampValue(start) ?? 0,
      end: clampValue(end),
    })).filter((segment) => segment.end == null || segment.end > segment.start);

    if (typeof newSegmentsOrFn === 'function') {
      setCutSegments((existing) => map(newSegmentsOrFn(existing)));
      return;
    }

    setCutSegments(map(newSegmentsOrFn));
  }, [clampValue, setCutSegments]);

  const clearSegments = useCallback(() => {
    clearSegColorCounter();
    safeSetCutSegments([]);
  }, [clearSegColorCounter, safeSetCutSegments]);

  const shuffleSegments = useCallback(() => safeSetCutSegments((existingSegments) => [
    ...existingSegments.filter((s) => !s.selected),
    ...shuffleArray(existingSegments.filter((s) => s.selected)),
  ]), [safeSetCutSegments]);

  // todo combine with safeSetCutSegments?
  const loadCutSegments = useCallback((edl: SegmentBase[], append: boolean) => {
    const validEdl = edl.filter((row) => (
      row.start >= 0
      && (row.end == null || row.start < row.end)
    ));

    if (validEdl.length === 0) throw new Error(i18n.t('No valid segments found'));

    if (validEdl.length > maxSegmentsAllowed) throw new Error(i18n.t('Tried to create too many segments (max {{maxSegmentsAllowed}}.)', { maxSegmentsAllowed }));

    if (!append) clearSegColorCounter();

    safeSetCutSegments((existingSegments) => {
      const needToAppend = append && !isInitialSegment(existingSegments);
      let newSegments = validEdl.map((segment, i) => createIndexedSegment({ segment, incrementCount: needToAppend || i > 0 }));
      if (needToAppend) newSegments = [...existingSegments, ...newSegments];
      return newSegments;
    });
  }, [clearSegColorCounter, createIndexedSegment, safeSetCutSegments]);

  const detectSegments = useCallback(async ({ name, workingText, errorText, fn }: {
    name: string,
    workingText: string,
    errorText: string,
    fn: (onSegmentDetected: (seg: SegmentBase) => void) => Promise<{ ffmpegArgs: string[] }>,
  }) => {
    if (!filePath) return;
    if (workingRef.current) return;
    try {
      setWorking({ text: workingText });
      setProgress(0);

      // todo throttle?
      const { ffmpegArgs } = await fn((detectedSegment) => {
        console.log('Detected', name, detectedSegment);
        loadCutSegments([detectedSegment], true);
        seekAbs(detectedSegment.start);
      });
      appendFfmpegCommandLog(ffmpegArgs);
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError')) handleError(errorText, err);
    } finally {
      setWorking(undefined);
      setProgress(undefined);
    }
  }, [filePath, workingRef, setWorking, setProgress, appendFfmpegCommandLog, loadCutSegments, seekAbs]);

  const getScopeSegment = useCallback((seg: Pick<StateSegment, 'name' | 'start' | 'end' | 'tags'>, index: number): ScopeSegment => {
    const { start, end, name, tags } = seg;
    // must clone tags because scope is mutable (editable by expression)
    return { index, label: name, start, end, duration: end != null ? end - start : 0, tags: { ...tags } };
  }, []);

  const haveInvalidSegs = useMemo(() => cutSegments.some((cutSegment) => cutSegment.end != null && cutSegment.start >= cutSegment.end), [cutSegments]);

  const currentSegIndexSafe = Math.min(currentSegIndex, cutSegments.length - 1);

  const currentCutSeg = useMemo(() => cutSegments[currentSegIndexSafe], [currentSegIndexSafe, cutSegments]);

  const currentCutSegOrWholeTimeline = useMemo(() => {
    const { start = 0, end = fileDurationNonZero } = currentCutSeg ?? {};
    return { start, end };
  }, [currentCutSeg, fileDurationNonZero]);

  const selectedSegments = useMemo(() => cutSegments.flatMap((segment, i) => (segment.selected ? [{ ...segment, originalIndex: i }] : [])), [cutSegments]);

  const getFfmpegParameters = useCallback((key: FfmpegDialog) => {
    const parameters = ffmpegParameters[key];
    invariant(parameters);
    return parameters;
  }, [ffmpegParameters]);

  const detectBlackScenes = useCallback(async () => {
    const { start, end } = currentCutSegOrWholeTimeline;
    const dialogType = 'blackdetect';
    const parameters = await showParametersDialog({ title: i18n.t('Enter parameters'), dialogType, parameters: getFfmpegParameters(dialogType), docUrl: 'https://ffmpeg.org/ffmpeg-filters.html#blackdetect' });
    if (parameters == null) return;
    const { mode, ...filterOptions } = parameters;
    setFfmpegParametersForDialog(dialogType, parameters);
    invariant(mode === '1' || mode === '2');
    invariant(filePath != null);
    await detectSegments({ name: 'blackScenes', workingText: i18n.t('Detecting black scenes'), errorText: i18n.t('Failed to detect black scenes'), fn: async (onSegmentDetected) => blackDetect({ filePath, streamId: activeVideoStreamIndex, filterOptions, boundingMode: mode === '1', onProgress: setProgress, onSegmentDetected, from: start, to: end }) });
  }, [currentCutSegOrWholeTimeline, getFfmpegParameters, setFfmpegParametersForDialog, filePath, detectSegments, activeVideoStreamIndex, setProgress]);

  const detectSilentScenes = useCallback(async () => {
    const { start, end } = currentCutSegOrWholeTimeline;
    const dialogType = 'silencedetect';
    const parameters = await showParametersDialog({ title: i18n.t('Enter parameters'), dialogType, parameters: getFfmpegParameters(dialogType), docUrl: 'https://ffmpeg.org/ffmpeg-filters.html#silencedetect' });
    if (parameters == null) return;
    setFfmpegParametersForDialog(dialogType, parameters);
    const { mode, ...filterOptions } = parameters;
    invariant(mode === '1' || mode === '2');
    invariant(filePath != null);
    await detectSegments({ name: 'silentScenes', workingText: i18n.t('Detecting silent scenes'), errorText: i18n.t('Failed to detect silent scenes'), fn: async (onSegmentDetected) => silenceDetect({ filePath, streamId: [...activeAudioStreamIndexes][0], filterOptions, boundingMode: mode === '1', onProgress: setProgress, onSegmentDetected, from: start, to: end }) });
  }, [activeAudioStreamIndexes, currentCutSegOrWholeTimeline, detectSegments, filePath, getFfmpegParameters, setFfmpegParametersForDialog, setProgress]);

  const detectSceneChanges = useCallback(async () => {
    const { start, end } = currentCutSegOrWholeTimeline;
    const dialogType = 'sceneChange';
    const parameters = await showParametersDialog({ title: i18n.t('Enter parameters'), dialogType, parameters: getFfmpegParameters(dialogType) });
    if (parameters == null) return;
    setFfmpegParametersForDialog(dialogType, parameters);
    invariant(filePath != null);
    // eslint-disable-next-line prefer-destructuring
    const minChange = parameters['minChange'];
    invariant(minChange != null);
    await detectSegments({ name: 'sceneChanges', workingText: i18n.t('Detecting scene changes'), errorText: i18n.t('Failed to detect scene changes'), fn: async (onSegmentDetected) => ffmpegDetectSceneChanges({ filePath, streamId: activeVideoStreamIndex, minChange, onProgress: setProgress, onSegmentDetected, from: start, to: end }) });
  }, [activeVideoStreamIndex, currentCutSegOrWholeTimeline, detectSegments, filePath, getFfmpegParameters, setFfmpegParametersForDialog, setProgress]);

  const createSegmentsFromKeyframes = useCallback(async () => {
    const { start, end } = currentCutSegOrWholeTimeline;
    if (!videoStream) return;
    invariant(filePath != null);
    const keyframes = (await readFrames({ filePath, from: start, to: end, streamIndex: videoStream.index })).filter((frame) => frame.keyframe);
    const newSegments = mapTimesToSegments(keyframes.map((keyframe) => keyframe.time), true);
    loadCutSegments(newSegments, true);
  }, [currentCutSegOrWholeTimeline, filePath, loadCutSegments, videoStream]);

  const removeSegments = useCallback((removeSegmentIds: string[]) => {
    safeSetCutSegments((existingSegments) => {
      const newSegments = existingSegments.filter((seg) => !removeSegmentIds.includes(seg.segId));
      if (newSegments.length === 0) {
        // when removing the last segments, we start over
        clearSegColorCounter();
      }
      return newSegments;
    });
  }, [clearSegColorCounter, safeSetCutSegments]);

  const removeSegment = useCallback((index: number, wholeSegment?: true) => {
    const seg = cutSegments[index];
    if (seg == null) return;
    if (wholeSegment || seg.end == null) {
      // remove whole segment
      removeSegments([seg.segId]);
    } else {
      // remove end cut point first
      safeSetCutSegments((existingSegments) => existingSegments.map((existingSegment, i) => (
        i === index ? {
          ...existingSegment,
          end: undefined,
        } : existingSegment)));
    }
  }, [cutSegments, removeSegments, safeSetCutSegments]);

  const inverseCutSegments = useMemo(() => {
    if (haveInvalidSegs || !isDurationValid(fileDuration)) return [];

    // exclude segments that don't have a length (markers)
    // also exclude initial segment (will cause problems later on)
    const sortedSegments = sortSegments(filterNonMarkers(cutSegments).filter((seg) => !seg.initial));

    return invertSegments(sortedSegments, true, true, fileDuration).map(({ segId, end, ...rest }) => {
      // in order to please TS:
      invariant(segId != null && end != null);
      return {
        segId,
        end,
        ...rest,
      };
    });
  }, [cutSegments, fileDuration, haveInvalidSegs]);

  const invertAllSegments = useCallback(() => {
    // todo leave non selected segments as is?
    // treat markers as 0 length
    const sortedSegments = sortSegments(selectedSegments.map(({ end, ...rest }) => ({ ...rest, end: end ?? rest.start })));

    const inverseSegmentsAndMarkers = invertSegments(sortedSegments, true, true, fileDuration);

    if (inverseSegmentsAndMarkers.length === 0) {
      errorToast(i18n.t('Make sure you have no overlapping segments.'));
      return;
    }
    // preserve segColorIndex (which represent colors) when inverting
    const newInverseCutSegments = inverseSegmentsAndMarkers.map((inverseSegment, index) => addSegmentColorIndex(createSegment(inverseSegment), index));
    safeSetCutSegments(newInverseCutSegments);
  }, [fileDuration, selectedSegments, safeSetCutSegments]);

  const fillSegmentsGaps = useCallback(() => {
    // treat markers as 0 length
    const sortedSegments = sortSegments(selectedSegments.map(({ end, ...rest }) => ({ ...rest, end: end ?? rest.start })));

    const inverseSegmentsAndMarkers = invertSegments(sortedSegments, true, true, fileDuration);

    if (inverseSegmentsAndMarkers.length === 0) {
      errorToast(i18n.t('Make sure you have no overlapping segments.'));
      return;
    }
    const newInverseCutSegments = inverseSegmentsAndMarkers.map((segment) => createIndexedSegment({ segment, incrementCount: true }));
    safeSetCutSegments((existing) => ([...existing, ...newInverseCutSegments]));
  }, [createIndexedSegment, fileDuration, selectedSegments, safeSetCutSegments]);

  const combineOverlappingSegments = useCallback(() => {
    safeSetCutSegments((existingSegments) => [
      ...existingSegments.filter((s) => !s.selected),
      ...combineOverlappingSegments2(existingSegments.filter((s) => s.selected)), // only process selected
    ]);
  }, [safeSetCutSegments]);

  const combineSelectedSegments = useCallback(() => {
    safeSetCutSegments((existingSegments) => combineSelectedSegments2(existingSegments));
  }, [safeSetCutSegments]);

  const updateSegAtIndex = useCallback<UpdateSegAtIndex>((index, newProps) => {
    if (index < 0) return;
    const cutSegmentsNew = [...cutSegments];
    const existing = cutSegments[index];
    if (existing == null) throw new Error();
    cutSegmentsNew.splice(index, 1, { ...existing, ...newProps });
    safeSetCutSegments(cutSegmentsNew);
  }, [safeSetCutSegments, cutSegments]);

  const setCutTime = useCallback((type: 'start' | 'end', time: number | undefined) => {
    if (!isDurationValid(fileDuration) || currentCutSeg == null) return;

    if (type === 'start') {
      invariant(time != null);
      if (currentCutSeg.end != null && time >= currentCutSeg.end) {
        throw new Error('Start time must precede end time');
      }
      updateSegAtIndex(currentSegIndexSafe, { start: Math.min(Math.max(time, 0), fileDuration) });
    }
    if (type === 'end') {
      if (time != null && time <= currentCutSeg.start) {
        throw new Error('Start time must precede end time');
      }
      updateSegAtIndex(currentSegIndexSafe, { end: time != null ? Math.min(Math.max(time, 0), fileDuration) : undefined });
    }
  }, [currentSegIndexSafe, currentCutSeg, fileDuration, updateSegAtIndex]);

  const modifySelectedSegmentTimes = useCallback(async (transformSegment: <T extends SegmentBase>(s: T) => Promise<T> | T, concurrency = 5) => {
    const newSegments = await pMap(cutSegments, async (segment) => {
      if (!segment.selected) return segment; // pass thru non-selected segments

      return transformSegment(segment);
    }, { concurrency });

    safeSetCutSegments(newSegments);
  }, [cutSegments, safeSetCutSegments]);

  const shiftAllSegmentTimes = useCallback(async () => {
    const shift = await askForShiftSegments({ inputPlaceholder: timecodePlaceholder, parseTimecode });
    if (shift == null) return;

    const { shiftAmount, shiftKeys } = shift;
    await modifySelectedSegmentTimes((segment) => {
      const newSegment = { ...segment };
      shiftKeys.forEach((key) => {
        if (newSegment[key] != null) newSegment[key] += shiftAmount;
      });
      return newSegment;
    });
  }, [modifySelectedSegmentTimes, parseTimecode, timecodePlaceholder]);

  const alignSegmentTimesToKeyframes = useCallback(async () => {
    if (!videoStream || workingRef.current) return;
    try {
      const response = await askForAlignSegments();
      if (response == null) return;
      setWorking({ text: i18n.t('Aligning segments to keyframes') });
      const { mode, startOrEnd } = response;
      await modifySelectedSegmentTimes(async (segment) => {
        const newSegment = { ...segment };

        const align = async (key: 'start' | 'end') => {
          const time = newSegment[key];
          invariant(filePath != null);
          if (time != null) {
            const keyframe = await findKeyframeNearTime({ filePath, streamIndex: videoStream.index, time, mode });
            if (keyframe == null) throw new Error(`Cannot find any keyframe within 60 seconds of frame ${time}`);
            newSegment[key] = keyframe;
          }
        };
        if (startOrEnd.includes('start')) await align('start');
        if (startOrEnd.includes('end')) await align('end');
        return newSegment;
      });
    } catch (err) {
      handleError(err);
    } finally {
      setWorking(undefined);
    }
  }, [filePath, videoStream, modifySelectedSegmentTimes, setWorking, workingRef]);

  const updateSegOrder = useCallback((index: number, newOrder: number) => {
    if (newOrder > cutSegments.length - 1 || newOrder < 0) return;
    const newSegments = [...cutSegments];
    const removedSeg = newSegments.splice(index, 1)[0];
    if (removedSeg == null) throw new Error();
    newSegments.splice(newOrder, 0, removedSeg);
    safeSetCutSegments(newSegments);
    setCurrentSegIndex(newOrder);
  }, [cutSegments, setCurrentSegIndex, safeSetCutSegments]);

  const updateSegOrders = useCallback((newOrders: string[]) => {
    const newSegments = sortBy(cutSegments, (seg) => newOrders.indexOf(seg.segId));
    safeSetCutSegments(newSegments);
    if (currentCutSeg != null) {
      const newCurrentSegIndex = newOrders.indexOf(currentCutSeg.segId);
      if (newCurrentSegIndex >= 0 && newCurrentSegIndex < newSegments.length) setCurrentSegIndex(newCurrentSegIndex);
    }
  }, [cutSegments, safeSetCutSegments, currentCutSeg, setCurrentSegIndex]);

  const reorderSegsByStartTime = useCallback(() => {
    safeSetCutSegments(sortBy(cutSegments, (seg) => seg.start));
  }, [cutSegments, safeSetCutSegments]);

  const addSegment = useCallback(() => {
    try {
      const suggestedStart = getRelevantTime();
      /* if (keyframeCut) {
        const keyframeAlignedStart = getSafeCutTime(suggestedStart, true);
        if (keyframeAlignedStart != null) suggestedStart = keyframeAlignedStart;
      } */

      if (fileDuration == null || suggestedStart >= fileDuration) return;

      const initial = isInitialSegment(cutSegments);

      const newSegment = createIndexedSegment({ segment: { start: suggestedStart }, incrementCount: !initial });

      // if initial segment, replace it instead
      const cutSegmentsNew = initial
        ? [
          newSegment,
        ] : [
          ...cutSegments,
          newSegment,
        ];

      safeSetCutSegments(cutSegmentsNew);
      setCurrentSegIndex(cutSegmentsNew.length - 1);
    } catch (err) {
      console.error(err);
    }
  }, [getRelevantTime, fileDuration, cutSegments, createIndexedSegment, safeSetCutSegments, setCurrentSegIndex]);

  const duplicateSegment = useCallback((segment: Pick<StateSegment, 'start' | 'end'> & Partial<Pick<StateSegment, 'name'>>) => {
    try {
      // Cannot duplicate if seg is not finished
      if (segment.start === undefined && segment.end === undefined) return;

      const cutSegmentsNew = [
        ...cutSegments,
        createIndexedSegment({ segment: { start: segment.start, end: segment.end, name: segment.name }, incrementCount: true }),
      ];

      safeSetCutSegments(cutSegmentsNew);
      setCurrentSegIndex(cutSegmentsNew.length - 1);
    } catch (err) {
      console.error(err);
    }
  }, [createIndexedSegment, cutSegments, safeSetCutSegments]);

  const duplicateCurrentSegment = useCallback(() => {
    if (currentCutSeg == null) return;
    duplicateSegment(currentCutSeg);
  }, [currentCutSeg, duplicateSegment]);

  const setCutStart = useCallback(() => {
    if (!checkFileOpened()) return;

    const relevantTime = getRelevantTime();
    // https://github.com/mifi/lossless-cut/issues/168
    // If current time is after the end of the current segment in the timeline, or there is no segment,
    // conveniently add a new segment that starts at playerTime
    if (currentCutSeg == null || (currentCutSeg.end != null && relevantTime >= currentCutSeg.end)) {
      addSegment();
    } else {
      try {
        const startTime = relevantTime;
        /* if (keyframeCut) {
          const keyframeAlignedCutTo = getSafeCutTime(startTime, true);
          if (keyframeAlignedCutTo != null) startTime = keyframeAlignedCutTo;
        } */
        setCutTime('start', startTime);
      } catch (err) {
        handleError(err);
      }
    }
  }, [checkFileOpened, getRelevantTime, currentCutSeg, addSegment, setCutTime]);

  const setCutEnd = useCallback(() => {
    if (!checkFileOpened()) return;

    try {
      const endTime = getRelevantTime();

      /* if (keyframeCut) {
        const keyframeAlignedCutTo = getSafeCutTime(endTime, false);
        if (keyframeAlignedCutTo != null) endTime = keyframeAlignedCutTo;
      } */
      setCutTime('end', endTime);
    } catch (err) {
      handleError(err);
    }
  }, [checkFileOpened, getRelevantTime, setCutTime]);

  const labelSegment = useCallback(async (index: number) => {
    const seg = cutSegments[index];
    if (seg == null) return;
    const { name } = seg;
    const value = await labelSegmentDialog({ currentName: name, maxLength: maxLabelLength });
    if (value != null) updateSegAtIndex(index, { name: value });
  }, [cutSegments, updateSegAtIndex, maxLabelLength]);

  const selectSegments = useCallback((segmentsToSelect: { segId: string }[]) => {
    const segIdsToSelect = new Set(segmentsToSelect.map(({ segId }) => segId));
    if (segIdsToSelect.size === 0) return; // no point in selecting none
    setCutSegments((existing) => existing.map(({ selected, ...segment }) => ({
      ...segment,
      selected: selected || segIdsToSelect.has(segment.segId),
    })));
  }, [setCutSegments]);

  const findSegmentsAtCursor = useCallback((currentTime: number) => (
    cutSegments.flatMap((segment, index) => {
      if (
        (segment.start <= currentTime)
        && (segment.end != null && segment.end >= currentTime)
      ) {
        return [index];
      }
      return [];
    }).reverse() // reverse, so that if we are on multiple, we select the last first. That way, auto play selected segments won't go on repeat on the same segment
  ), [cutSegments]);

  const focusSegmentAtCursor = useCallback(() => {
    const relevantTime = getRelevantTime();
    const [firstSegmentAtCursorIndex] = findSegmentsAtCursor(relevantTime);
    if (firstSegmentAtCursorIndex == null) return;
    setCurrentSegIndex(firstSegmentAtCursorIndex);
  }, [findSegmentsAtCursor, getRelevantTime]);

  const selectSegmentsAtCursor = useCallback(() => {
    const relevantTime = getRelevantTime();
    selectSegments(findSegmentsAtCursor(relevantTime).flatMap((index) => (cutSegments[index] ? [cutSegments[index]] : [])));
  }, [cutSegments, findSegmentsAtCursor, getRelevantTime, selectSegments]);

  const splitCurrentSegment = useCallback(() => {
    const relevantTime = getRelevantTime();
    const segmentsAtCursorIndexes = findSegmentsAtCursor(relevantTime);

    const firstSegmentAtCursorIndex = segmentsAtCursorIndexes[0];

    if (firstSegmentAtCursorIndex == null) {
      errorToast(i18n.t('No segment to split. Please move cursor over the segment you want to split'));
      return;
    }

    const segment = cutSegments[firstSegmentAtCursorIndex];
    invariant(segment != null);

    const getNewName = (oldName: string, suffix: string) => oldName && `${segment.name} ${suffix}`;

    if (segment.start === relevantTime || segment.end === relevantTime) return; // No point

    const firstPart = createIndexedSegment({ segment: { name: getNewName(segment.name, '1'), start: segment.start, end: relevantTime }, incrementCount: false });
    const secondPart = createIndexedSegment({ segment: { name: getNewName(segment.name, '2'), start: relevantTime, end: segment.end }, incrementCount: true });

    const newSegments = [...cutSegments];
    newSegments.splice(firstSegmentAtCursorIndex, 1, firstPart, secondPart);
    safeSetCutSegments(newSegments);
  }, [createIndexedSegment, cutSegments, findSegmentsAtCursor, getRelevantTime, safeSetCutSegments]);

  const createNumSegments = useCallback(async () => {
    if (!checkFileOpened() || !isDurationValid(fileDuration)) return;
    const segments = await createNumSegmentsDialog(fileDuration);
    if (segments) loadCutSegments(segments, true);
  }, [checkFileOpened, fileDuration, loadCutSegments]);

  const createFixedDurationSegments = useCallback(async () => {
    if (!checkFileOpened() || !isDurationValid(fileDuration)) return;
    const segmentDuration = await askForSegmentDuration({ fileDuration, inputPlaceholder: timecodePlaceholder, parseTimecode });
    if (segmentDuration == null) return;
    loadCutSegments(makeDurationSegments(segmentDuration, fileDuration), true);
  }, [checkFileOpened, fileDuration, loadCutSegments, parseTimecode, timecodePlaceholder]);

  const createFixedByteSizedSegments = useCallback(async () => {
    if (!checkFileOpened() || !isDurationValid(fileDuration)) return;
    const fileSize = mainFileMeta && parseInt(mainFileMeta.formatData.size, 10);
    invariant(fileSize != null && !Number.isNaN(fileSize));
    const segmentDuration = await createFixedByteSixedSegmentsDialog({ fileDuration, fileSize });
    if (segmentDuration == null) return;
    loadCutSegments(makeDurationSegments(segmentDuration, fileDuration), true);
  }, [checkFileOpened, fileDuration, loadCutSegments, mainFileMeta]);

  const createRandomSegments = useCallback(async () => {
    if (!checkFileOpened() || !isDurationValid(fileDuration)) return;
    const segments = await createRandomSegmentsDialog(fileDuration);
    if (segments) loadCutSegments(segments, true);
  }, [checkFileOpened, fileDuration, loadCutSegments]);

  const selectSegmentsByLabel = useCallback(async () => {
    const value = await selectSegmentsByLabelDialog(currentCutSeg?.name);
    if (value == null) return;
    selectSegments(cutSegments.filter((seg) => seg.name === value));
  }, [currentCutSeg?.name, cutSegments, selectSegments]);

  const selectAllMarkers = useCallback(() => {
    selectSegments(cutSegments.filter((seg) => seg.end == null));
  }, [cutSegments, selectSegments]);

  const selectSegmentsByExpr = useCallback(async () => {
    const matchSegment = async (seg: StateSegment, index: number, expr: string) => (
      (await safeishEval(expr, { segment: getScopeSegment(seg, index) })) === true
    );

    const getSegmentsToSelect = async (expr: string) => (
      await pMap(cutSegments, async (seg, index) => (
        ((await matchSegment(seg, index, expr)) ? [seg] : [])
      ), { concurrency: 5 })).flat();

    const value = await selectSegmentsByExprDialog(async (v: string) => {
      try {
        if (v.trim().length === 0) return i18n.t('Please enter a JavaScript expression.');
        const segments = await getSegmentsToSelect(v);
        if (segments.length === 0) return i18n.t('No segments match this expression.');
        if (segments.length === cutSegments.length) return i18n.t('All segments match this expression.');
        return undefined;
      } catch (err) {
        if (err instanceof Error) {
          return i18n.t('Expression failed: {{errorMessage}}', { errorMessage: err.message });
        }
        throw err;
      }
    });

    if (value == null) return;
    const segmentsToSelect = await getSegmentsToSelect(value);
    selectSegments(segmentsToSelect);
  }, [cutSegments, selectSegments, getScopeSegment]);

  const mutateSegmentsByExpr = useCallback(async () => {
    async function mutateSegment(seg: StateSegment, index: number, expr: string) {
      const response = (await safeishEval(expr, { segment: getScopeSegment(seg, index) }));
      invariant(typeof response === 'object' && response != null, i18n.t('The expression must return an object'));
      const ret: Partial<Pick<StateSegment, 'name' | 'start' | 'end' | 'tags'>> = {};
      if ('label' in response) {
        if (typeof response.label !== 'string') throw new Error(i18n.t('"{{property}}" must be a string', { property: 'label' }));
        ret.name = response.label;
      }
      if ('start' in response) {
        if (typeof response.start !== 'number') throw new Error(i18n.t('"{{property}}" must be a number', { property: 'start' }));
        ret.start = response.start;
      }
      if ('end' in response) {
        if (!(typeof response.end === 'number' || response.end === undefined)) throw new Error(i18n.t('"{{property}}" must be a number', { property: 'end' }));
        ret.end = response.end;
      }
      if ('tags' in response) {
        const tags = segmentTagsSchema.safeParse(response.tags);
        if (!tags.success) throw new Error(i18n.t('"{{property}}" must be an object of strings', { property: 'tags' }));
        ret.tags = tags.data;
      }
      return ret;
    }

    const mutateSegments = async (expr: string) => (await pMap(cutSegments, async (seg, index) => ({
      ...seg,
      ...(seg.selected && await mutateSegment(seg, index, expr)),
    }), { concurrency: 5 })).flat();

    const value = await mutateSegmentsByExprDialog(async (v: string) => {
      try {
        if (v.trim().length === 0) return i18n.t('Please enter a JavaScript expression.');
        await mutateSegments(v);
        return undefined;
      } catch (err) {
        if (err instanceof Error) {
          return i18n.t('Expression failed: {{errorMessage}}', { errorMessage: err.message });
        }
        throw err;
      }
    });

    if (value == null) return;
    safeSetCutSegments(await mutateSegments(value));
  }, [cutSegments, getScopeSegment, safeSetCutSegments]);

  const labelSelectedSegments = useCallback(async () => {
    const firstSelectedSegment = selectedSegments[0];
    if (firstSelectedSegment == null) return;
    const { name } = firstSelectedSegment;
    const value = await labelSegmentDialog({ currentName: name, maxLength: maxLabelLength });
    if (value == null) return;
    safeSetCutSegments((existingSegments) => existingSegments.map((existingSegment) => {
      if (!existingSegment.selected) return existingSegment;
      return { ...existingSegment, name: value };
    }));
  }, [maxLabelLength, selectedSegments, safeSetCutSegments]);

  const maybeCreateFullLengthSegment = useCallback((newFileDuration: number) => {
    // don't use safeSetCutSegments because we want to set initial: true
    setCutSegments((existing) => {
      if (existing.length > 0 || newFileDuration <= 0) return existing;
      const segment = { start: 0, end: newFileDuration, initial: true } as const;
      console.log('Creating initial segment', segment);
      return [createIndexedSegment({ segment })];
    });
  }, [createIndexedSegment, setCutSegments]);

  const segmentsOrInverse = useMemo<{ selected: SegmentToExport[], all: DefiniteSegmentBase[] }>(() => {
    // For invertCutSegments we do not support filtering (selecting) segments
    if (invertCutSegments) {
      return {
        selected: inverseCutSegments.map((seg, i) => ({ ...seg, originalIndex: i })),
        all: inverseCutSegments,
      };
    }

    const nonMarkers = filterNonMarkers(selectedSegments);

    // If user has selected no segments, default to all instead.
    const selectedSegmentsWithFallback = nonMarkers.length > 0 ? nonMarkers : filterNonMarkers(cutSegments).map((seg, i) => ({ ...seg, originalIndex: i }));

    return {
      // exclude markers (segments without any end)
      // and exclude the initial segment, to prevent cutting when not really needed (if duration changes after the segment was created)
      selected: selectedSegmentsWithFallback.filter((seg) => !seg.initial),

      // `all` includes also all non selected segments:
      all: filterNonMarkers(cutSegments).filter((seg) => !seg.initial),
    };
  }, [cutSegments, inverseCutSegments, invertCutSegments, selectedSegments]);

  const segmentsToExport = useMemo<SegmentToExport[]>(() => {
    // 'segmentsToChaptersOnly' is a special mode where all segments will be simply written out as chapters to one file: https://github.com/mifi/lossless-cut/issues/993#issuecomment-1037927595
    // Chapters export mode: Emulate no cuts (full timeline)
    if (segmentsToChaptersOnly) return [];
    // in other modes, return all selected segments
    return segmentsOrInverse.selected;
  }, [segmentsOrInverse.selected, segmentsToChaptersOnly]);

  const removeSelectedSegments = useCallback(() => removeSegments(selectedSegments.map((seg) => seg.segId)), [removeSegments, selectedSegments]);

  const selectOnlySegment = useCallback((seg: Pick<StateSegment, 'segId'>) => setCutSegments((existing) => existing.map((segment) => ({
    ...segment, selected: segment.segId === seg.segId,
  }))), [setCutSegments]);

  const toggleSegmentSelected = useCallback((seg: Pick<StateSegment, 'segId'>) => setCutSegments((existing) => existing.map((segment) => {
    if (segment.segId !== seg.segId) return segment;
    return { ...segment, selected: !segment.selected };
  })), [setCutSegments]);

  const deselectAllSegments = useCallback(() => setCutSegments((existing) => existing.map((segment) => ({ ...segment, selected: false }))), [setCutSegments]);
  const selectAllSegments = useCallback(() => setCutSegments((existing) => existing.map((segment) => ({ ...segment, selected: true }))), [setCutSegments]);
  const invertSelectedSegments = useCallback(() => setCutSegments((existing) => existing.map((segment) => ({ ...segment, selected: !segment.selected }))), [setCutSegments]);

  const selectOnlyCurrentSegment = useCallback(() => {
    if (currentCutSeg == null) return;
    selectOnlySegment(currentCutSeg);
  }, [currentCutSeg, selectOnlySegment]);

  const toggleCurrentSegmentSelected = useCallback(() => {
    if (currentCutSeg == null) return;
    toggleSegmentSelected(currentCutSeg);
  }, [currentCutSeg, toggleSegmentSelected]);

  return {
    cutSegments,
    cutSegmentsHistory,
    createSegmentsFromKeyframes,
    shuffleSegments,
    detectBlackScenes,
    detectSilentScenes,
    detectSceneChanges,
    removeSegment,
    invertAllSegments,
    fillSegmentsGaps,
    combineOverlappingSegments,
    combineSelectedSegments,
    shiftAllSegmentTimes,
    alignSegmentTimesToKeyframes,
    updateSegOrder,
    updateSegOrders,
    reorderSegsByStartTime,
    addSegment,
    duplicateCurrentSegment,
    duplicateSegment,
    setCutStart,
    setCutEnd,
    labelSegment,
    splitCurrentSegment,
    focusSegmentAtCursor,
    selectSegmentsAtCursor,
    createNumSegments,
    createFixedDurationSegments,
    createFixedByteSizedSegments,
    createRandomSegments,
    haveInvalidSegs,
    currentSegIndexSafe,
    currentCutSeg,
    inverseCutSegments,
    clearSegments,
    clearSegColorCounter,
    loadCutSegments,
    selectedSegments,
    segmentsOrInverse,
    segmentsToExport,
    maybeCreateFullLengthSegment,

    setCurrentSegIndex,

    labelSelectedSegments,
    deselectAllSegments,
    selectAllSegments,
    selectOnlyCurrentSegment,
    toggleCurrentSegmentSelected,
    invertSelectedSegments,
    removeSelectedSegments,
    selectSegmentsByLabel,
    selectSegmentsByExpr,
    selectAllMarkers,
    mutateSegmentsByExpr,
    toggleSegmentSelected,
    selectOnlySegment,
    setCutTime,
    updateSegAtIndex,
    findSegmentsAtCursor,
  };
}

export type UseSegments = ReturnType<typeof useSegments>;

export default useSegments;
