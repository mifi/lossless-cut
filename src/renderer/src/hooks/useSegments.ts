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
import { ParseTimecode, SegmentBase, segmentTagsSchema, SegmentToExport, StateSegment, UpdateSegAtIndex } from '../types';
import safeishEval from '../worker/eval';
import { ScopeSegment } from '../../../../types';
import { FFprobeFormat, FFprobeStream } from '../../../../ffprobe';

const { ffmpeg: { blackDetect, silenceDetect } } = window.require('@electron/remote').require('./index.js');


function useSegments({ filePath, workingRef, setWorking, setProgress, videoStream, duration, getRelevantTime, maxLabelLength, checkFileOpened, invertCutSegments, segmentsToChaptersOnly, timecodePlaceholder, parseTimecode, appendFfmpegCommandLog, durationSafe, mainFileMeta }: {
  filePath?: string | undefined,
  workingRef: MutableRefObject<boolean>,
  setWorking: (w: { text: string, abortController?: AbortController } | undefined) => void,
  setProgress: (a: number | undefined) => void,
  videoStream: FFprobeStream | undefined,
  duration?: number | undefined,
  getRelevantTime: () => number,
  maxLabelLength: number,
  checkFileOpened: () => boolean,
  invertCutSegments: boolean,
  segmentsToChaptersOnly: boolean,
  timecodePlaceholder: string,
  parseTimecode: ParseTimecode,
  appendFfmpegCommandLog: (args: string[]) => void,
  durationSafe: number,
  mainFileMeta: { formatData: FFprobeFormat } | undefined,
}) {
  // Segment related state
  const segCounterRef = useRef(0);

  const createIndexedSegment = useCallback(({ segment, incrementCount }: { segment?: Parameters<typeof createSegment>[0], incrementCount?: boolean } = {}) => {
    if (incrementCount) segCounterRef.current += 1;
    const ret = addSegmentColorIndex(createSegment(segment), segCounterRef.current);
    return ret;
  }, []);

  const createInitialCutSegments = useCallback(() => [createIndexedSegment()], [createIndexedSegment]);

  const [cutSegments, setCutSegments, cutSegmentsHistory] = useStateWithHistory(
    createInitialCutSegments(),
    100,
  );

  const [currentSegIndex, setCurrentSegIndex] = useState(0);
  const [deselectedSegmentIds, setDeselectedSegmentIds] = useState<Record<string, boolean>>({});

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

  const isSegmentSelected = useCallback(({ segId }: { segId: string }) => !deselectedSegmentIds[segId], [deselectedSegmentIds]);


  const clearSegCounter = useCallback(() => {
    // eslint-disable-next-line no-param-reassign
    segCounterRef.current = 0;
  }, [segCounterRef]);

  const clearSegments = useCallback(() => {
    clearSegCounter();
    setCutSegments(createInitialCutSegments());
  }, [clearSegCounter, createInitialCutSegments, setCutSegments]);

  const shuffleSegments = useCallback(() => setCutSegments((oldSegments) => shuffleArray(oldSegments)), [setCutSegments]);

  // todo combine with safeSetCutSegments?
  const loadCutSegments = useCallback((edl: SegmentBase[], append: boolean | undefined = false) => {
    const validEdl = edl.filter((row) => (
      row.start >= 0
      && (row.end == null || row.start < row.end)
    ));

    if (validEdl.length === 0) throw new Error(i18n.t('No valid segments found'));

    if (!append) clearSegCounter();

    if (validEdl.length > maxSegmentsAllowed) throw new Error(i18n.t('Tried to create too many segments (max {{maxSegmentsAllowed}}.)', { maxSegmentsAllowed }));

    setCutSegments((existingSegments) => {
      const needToAppend = append && !(existingSegments.length === 1 && isInitialSegment(existingSegments[0]!));
      let newSegments = validEdl.map((segment, i) => createIndexedSegment({ segment, incrementCount: needToAppend || i > 0 }));
      if (needToAppend) newSegments = [...existingSegments, ...newSegments];
      return newSegments;
    });
  }, [clearSegCounter, createIndexedSegment, setCutSegments]);

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
      });
      appendFfmpegCommandLog(ffmpegArgs);
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError')) handleError(errorText, err);
    } finally {
      setWorking(undefined);
      setProgress(undefined);
    }
  }, [filePath, workingRef, setWorking, setProgress, appendFfmpegCommandLog, loadCutSegments]);

  const getScopeSegment = useCallback((seg: Pick<StateSegment, 'name' | 'start' | 'end' | 'tags'>, index: number): ScopeSegment => {
    const { start, end, name, tags } = seg;
    // must clone tags because scope is mutable (editable by expression)
    return { index, label: name, start, end, duration: end != null ? end - start : 0, tags: { ...tags } };
  }, []);

  const haveInvalidSegs = useMemo(() => cutSegments.some((cutSegment) => cutSegment.end != null && cutSegment.start >= cutSegment.end), [cutSegments]);

  const currentSegIndexSafe = Math.min(currentSegIndex, cutSegments.length - 1);
  const currentCutSeg = useMemo(() => {
    const ret = cutSegments[currentSegIndexSafe];
    invariant(ret != null, 'currentCutSeg was nullish, this shouldn\'t happen');
    return ret;
  }, [currentSegIndexSafe, cutSegments]);

  const selectedSegmentsRaw = useMemo(() => cutSegments.filter((segment) => isSegmentSelected(segment)), [cutSegments, isSegmentSelected]);

  const getFfmpegParameters = useCallback((key: FfmpegDialog) => {
    const parameters = ffmpegParameters[key];
    invariant(parameters);
    return parameters;
  }, [ffmpegParameters]);

  const detectBlackScenes = useCallback(async () => {
    const { start, end = durationSafe } = currentCutSeg;
    const dialogType = 'blackdetect';
    const parameters = await showParametersDialog({ title: i18n.t('Enter parameters'), dialogType, parameters: getFfmpegParameters(dialogType), docUrl: 'https://ffmpeg.org/ffmpeg-filters.html#blackdetect' });
    if (parameters == null) return;
    const { mode, ...filterOptions } = parameters;
    setFfmpegParametersForDialog(dialogType, parameters);
    invariant(mode === '1' || mode === '2');
    invariant(filePath != null);
    await detectSegments({ name: 'blackScenes', workingText: i18n.t('Detecting black scenes'), errorText: i18n.t('Failed to detect black scenes'), fn: async (onSegmentDetected) => blackDetect({ filePath, filterOptions, boundingMode: mode === '1', onProgress: setProgress, onSegmentDetected, from: start, to: end }) });
  }, [durationSafe, currentCutSeg, getFfmpegParameters, setFfmpegParametersForDialog, filePath, detectSegments, setProgress]);

  const detectSilentScenes = useCallback(async () => {
    const { start, end = durationSafe } = currentCutSeg;
    const dialogType = 'silencedetect';
    const parameters = await showParametersDialog({ title: i18n.t('Enter parameters'), dialogType, parameters: getFfmpegParameters(dialogType), docUrl: 'https://ffmpeg.org/ffmpeg-filters.html#silencedetect' });
    if (parameters == null) return;
    setFfmpegParametersForDialog(dialogType, parameters);
    const { mode, ...filterOptions } = parameters;
    invariant(mode === '1' || mode === '2');
    invariant(filePath != null);
    await detectSegments({ name: 'silentScenes', workingText: i18n.t('Detecting silent scenes'), errorText: i18n.t('Failed to detect silent scenes'), fn: async (onSegmentDetected) => silenceDetect({ filePath, filterOptions, boundingMode: mode === '1', onProgress: setProgress, onSegmentDetected, from: start, to: end }) });
  }, [currentCutSeg, detectSegments, durationSafe, filePath, getFfmpegParameters, setFfmpegParametersForDialog, setProgress]);

  const detectSceneChanges = useCallback(async () => {
    const { start, end = durationSafe } = currentCutSeg;
    const dialogType = 'sceneChange';
    const parameters = await showParametersDialog({ title: i18n.t('Enter parameters'), dialogType, parameters: getFfmpegParameters(dialogType) });
    if (parameters == null) return;
    setFfmpegParametersForDialog(dialogType, parameters);
    invariant(filePath != null);
    // eslint-disable-next-line prefer-destructuring
    const minChange = parameters['minChange'];
    invariant(minChange != null);
    await detectSegments({ name: 'sceneChanges', workingText: i18n.t('Detecting scene changes'), errorText: i18n.t('Failed to detect scene changes'), fn: async (onSegmentDetected) => ffmpegDetectSceneChanges({ filePath, minChange, onProgress: setProgress, onSegmentDetected, from: start, to: end }) });
  }, [currentCutSeg, detectSegments, durationSafe, filePath, getFfmpegParameters, setFfmpegParametersForDialog, setProgress]);

  const createSegmentsFromKeyframes = useCallback(async () => {
    const { start, end = durationSafe } = currentCutSeg;
    if (!videoStream) return;
    invariant(filePath != null);
    const keyframes = (await readFrames({ filePath, from: start, to: end, streamIndex: videoStream.index })).filter((frame) => frame.keyframe);
    const newSegments = mapTimesToSegments(keyframes.map((keyframe) => keyframe.time), true);
    loadCutSegments(newSegments, true);
  }, [currentCutSeg, durationSafe, filePath, loadCutSegments, videoStream]);

  const removeSegments = useCallback((removeSegmentIds: string[]) => {
    setCutSegments((existingSegments) => {
      if (existingSegments.length === 1 && isInitialSegment(existingSegments[0]!)) {
        return existingSegments; // We are at initial segment, nothing more we can do (it cannot be removed)
      }

      const newSegments = existingSegments.filter((seg) => !removeSegmentIds.includes(seg.segId));
      if (newSegments.length === 0) {
        // when removing the last segments, we start over
        clearSegCounter();
        return createInitialCutSegments();
      }
      return newSegments;
    });
  }, [clearSegCounter, createInitialCutSegments, setCutSegments]);

  const removeCutSegment = useCallback((index: number) => {
    removeSegments([cutSegments[index]!.segId]);
  }, [cutSegments, removeSegments]);

  const inverseCutSegments = useMemo(() => {
    if (haveInvalidSegs || !isDurationValid(duration)) return [];

    // exclude segments that don't have a length (markers)
    const sortedSegments = sortSegments(filterNonMarkers(cutSegments));

    return invertSegments(sortedSegments, true, true, duration).map(({ segId, end, ...rest }) => {
      // in order to please TS:
      invariant(segId != null && end != null);
      return {
        segId,
        end,
        ...rest,
      };
    });
  }, [cutSegments, duration, haveInvalidSegs]);

  // Guaranteed to have at least one segment (if user has selected none to export (selectedSegments empty), it makes no sense so select all instead.)
  const selectedSegments = useMemo(() => (selectedSegmentsRaw.length > 0 ? selectedSegmentsRaw : cutSegments), [cutSegments, selectedSegmentsRaw]);

  const invertAllSegments = useCallback(() => {
    // treat markers as 0 length
    const sortedSegments = sortSegments(selectedSegments.map(({ end, ...rest }) => ({ ...rest, end: end ?? rest.start })));

    const inverseSegmentsAndMarkers = invertSegments(sortedSegments, true, true, duration);

    if (inverseSegmentsAndMarkers.length === 0) {
      errorToast(i18n.t('Make sure you have no overlapping segments.'));
      return;
    }
    // preserve segColorIndex (which represent colors) when inverting
    const newInverseCutSegments = inverseSegmentsAndMarkers.map((inverseSegment, index) => addSegmentColorIndex(createSegment(inverseSegment), index));
    setCutSegments(newInverseCutSegments);
  }, [duration, selectedSegments, setCutSegments]);

  const fillSegmentsGaps = useCallback(() => {
    // treat markers as 0 length
    const sortedSegments = sortSegments(selectedSegments.map(({ end, ...rest }) => ({ ...rest, end: end ?? rest.start })));

    const inverseSegmentsAndMarkers = invertSegments(sortedSegments, true, true, duration);

    if (inverseSegmentsAndMarkers.length === 0) {
      errorToast(i18n.t('Make sure you have no overlapping segments.'));
      return;
    }
    const newInverseCutSegments = inverseSegmentsAndMarkers.map((segment) => createIndexedSegment({ segment, incrementCount: true }));
    setCutSegments((existing) => ([...existing, ...newInverseCutSegments]));
  }, [createIndexedSegment, duration, selectedSegments, setCutSegments]);

  const combineOverlappingSegments = useCallback(() => {
    setCutSegments((existingSegments) => combineOverlappingSegments2(existingSegments));
  }, [setCutSegments]);

  const combineSelectedSegments = useCallback(() => {
    setCutSegments((existingSegments) => combineSelectedSegments2({ existingSegments, isSegmentSelected }));
  }, [isSegmentSelected, setCutSegments]);

  const updateSegAtIndex = useCallback<UpdateSegAtIndex>((index, newProps) => {
    if (index < 0) return;
    const cutSegmentsNew = [...cutSegments];
    const existing = cutSegments[index];
    if (existing == null) throw new Error();
    cutSegmentsNew.splice(index, 1, { ...existing, ...newProps });
    setCutSegments(cutSegmentsNew);
  }, [setCutSegments, cutSegments]);

  const setCutTime = useCallback((type: 'start' | 'end', time: number | undefined) => {
    if (!isDurationValid(duration)) return;

    if (type === 'start') {
      invariant(time != null);
      if (currentCutSeg.end != null && time >= currentCutSeg.end) {
        throw new Error('Start time must precede end time');
      }
      updateSegAtIndex(currentSegIndexSafe, { start: Math.min(Math.max(time, 0), duration) });
    }
    if (type === 'end') {
      if (time != null && time <= currentCutSeg.start) {
        throw new Error('Start time must precede end time');
      }
      updateSegAtIndex(currentSegIndexSafe, { end: time != null ? Math.min(Math.max(time, 0), duration) : undefined });
    }
  }, [currentSegIndexSafe, currentCutSeg, duration, updateSegAtIndex]);

  const clampValue = useCallback((val: number | undefined) => {
    if (val == null || Number.isNaN(val)) return undefined;
    const clamped = Math.max(val, 0);
    if (duration == null) return clamped;
    return Math.min(clamped, duration);
  }, [duration]);

  const safeSetCutSegments = useCallback((newSegments: StateSegment[]) => {
    const safeNewSegments = newSegments.map(({ start, end, ...rest }) => ({
      ...rest,
      start: clampValue(start) ?? 0,
      end: clampValue(end),
    })).filter((segment) => segment.end == null || segment.end > segment.start);

    setCutSegments(safeNewSegments.length > 0 ? safeNewSegments : createInitialCutSegments());
  }, [clampValue, createInitialCutSegments, setCutSegments]);

  const modifySelectedSegmentTimes = useCallback(async (transformSegment: <T extends SegmentBase>(s: T) => Promise<T> | T, concurrency = 5) => {
    const newSegments = await pMap(cutSegments, async (segment) => {
      if (!isSegmentSelected(segment)) return segment; // pass thru non-selected segments

      return transformSegment(segment);
    }, { concurrency });

    safeSetCutSegments(newSegments);
  }, [cutSegments, isSegmentSelected, safeSetCutSegments]);

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
    setCutSegments(newSegments);
    setCurrentSegIndex(newOrder);
  }, [cutSegments, setCurrentSegIndex, setCutSegments]);

  const updateSegOrders = useCallback((newOrders: string[]) => {
    const newSegments = sortBy(cutSegments, (seg) => newOrders.indexOf(seg.segId));
    const newCurrentSegIndex = newOrders.indexOf(currentCutSeg.segId);
    setCutSegments(newSegments);
    if (newCurrentSegIndex >= 0 && newCurrentSegIndex < newSegments.length) setCurrentSegIndex(newCurrentSegIndex);
  }, [cutSegments, setCutSegments, currentCutSeg, setCurrentSegIndex]);

  const reorderSegsByStartTime = useCallback(() => {
    setCutSegments(sortBy(cutSegments, (seg) => seg.start));
  }, [cutSegments, setCutSegments]);

  const addSegment = useCallback(() => {
    try {
      const suggestedStart = getRelevantTime();
      /* if (keyframeCut) {
        const keyframeAlignedStart = getSafeCutTime(suggestedStart, true);
        if (keyframeAlignedStart != null) suggestedStart = keyframeAlignedStart;
      } */

      if (duration == null || suggestedStart >= duration) return;

      const newSegment = createIndexedSegment({ segment: { start: suggestedStart }, incrementCount: true });

      // if initial segment, replace it instead
      const cutSegmentsNew = cutSegments.length === 1 && cutSegments[0]!.start === undefined && cutSegments[0]!.end === undefined
        ? [
          newSegment,
        ] : [
          ...cutSegments,
          newSegment,
        ];

      setCutSegments(cutSegmentsNew);
      setCurrentSegIndex(cutSegmentsNew.length - 1);
    } catch (err) {
      console.error(err);
    }
  }, [getRelevantTime, duration, cutSegments, createIndexedSegment, setCutSegments, setCurrentSegIndex]);

  const duplicateSegment = useCallback((segment: Pick<StateSegment, 'start' | 'end'> & Partial<Pick<StateSegment, 'name'>>) => {
    try {
      // Cannot duplicate if seg is not finished
      if (segment.start === undefined && segment.end === undefined) return;

      const cutSegmentsNew = [
        ...cutSegments,
        createIndexedSegment({ segment: { start: segment.start, end: segment.end, name: segment.name }, incrementCount: true }),
      ];

      setCutSegments(cutSegmentsNew);
      setCurrentSegIndex(cutSegmentsNew.length - 1);
    } catch (err) {
      console.error(err);
    }
  }, [createIndexedSegment, cutSegments, setCutSegments]);

  const duplicateCurrentSegment = useCallback(() => {
    duplicateSegment(currentCutSeg);
  }, [currentCutSeg, duplicateSegment]);

  const setCutStart = useCallback(() => {
    if (!checkFileOpened()) return;

    const relevantTime = getRelevantTime();
    // https://github.com/mifi/lossless-cut/issues/168
    // If current time is after the end of the current segment in the timeline,
    // add a new segment that starts at playerTime
    if (currentCutSeg.end != null && relevantTime >= currentCutSeg.end) {
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
  }, [checkFileOpened, getRelevantTime, currentCutSeg.end, addSegment, setCutTime]);

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
    const { name } = cutSegments[index]!;
    const value = await labelSegmentDialog({ currentName: name, maxLength: maxLabelLength });
    if (value != null) updateSegAtIndex(index, { name: value });
  }, [cutSegments, updateSegAtIndex, maxLabelLength]);

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

  const splitCurrentSegment = useCallback(() => {
    const relevantTime = getRelevantTime();
    const segmentsAtCursorIndexes = findSegmentsAtCursor(relevantTime);

    const firstSegmentAtCursorIndex = segmentsAtCursorIndexes[0];

    if (firstSegmentAtCursorIndex == null) {
      errorToast(i18n.t('No segment to split. Please move cursor over the segment you want to split'));
      return;
    }

    const segment = cutSegments[firstSegmentAtCursorIndex];
    if (segment == null) throw new Error();

    const getNewName = (oldName: string, suffix: string) => oldName && `${segment.name} ${suffix}`;

    const firstPart = createIndexedSegment({ segment: { name: getNewName(segment.name, '1'), start: segment.start, end: relevantTime }, incrementCount: false });
    const secondPart = createIndexedSegment({ segment: { name: getNewName(segment.name, '2'), start: relevantTime, end: segment.end }, incrementCount: true });

    const newSegments = [...cutSegments];
    newSegments.splice(firstSegmentAtCursorIndex, 1, firstPart, secondPart);
    setCutSegments(newSegments);
  }, [createIndexedSegment, cutSegments, findSegmentsAtCursor, getRelevantTime, setCutSegments]);

  const createNumSegments = useCallback(async () => {
    if (!checkFileOpened() || !isDurationValid(duration)) return;
    const segments = await createNumSegmentsDialog(duration);
    if (segments) loadCutSegments(segments);
  }, [checkFileOpened, duration, loadCutSegments]);

  const createFixedDurationSegments = useCallback(async () => {
    if (!checkFileOpened() || !isDurationValid(duration)) return;
    const segmentDuration = await askForSegmentDuration({ fileDuration: duration, inputPlaceholder: timecodePlaceholder, parseTimecode });
    if (segmentDuration == null) return;
    loadCutSegments(makeDurationSegments(segmentDuration, duration));
  }, [checkFileOpened, duration, loadCutSegments, parseTimecode, timecodePlaceholder]);

  const createFixedByteSizedSegments = useCallback(async () => {
    if (!checkFileOpened() || !isDurationValid(duration)) return;
    const fileSize = mainFileMeta && parseInt(mainFileMeta.formatData.size, 10);
    invariant(fileSize != null && !Number.isNaN(fileSize));
    const segmentDuration = await createFixedByteSixedSegmentsDialog({ fileDuration: duration, fileSize });
    if (segmentDuration == null) return;
    loadCutSegments(makeDurationSegments(segmentDuration, duration));
  }, [checkFileOpened, duration, loadCutSegments, mainFileMeta]);

  const createRandomSegments = useCallback(async () => {
    if (!checkFileOpened() || !isDurationValid(duration)) return;
    const segments = await createRandomSegmentsDialog(duration);
    if (segments) loadCutSegments(segments);
  }, [checkFileOpened, duration, loadCutSegments]);

  const selectSegments = useCallback((segments: { segId: string }[]) => {
    if (segments.length === 0 || segments.length === cutSegments.length) return; // no point in selecting none or all
    setDeselectedSegmentIds((existing) => {
      const ret = { ...existing };
      segments.forEach(({ segId }) => { ret[segId] = false; });
      return ret;
    });
  }, [cutSegments.length]);

  const selectSegmentsByLabel = useCallback(async () => {
    const { name } = currentCutSeg;
    const value = await selectSegmentsByLabelDialog(name);
    if (value == null) return;
    selectSegments(cutSegments.filter((seg) => seg.name === value));
  }, [currentCutSeg, cutSegments, selectSegments]);

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
      ...(isSegmentSelected(seg) && await mutateSegment(seg, index, expr)),
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
  }, [cutSegments, getScopeSegment, isSegmentSelected, safeSetCutSegments]);

  const labelSelectedSegments = useCallback(async () => {
    const firstSelectedSegment = selectedSegmentsRaw[0];
    if (firstSelectedSegment == null) return;
    const { name } = firstSelectedSegment;
    const value = await labelSegmentDialog({ currentName: name, maxLength: maxLabelLength });
    if (value == null) return;
    setCutSegments((existingSegments) => existingSegments.map((existingSegment) => {
      if (selectedSegmentsRaw.some((seg) => seg.segId === existingSegment.segId)) return { ...existingSegment, name: value };
      return existingSegment;
    }));
  }, [maxLabelLength, selectedSegmentsRaw, setCutSegments]);

  const selectedSegmentsOrInverse = useMemo<{ start: number, end: number }[]>(() => {
    // For invertCutSegments we do not support filtering (selecting) segments
    if (invertCutSegments) return inverseCutSegments;

    // exclude markers (segments without end)
    return filterNonMarkers(selectedSegments);
  }, [inverseCutSegments, invertCutSegments, selectedSegments]);

  // non filtered includes also non selected
  const nonFilteredSegmentsOrInverse = useMemo(() => (invertCutSegments
    ? inverseCutSegments
    : filterNonMarkers(cutSegments)
  ), [invertCutSegments, inverseCutSegments, cutSegments]);

  const segmentsToExport = useMemo<SegmentToExport[]>(() => {
    // segmentsToChaptersOnly is a special mode where all segments will be simply written out as chapters to one file: https://github.com/mifi/lossless-cut/issues/993#issuecomment-1037927595
    // Chapters export mode: Emulate a single segment with no cuts (full timeline)
    if (segmentsToChaptersOnly) return [{ start: 0, end: durationSafe }];
    if (selectedSegmentsOrInverse.length > 0) return selectedSegmentsOrInverse;
    return [{ start: 0, end: durationSafe }]; // e.g. only markers
  }, [segmentsToChaptersOnly, durationSafe, selectedSegmentsOrInverse]);

  const removeSelectedSegments = useCallback(() => removeSegments(selectedSegmentsRaw.map((seg) => seg.segId)), [removeSegments, selectedSegmentsRaw]);

  const selectOnlySegment = useCallback((seg: Pick<StateSegment, 'segId'>) => setDeselectedSegmentIds(Object.fromEntries(cutSegments.filter((s) => s.segId !== seg.segId).map((s) => [s.segId, true]))), [cutSegments]);
  const toggleSegmentSelected = useCallback((seg: Pick<StateSegment, 'segId'>) => setDeselectedSegmentIds((existing) => ({ ...existing, [seg.segId]: !existing[seg.segId] })), []);
  const deselectAllSegments = useCallback(() => setDeselectedSegmentIds(Object.fromEntries(cutSegments.map((s) => [s.segId, true]))), [cutSegments]);
  const invertSelectedSegments = useCallback(() => setDeselectedSegmentIds((existing) => Object.fromEntries(cutSegments.map((s) => [s.segId, !existing[s.segId]]))), [cutSegments]);
  const selectAllSegments = useCallback(() => setDeselectedSegmentIds({}), []);

  const selectOnlyCurrentSegment = useCallback(() => selectOnlySegment(currentCutSeg), [currentCutSeg, selectOnlySegment]);
  const toggleCurrentSegmentSelected = useCallback(() => toggleSegmentSelected(currentCutSeg), [currentCutSeg, toggleSegmentSelected]);

  return {
    cutSegments,
    cutSegmentsHistory,
    createSegmentsFromKeyframes,
    shuffleSegments,
    detectBlackScenes,
    detectSilentScenes,
    detectSceneChanges,
    removeCutSegment,
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
    createNumSegments,
    createFixedDurationSegments,
    createFixedByteSizedSegments,
    createRandomSegments,
    haveInvalidSegs,
    currentSegIndexSafe,
    currentCutSeg,
    inverseCutSegments,
    clearSegments,
    loadCutSegments,
    isSegmentSelected,
    selectedSegments,
    selectedSegmentsOrInverse,
    nonFilteredSegmentsOrInverse,
    segmentsToExport,

    setCurrentSegIndex,

    setDeselectedSegmentIds,
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
