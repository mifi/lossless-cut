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
import { createNumSegments as createNumSegmentsDialog, createFixedDurationSegments as createFixedDurationSegmentsDialog, createRandomSegments as createRandomSegmentsDialog, labelSegmentDialog, askForShiftSegments, askForAlignSegments, selectSegmentsByLabelDialog, selectSegmentsByExprDialog, askForPadding } from '../dialogs';
import { createSegment, findSegmentsAtCursor, sortSegments, invertSegments, combineOverlappingSegments as combineOverlappingSegments2, combineSelectedSegments as combineSelectedSegments2, isDurationValid, getSegApparentStart, getSegApparentEnd as getSegApparentEnd2, addSegmentColorIndex } from '../segments';
import { parameters as allFfmpegParameters, FfmpegDialog } from '../ffmpegParameters';
import { maxSegmentsAllowed } from '../util/constants';
import { ApparentCutSegment, ParseTimecode, FormatTimecode, SegmentBase, SegmentToExport, StateSegment, UpdateSegAtIndex } from '../types';
import safeishEval from '../worker/eval';
import { ScopeSegment } from '../../../../types';
import { FFprobeStream } from '../../../../ffprobe';

const { ffmpeg: { blackDetect, silenceDetect } } = window.require('@electron/remote').require('./index.js');


function useSegments({ filePath, workingRef, setWorking, setProgress, videoStream, duration, getRelevantTime, maxLabelLength, checkFileOpened, invertCutSegments, segmentsToChaptersOnly, timecodePlaceholder, parseTimecode, formatTimecode, appendFfmpegCommandLog }: {
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
  formatTimecode: FormatTimecode,
  appendFfmpegCommandLog: (args: string[]) => void,
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

  const loadCutSegments = useCallback((edl: SegmentBase[], append: boolean | undefined = false) => {
    const validEdl = edl.filter((row) => (
      (row.start === undefined || row.end === undefined || row.start < row.end)
      && (row.start === undefined || row.start >= 0)
      // TODO: Cannot do this because duration is not yet set when loading a file
      // && (row.start === undefined || (row.start >= 0 && row.start < duration))
      // && (row.end === undefined || row.end < duration)
    ));

    if (validEdl.length === 0) throw new Error(i18n.t('No valid segments found'));

    if (!append) clearSegCounter();

    if (validEdl.length > maxSegmentsAllowed) throw new Error(i18n.t('Tried to create too many segments (max {{maxSegmentsAllowed}}.)', { maxSegmentsAllowed }));

    setCutSegments((existingSegments) => {
      const needToAppend = append && existingSegments.length > 1;
      let newSegments = validEdl.map((segment, i) => createIndexedSegment({ segment, incrementCount: needToAppend || i > 0 }));
      if (needToAppend) newSegments = [...existingSegments, ...newSegments];
      return newSegments;
    });
  }, [clearSegCounter, createIndexedSegment, setCutSegments]);

  const detectSegments = useCallback(async ({ name, workingText, errorText, fn }: {
    name: string,
    workingText: string,
    errorText: string,
    fn: () => Promise<{ detectedSegments: SegmentBase[], ffmpegArgs: string[] }>,
  }) => {
    if (!filePath) return;
    if (workingRef.current) return;
    try {
      setWorking({ text: workingText });
      setProgress(0);

      const { detectedSegments, ffmpegArgs } = await fn();
      appendFfmpegCommandLog(ffmpegArgs);

      console.log(name, detectedSegments);
      loadCutSegments(detectedSegments, true);
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError')) handleError(errorText, err);
    } finally {
      setWorking(undefined);
      setProgress(undefined);
    }
  }, [filePath, workingRef, setWorking, setProgress, appendFfmpegCommandLog, loadCutSegments]);

  const getSegApparentEnd = useCallback((seg: SegmentBase) => getSegApparentEnd2(seg, duration), [duration]);

  const getApparentCutSegments = useCallback((segments: StateSegment[]) => segments.map((cutSegment) => ({
    ...cutSegment,
    start: getSegApparentStart(cutSegment),
    end: getSegApparentEnd(cutSegment),
  })), [getSegApparentEnd]);

  // These are segments guaranteed to have a start and end time
  const apparentCutSegments = useMemo(() => getApparentCutSegments(cutSegments), [cutSegments, getApparentCutSegments]);

  const getApparentCutSegmentById = useCallback((id: string) => apparentCutSegments.find((s) => s.segId === id), [apparentCutSegments]);

  const haveInvalidSegs = useMemo(() => apparentCutSegments.some((cutSegment) => cutSegment.start >= cutSegment.end), [apparentCutSegments]);

  const currentSegIndexSafe = Math.min(currentSegIndex, cutSegments.length - 1);
  const currentCutSeg = useMemo(() => {
    const ret = cutSegments[currentSegIndexSafe];
    if (ret == null) throw new Error('currentCutSeg was nullish, this shouldn\'t happen');
    return ret;
  }, [currentSegIndexSafe, cutSegments]);
  const currentApparentCutSeg = useMemo(() => {
    const ret = apparentCutSegments[currentSegIndexSafe];
    if (ret == null) throw new Error('currentApparentCutSeg was nullish, this shouldn\'t happen');
    return ret;
  }, [apparentCutSegments, currentSegIndexSafe]);

  const selectedSegmentsRaw = useMemo(() => apparentCutSegments.filter((segment) => isSegmentSelected(segment)), [apparentCutSegments, isSegmentSelected]);

  const getFfmpegParameters = useCallback((key: FfmpegDialog) => {
    const parameters = ffmpegParameters[key];
    invariant(parameters);
    return parameters;
  }, [ffmpegParameters]);

  const detectBlackScenes = useCallback(async () => {
    const dialogType = 'blackdetect';
    const parameters = await showParametersDialog({ title: i18n.t('Enter parameters'), dialogType, parameters: getFfmpegParameters(dialogType), docUrl: 'https://ffmpeg.org/ffmpeg-filters.html#blackdetect' });
    if (parameters == null) return;
    const { mode, ...filterOptions } = parameters;
    setFfmpegParametersForDialog(dialogType, parameters);
    invariant(mode === '1' || mode === '2');
    invariant(filePath != null);
    await detectSegments({ name: 'blackScenes', workingText: i18n.t('Detecting black scenes'), errorText: i18n.t('Failed to detect black scenes'), fn: async () => blackDetect({ filePath, filterOptions, boundingMode: mode === '1', onProgress: setProgress, from: currentApparentCutSeg.start, to: currentApparentCutSeg.end }) });
  }, [getFfmpegParameters, setFfmpegParametersForDialog, filePath, detectSegments, setProgress, currentApparentCutSeg.start, currentApparentCutSeg.end]);

  const detectSilentScenes = useCallback(async () => {
    const dialogType = 'silencedetect';
    const parameters = await showParametersDialog({ title: i18n.t('Enter parameters'), dialogType, parameters: getFfmpegParameters(dialogType), docUrl: 'https://ffmpeg.org/ffmpeg-filters.html#silencedetect' });
    if (parameters == null) return;
    setFfmpegParametersForDialog(dialogType, parameters);
    const { mode, ...filterOptions } = parameters;
    invariant(mode === '1' || mode === '2');
    invariant(filePath != null);
    await detectSegments({ name: 'silentScenes', workingText: i18n.t('Detecting silent scenes'), errorText: i18n.t('Failed to detect silent scenes'), fn: async () => silenceDetect({ filePath, filterOptions, boundingMode: mode === '1', onProgress: setProgress, from: currentApparentCutSeg.start, to: currentApparentCutSeg.end }) });
  }, [currentApparentCutSeg.end, currentApparentCutSeg.start, detectSegments, filePath, getFfmpegParameters, setFfmpegParametersForDialog, setProgress]);

  const detectSceneChanges = useCallback(async () => {
    const dialogType = 'sceneChange';
    const parameters = await showParametersDialog({ title: i18n.t('Enter parameters'), dialogType, parameters: getFfmpegParameters(dialogType) });
    if (parameters == null) return;
    setFfmpegParametersForDialog(dialogType, parameters);
    invariant(filePath != null);
    // eslint-disable-next-line prefer-destructuring
    const minChange = parameters['minChange'];
    invariant(minChange != null);
    await detectSegments({ name: 'sceneChanges', workingText: i18n.t('Detecting scene changes'), errorText: i18n.t('Failed to detect scene changes'), fn: async () => ffmpegDetectSceneChanges({ filePath, minChange, onProgress: setProgress, from: currentApparentCutSeg.start, to: currentApparentCutSeg.end }) });
  }, [currentApparentCutSeg.end, currentApparentCutSeg.start, detectSegments, filePath, getFfmpegParameters, setFfmpegParametersForDialog, setProgress]);

  const createSegmentsFromKeyframes = useCallback(async () => {
    if (!videoStream) return;
    invariant(filePath != null);
    const keyframes = (await readFrames({ filePath, from: currentApparentCutSeg.start, to: currentApparentCutSeg.end, streamIndex: videoStream.index })).filter((frame) => frame.keyframe);
    const newSegments = mapTimesToSegments(keyframes.map((keyframe) => keyframe.time), true);
    loadCutSegments(newSegments, true);
  }, [currentApparentCutSeg.end, currentApparentCutSeg.start, filePath, loadCutSegments, videoStream]);

  const removeSegments = useCallback((removeSegmentIds: string[]) => {
    setCutSegments((existingSegments) => {
      if (existingSegments.length === 1 && existingSegments[0]!.start == null && existingSegments[0]!.end == null) {
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
    return invertSegments(sortSegments(apparentCutSegments), true, true, duration).map(({ segId, start, end }) => {
      // this is workaround to please TS
      if (segId == null || start == null || end == null) throw new Error(`Encountered inverted segment with nullish value ${JSON.stringify({ segId, start, end })}`);
      return {
        segId,
        start,
        end,
      };
    });
  }, [apparentCutSegments, duration, haveInvalidSegs]);

  const invertAllSegments = useCallback(() => {
    if (inverseCutSegments.length === 0) {
      errorToast(i18n.t('Make sure you have no overlapping segments.'));
      return;
    }
    // don't reset segColorIndex (which represent colors) when inverting
    const newInverseCutSegments = inverseCutSegments.map((inverseSegment, index) => addSegmentColorIndex(createSegment(inverseSegment), index));
    setCutSegments(newInverseCutSegments);
  }, [inverseCutSegments, setCutSegments]);

  const fillSegmentsGaps = useCallback(() => {
    if (inverseCutSegments.length === 0) {
      errorToast(i18n.t('Make sure you have no overlapping segments.'));
      return;
    }
    const newInverseCutSegments = inverseCutSegments.map((inverseSegment) => createIndexedSegment({ segment: inverseSegment, incrementCount: true }));
    setCutSegments((existing) => ([...existing, ...newInverseCutSegments]));
  }, [createIndexedSegment, inverseCutSegments, setCutSegments]);

  const combineOverlappingSegments = useCallback(() => {
    setCutSegments((existingSegments) => combineOverlappingSegments2(existingSegments, getSegApparentEnd));
  }, [getSegApparentEnd, setCutSegments]);

  const combineSelectedSegments = useCallback(() => {
    setCutSegments((existingSegments) => combineSelectedSegments2(existingSegments, getSegApparentEnd2, isSegmentSelected));
  }, [isSegmentSelected, setCutSegments]);

  const updateSegAtIndex = useCallback<UpdateSegAtIndex>((index, newProps) => {
    if (index < 0) return;
    const cutSegmentsNew = [...cutSegments];
    const existing = cutSegments[index];
    if (existing == null) throw new Error();
    cutSegmentsNew.splice(index, 1, { ...existing, ...newProps });
    setCutSegments(cutSegmentsNew);
  }, [setCutSegments, cutSegments]);

  const setCutTime = useCallback((type: 'start' | 'end', time: number) => {
    if (!isDurationValid(duration)) return;

    const currentSeg = currentCutSeg;
    if (type === 'start' && time >= getSegApparentEnd(currentSeg)) {
      throw new Error('Start time must precede end time');
    }
    if (type === 'end' && time <= getSegApparentStart(currentSeg)) {
      throw new Error('Start time must precede end time');
    }
    updateSegAtIndex(currentSegIndexSafe, { [type]: Math.min(Math.max(time, 0), duration) });
  }, [currentSegIndexSafe, getSegApparentEnd, currentCutSeg, duration, updateSegAtIndex]);

  const modifySelectedSegmentTimes = useCallback(async (transformSegment: <T extends ApparentCutSegment>(s: T) => Promise<T> | T, concurrency = 5) => {
    if (duration == null) throw new Error();
    const clampValue = (val: number) => Math.min(Math.max(val, 0), duration);

    let newSegments = await pMap(apparentCutSegments, async (segment) => {
      if (!isSegmentSelected(segment)) return segment; // pass thru non-selected segments
      const newSegment = await transformSegment(segment);
      newSegment.start = clampValue(newSegment.start);
      newSegment.end = clampValue(newSegment.end);
      return newSegment;
    }, { concurrency });
    newSegments = newSegments.filter((segment) => segment.end > segment.start);
    if (newSegments.length === 0) setCutSegments(createInitialCutSegments());
    else setCutSegments(newSegments);
  }, [apparentCutSegments, createInitialCutSegments, duration, isSegmentSelected, setCutSegments]);

  const shiftAllSegmentTimes = useCallback(async () => {
    const shift = await askForShiftSegments({ inputPlaceholder: timecodePlaceholder, parseTimecode });
    if (shift == null) return;

    const { shiftAmount, shiftKeys } = shift;
    await modifySelectedSegmentTimes((segment) => {
      const newSegment = { ...segment };
      shiftKeys.forEach((key) => {
        newSegment[key] += shiftAmount;
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
          if (filePath == null) throw new Error();
          const keyframe = await findKeyframeNearTime({ filePath, streamIndex: videoStream.index, time, mode });
          if (keyframe == null) throw new Error(`Cannot find any keyframe within 60 seconds of frame ${time}`);
          newSegment[key] = keyframe;
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
    setCutSegments(sortBy(cutSegments, getSegApparentStart));
  }, [cutSegments, setCutSegments]);

  const addSegment = useCallback(() => {
    try {
      // Cannot add if prev seg is not finished
      if (currentCutSeg.start === undefined && currentCutSeg.end === undefined) return;

      const suggestedStart = getRelevantTime();
      /* if (keyframeCut) {
        const keyframeAlignedStart = getSafeCutTime(suggestedStart, true);
        if (keyframeAlignedStart != null) suggestedStart = keyframeAlignedStart;
      } */

      if (duration == null || suggestedStart >= duration) return;

      const cutSegmentsNew = [
        ...cutSegments,
        createIndexedSegment({ segment: { start: suggestedStart }, incrementCount: true }),
      ];

      setCutSegments(cutSegmentsNew);
      setCurrentSegIndex(cutSegmentsNew.length - 1);
    } catch (err) {
      console.error(err);
    }
  }, [currentCutSeg.start, currentCutSeg.end, getRelevantTime, duration, cutSegments, createIndexedSegment, setCutSegments, setCurrentSegIndex]);

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

  const onLabelSegment = useCallback(async (index: number) => {
    const { name } = cutSegments[index]!;
    const value = await labelSegmentDialog({ currentName: name, maxLength: maxLabelLength });
    if (value != null) updateSegAtIndex(index, { name: value });
  }, [cutSegments, updateSegAtIndex, maxLabelLength]);

  const focusSegmentAtCursor = useCallback(() => {
    const relevantTime = getRelevantTime();
    const [firstSegmentAtCursorIndex] = findSegmentsAtCursor(apparentCutSegments, relevantTime);
    if (firstSegmentAtCursorIndex == null) return;
    setCurrentSegIndex(firstSegmentAtCursorIndex);
  }, [apparentCutSegments, getRelevantTime]);

  const splitCurrentSegment = useCallback(() => {
    const relevantTime = getRelevantTime();
    const segmentsAtCursorIndexes = findSegmentsAtCursor(apparentCutSegments, relevantTime);

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
  }, [apparentCutSegments, createIndexedSegment, cutSegments, getRelevantTime, setCutSegments]);

  const createNumSegments = useCallback(async () => {
    if (!checkFileOpened() || !isDurationValid(duration)) return;
    const segments = await createNumSegmentsDialog(duration);
    if (segments) loadCutSegments(segments);
  }, [checkFileOpened, duration, loadCutSegments]);

  const createFixedDurationSegments = useCallback(async () => {
    if (!checkFileOpened() || !isDurationValid(duration)) return;
    const segments = await createFixedDurationSegmentsDialog({ fileDuration: duration, inputPlaceholder: timecodePlaceholder, parseTimecode });
    if (segments) loadCutSegments(segments);
  }, [checkFileOpened, duration, loadCutSegments, parseTimecode, timecodePlaceholder]);

  const createRandomSegments = useCallback(async () => {
    if (!checkFileOpened() || !isDurationValid(duration)) return;
    const segments = await createRandomSegmentsDialog(duration);
    if (segments) loadCutSegments(segments);
  }, [checkFileOpened, duration, loadCutSegments]);

  const createSegmentAtCursorWithPadding = useCallback(async () => {

    if (!checkFileOpened() || !isDurationValid(duration)) return;
    const relevantTime = getRelevantTime();
    const padding = await askForPadding();
    if(padding) {
      const start = relevantTime - padding < 0 ? 0 : relevantTime - padding;
      const end = relevantTime + padding > duration ? duration : relevantTime + padding;
      const formattedTimecode = formatTimecode({seconds: relevantTime});
      const newSegment = createIndexedSegment({ segment: { name: `padded_segment_${formattedTimecode}`, start, end }, incrementCount: true });

      const newSegments = [...cutSegments];
      newSegments.push(newSegment);
      setCutSegments(newSegments);
    }
  }, [checkFileOpened, createIndexedSegment, cutSegments, duration, formatTimecode, getRelevantTime, setCutSegments]);

  const enableSegments = useCallback((segmentsToEnable: { segId: string }[]) => {
    if (segmentsToEnable.length === 0 || segmentsToEnable.length === cutSegments.length) return; // no point
    setDeselectedSegmentIds((existing) => {
      const ret = { ...existing };
      segmentsToEnable.forEach(({ segId }) => { ret[segId] = false; });
      return ret;
    });
  }, [cutSegments.length]);

  const onSelectSegmentsByLabel = useCallback(async () => {
    const { name } = currentCutSeg;
    const value = await selectSegmentsByLabelDialog(name);
    if (value == null) return;
    const segmentsToEnable = cutSegments.filter((seg) => (seg.name || '') === value);
    enableSegments(segmentsToEnable);
  }, [currentCutSeg, cutSegments, enableSegments]);

  const onSelectSegmentsByExpr = useCallback(async () => {
    async function matchSegment(seg: StateSegment, expr: string) {
      const start = getSegApparentStart(seg);
      const end = getSegApparentEnd(seg);
      // must clone tags because scope is mutable (editable by expression)
      const scopeSegment: ScopeSegment = { label: seg.name, start, end, duration: end - start, tags: { ...seg.tags } };
      return (await safeishEval(expr, { segment: scopeSegment })) === true;
    }

    const getSegmentsToEnable = async (expr: string) => (await pMap(cutSegments, async (seg) => (
      ((await matchSegment(seg, expr)) ? [seg] : [])
    ), { concurrency: 5 })).flat();

    const value = await selectSegmentsByExprDialog(async (v: string) => {
      try {
        if (v.trim().length === 0) return i18n.t('Please enter a JavaScript expression.');
        const segments = await getSegmentsToEnable(v);
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
    const segmentsToEnable = await getSegmentsToEnable(value);
    enableSegments(segmentsToEnable);
  }, [cutSegments, enableSegments, getSegApparentEnd]);

  const onLabelSelectedSegments = useCallback(async () => {
    if (selectedSegmentsRaw.length === 0) return;
    const { name } = selectedSegmentsRaw[0]!;
    const value = await labelSegmentDialog({ currentName: name, maxLength: maxLabelLength });
    if (value == null) return;
    setCutSegments((existingSegments) => existingSegments.map((existingSegment) => {
      if (selectedSegmentsRaw.some((seg) => seg.segId === existingSegment.segId)) return { ...existingSegment, name: value };
      return existingSegment;
    }));
  }, [maxLabelLength, selectedSegmentsRaw, setCutSegments]);

  // Guaranteed to have at least one segment (if user has selected none to export (selectedSegments empty), it makes no sense so select all instead.)
  const selectedSegments = useMemo(() => (selectedSegmentsRaw.length > 0 ? selectedSegmentsRaw : apparentCutSegments), [apparentCutSegments, selectedSegmentsRaw]);

  // For invertCutSegments we do not support filtering (selecting) segments
  const selectedSegmentsOrInverse = useMemo(() => (invertCutSegments ? inverseCutSegments : selectedSegments), [inverseCutSegments, invertCutSegments, selectedSegments]);
  const nonFilteredSegmentsOrInverse = useMemo(() => (invertCutSegments ? inverseCutSegments : apparentCutSegments), [invertCutSegments, inverseCutSegments, apparentCutSegments]);

  const segmentsToExport = useMemo<SegmentToExport[]>(() => {
    // segmentsToChaptersOnly is a special mode where all segments will be simply written out as chapters to one file: https://github.com/mifi/lossless-cut/issues/993#issuecomment-1037927595
    // Chapters export mode: Emulate a single segment with no cuts (full timeline)
    if (segmentsToChaptersOnly) return [{ start: 0, end: getSegApparentEnd({}) }];

    return selectedSegmentsOrInverse;
  }, [selectedSegmentsOrInverse, getSegApparentEnd, segmentsToChaptersOnly]);

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
    onLabelSegment,
    splitCurrentSegment,
    focusSegmentAtCursor,
    createNumSegments,
    createFixedDurationSegments,
    createRandomSegments,
    createSegmentAtCursorWithPadding,
    apparentCutSegments,
    getApparentCutSegmentById,
    haveInvalidSegs,
    currentSegIndexSafe,
    currentCutSeg,
    currentApparentCutSeg,
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
    onLabelSelectedSegments,
    deselectAllSegments,
    selectAllSegments,
    selectOnlyCurrentSegment,
    toggleCurrentSegmentSelected,
    invertSelectedSegments,
    removeSelectedSegments,
    onSelectSegmentsByLabel,
    onSelectSegmentsByExpr,
    toggleSegmentSelected,
    selectOnlySegment,
    setCutTime,
    updateSegAtIndex,
  };
}

export type UseSegments = ReturnType<typeof useSegments>;

export default useSegments;
