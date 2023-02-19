import { useCallback, useRef, useMemo, useState } from 'react';
import { useStateWithHistory } from 'react-use/lib/useStateWithHistory';
import i18n from 'i18next';
import JSON5 from 'json5';
import pMap from 'p-map';

import sortBy from 'lodash/sortBy';

import { blackDetect, silenceDetect, detectSceneChanges as ffmpegDetectSceneChanges, readFrames, mapTimesToSegments, findKeyframeNearTime } from '../ffmpeg';
import { handleError, shuffleArray } from '../util';
import { errorToast } from '../swal';
import { showParametersDialog } from '../dialogs/parameters';
import { createNumSegments as createNumSegmentsDialog, createFixedDurationSegments as createFixedDurationSegmentsDialog, createRandomSegments as createRandomSegmentsDialog, labelSegmentDialog, showEditableJsonDialog, askForShiftSegments, askForAlignSegments, selectSegmentsByLabelDialog } from '../dialogs';
import { createSegment, findSegmentsAtCursor, sortSegments, invertSegments, getSegmentTags, combineOverlappingSegments as combineOverlappingSegments2, isDurationValid, getSegApparentStart, getSegApparentEnd as getSegApparentEnd2 } from '../segments';
import * as ffmpegParameters from '../ffmpeg-parameters';
import { maxSegmentsAllowed } from '../util/constants';


export default ({
  filePath, workingRef, setWorking, setCutProgress, mainVideoStream,
  duration, getRelevantTime, maxLabelLength, checkFileOpened, invertCutSegments,
}) => {
  // Segment related state
  const segCounterRef = useRef(0);

  const createIndexedSegment = useCallback(({ segment, incrementCount } = {}) => {
    if (incrementCount) segCounterRef.current += 1;
    const ret = createSegment({ segColorIndex: segCounterRef.current, ...segment });
    return ret;
  }, []);

  const createInitialCutSegments = useCallback(() => [createIndexedSegment()], [createIndexedSegment]);

  const [cutSegments, setCutSegments, cutSegmentsHistory] = useStateWithHistory(
    createInitialCutSegments(),
    100,
  );

  const [currentSegIndex, setCurrentSegIndex] = useState(0);
  const [deselectedSegmentIds, setDeselectedSegmentIds] = useState({});

  const isSegmentSelected = useCallback(({ segId }) => !deselectedSegmentIds[segId], [deselectedSegmentIds]);


  const clearSegCounter = useCallback(() => {
    // eslint-disable-next-line no-param-reassign
    segCounterRef.current = 0;
  }, [segCounterRef]);

  const clearSegments = useCallback(() => {
    clearSegCounter();
    setCutSegments(createInitialCutSegments());
  }, [clearSegCounter, createInitialCutSegments, setCutSegments]);

  const shuffleSegments = useCallback(() => setCutSegments((oldSegments) => shuffleArray(oldSegments)), [setCutSegments]);

  const loadCutSegments = useCallback((edl, append = false) => {
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

  const detectSegments = useCallback(async ({ name, workingText, errorText, fn }) => {
    if (!filePath) return;
    if (workingRef.current) return;
    try {
      setWorking(workingText);
      setCutProgress(0);

      const newSegments = await fn();
      console.log(name, newSegments);
      loadCutSegments(newSegments, true);
    } catch (err) {
      handleError(errorText, err);
    } finally {
      setWorking();
      setCutProgress();
    }
  }, [filePath, workingRef, setWorking, setCutProgress, loadCutSegments]);

  const getSegApparentEnd = useCallback((seg) => getSegApparentEnd2(seg, duration), [duration]);

  const getApparentCutSegments = useCallback((segments) => segments.map((cutSegment) => ({
    ...cutSegment,
    start: getSegApparentStart(cutSegment),
    end: getSegApparentEnd(cutSegment),
  })), [getSegApparentEnd]);

  // These are segments guaranteed to have a start and end time
  const apparentCutSegments = useMemo(() => getApparentCutSegments(cutSegments), [cutSegments, getApparentCutSegments]);

  const getApparentCutSegmentById = useCallback((id) => apparentCutSegments.find((s) => s.segId === id), [apparentCutSegments]);

  const haveInvalidSegs = useMemo(() => apparentCutSegments.some((cutSegment) => cutSegment.start >= cutSegment.end), [apparentCutSegments]);

  const currentSegIndexSafe = Math.min(currentSegIndex, cutSegments.length - 1);
  const currentCutSeg = useMemo(() => cutSegments[currentSegIndexSafe], [currentSegIndexSafe, cutSegments]);
  const currentApparentCutSeg = useMemo(() => apparentCutSegments[currentSegIndexSafe], [apparentCutSegments, currentSegIndexSafe]);

  const selectedSegmentsRaw = useMemo(() => apparentCutSegments.filter(isSegmentSelected), [apparentCutSegments, isSegmentSelected]);

  const detectBlackScenes = useCallback(async () => {
    const filterOptions = await showParametersDialog({ title: i18n.t('Enter parameters'), parameters: ffmpegParameters.blackdetect(), docUrl: 'https://ffmpeg.org/ffmpeg-filters.html#blackdetect' });
    if (filterOptions == null) return;
    await detectSegments({ name: 'blackScenes', workingText: i18n.t('Detecting black scenes'), errorText: i18n.t('Failed to detect black scenes'), fn: async () => blackDetect({ filePath, filterOptions, onProgress: setCutProgress, from: currentApparentCutSeg.start, to: currentApparentCutSeg.end }) });
  }, [currentApparentCutSeg.end, currentApparentCutSeg.start, detectSegments, filePath, setCutProgress]);

  const detectSilentScenes = useCallback(async () => {
    const filterOptions = await showParametersDialog({ title: i18n.t('Enter parameters'), parameters: ffmpegParameters.silencedetect(), docUrl: 'https://ffmpeg.org/ffmpeg-filters.html#silencedetect' });
    if (filterOptions == null) return;
    await detectSegments({ name: 'silentScenes', workingText: i18n.t('Detecting silent scenes'), errorText: i18n.t('Failed to detect silent scenes'), fn: async () => silenceDetect({ filePath, filterOptions, onProgress: setCutProgress, from: currentApparentCutSeg.start, to: currentApparentCutSeg.end }) });
  }, [currentApparentCutSeg.end, currentApparentCutSeg.start, detectSegments, filePath, setCutProgress]);

  const detectSceneChanges = useCallback(async () => {
    const filterOptions = await showParametersDialog({ title: i18n.t('Enter parameters'), parameters: ffmpegParameters.sceneChange() });
    if (filterOptions == null) return;
    await detectSegments({ name: 'sceneChanges', workingText: i18n.t('Detecting scene changes'), errorText: i18n.t('Failed to detect scene changes'), fn: async () => ffmpegDetectSceneChanges({ filePath, minChange: filterOptions.minChange, onProgress: setCutProgress, from: currentApparentCutSeg.start, to: currentApparentCutSeg.end }) });
  }, [currentApparentCutSeg.end, currentApparentCutSeg.start, detectSegments, filePath, setCutProgress]);

  const createSegmentsFromKeyframes = useCallback(async () => {
    if (!mainVideoStream) return;
    const keyframes = (await readFrames({ filePath, from: currentApparentCutSeg.start, to: currentApparentCutSeg.end, streamIndex: mainVideoStream.index })).filter((frame) => frame.keyframe);
    const newSegments = mapTimesToSegments(keyframes.map((keyframe) => keyframe.time));
    loadCutSegments(newSegments, true);
  }, [currentApparentCutSeg.end, currentApparentCutSeg.start, filePath, loadCutSegments, mainVideoStream]);

  const removeSegments = useCallback((removeSegmentIds) => {
    setCutSegments((existingSegments) => {
      if (existingSegments.length === 1 && existingSegments[0].start == null && existingSegments[0].end == null) {
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

  const removeCutSegment = useCallback((index) => {
    removeSegments([cutSegments[index].segId]);
  }, [cutSegments, removeSegments]);

  const inverseCutSegments = useMemo(() => {
    const inverted = !haveInvalidSegs && isDurationValid(duration) ? invertSegments(sortSegments(apparentCutSegments), true, true, duration) : undefined;
    return inverted || [];
  }, [apparentCutSegments, duration, haveInvalidSegs]);

  const invertAllSegments = useCallback(() => {
    if (inverseCutSegments.length < 1) {
      errorToast(i18n.t('Make sure you have no overlapping segments.'));
      return;
    }
    // don't reset segColorIndex (which represent colors) when inverting
    const newInverseCutSegments = inverseCutSegments.map((inverseSegment, index) => createSegment({ ...inverseSegment, segColorIndex: index }));
    setCutSegments(newInverseCutSegments);
  }, [inverseCutSegments, setCutSegments]);

  const fillSegmentsGaps = useCallback(() => {
    if (inverseCutSegments.length < 1) {
      errorToast(i18n.t('Make sure you have no overlapping segments.'));
      return;
    }
    const newInverseCutSegments = inverseCutSegments.map((inverseSegment) => createIndexedSegment({ segment: inverseSegment, incrementCount: true }));
    setCutSegments((existing) => ([...existing, ...newInverseCutSegments]));
  }, [createIndexedSegment, inverseCutSegments, setCutSegments]);

  const combineOverlappingSegments = useCallback(() => {
    setCutSegments((existingSegments) => combineOverlappingSegments2(existingSegments, getSegApparentEnd));
  }, [getSegApparentEnd, setCutSegments]);

  const updateSegAtIndex = useCallback((index, newProps) => {
    if (index < 0) return;
    const cutSegmentsNew = [...cutSegments];
    cutSegmentsNew.splice(index, 1, { ...cutSegments[index], ...newProps });
    setCutSegments(cutSegmentsNew);
  }, [setCutSegments, cutSegments]);

  const setCutTime = useCallback((type, time) => {
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

  const modifySelectedSegmentTimes = useCallback(async (transformSegment, concurrency = 5) => {
    const clampValue = (val) => Math.min(Math.max(val, 0), duration);

    let newSegments = await pMap(apparentCutSegments, async (segment) => {
      if (!isSegmentSelected(segment)) return segment; // pass thru non-selected segments
      const newSegment = await transformSegment(segment);
      newSegment.start = clampValue(newSegment.start);
      newSegment.end = clampValue(newSegment.end);
      return newSegment;
    }, { concurrency });
    newSegments = newSegments.filter((segment) => segment.end > segment.start);
    if (newSegments.length < 1) setCutSegments(createInitialCutSegments());
    else setCutSegments(newSegments);
  }, [apparentCutSegments, createInitialCutSegments, duration, isSegmentSelected, setCutSegments]);

  const shiftAllSegmentTimes = useCallback(async () => {
    const shift = await askForShiftSegments();
    if (shift == null) return;

    const { shiftAmount, shiftKeys } = shift;
    await modifySelectedSegmentTimes((segment) => {
      const newSegment = { ...segment };
      shiftKeys.forEach((key) => {
        newSegment[key] += shiftAmount;
      });
      return newSegment;
    });
  }, [modifySelectedSegmentTimes]);

  const alignSegmentTimesToKeyframes = useCallback(async () => {
    if (!mainVideoStream || workingRef.current) return;
    try {
      const response = await askForAlignSegments();
      if (response == null) return;
      setWorking(i18n.t('Aligning segments to keyframes'));
      const { mode, startOrEnd } = response;
      await modifySelectedSegmentTimes(async (segment) => {
        const newSegment = { ...segment };

        async function align(key) {
          const time = newSegment[key];
          const keyframe = await findKeyframeNearTime({ filePath, streamIndex: mainVideoStream.index, time, mode });
          if (!keyframe == null) throw new Error(`Cannot find any keyframe within 60 seconds of frame ${time}`);
          newSegment[key] = keyframe;
        }
        if (startOrEnd.includes('start')) await align('start');
        if (startOrEnd.includes('end')) await align('end');
        return newSegment;
      });
    } catch (err) {
      handleError(err);
    } finally {
      setWorking();
    }
  }, [filePath, mainVideoStream, modifySelectedSegmentTimes, setWorking, workingRef]);

  const onViewSegmentTags = useCallback(async (index) => {
    const segment = cutSegments[index];
    function inputValidator(jsonStr) {
      try {
        const json = JSON5.parse(jsonStr);
        if (!(typeof json === 'object' && Object.values(json).every((val) => typeof val === 'string'))) throw new Error();
        return undefined;
      } catch (err) {
        return i18n.t('Invalid JSON');
      }
    }
    const tags = getSegmentTags(segment);
    const newTagsStr = await showEditableJsonDialog({ title: i18n.t('Segment tags'), text: i18n.t('View and edit segment tags in JSON5 format:'), inputValue: Object.keys(tags).length > 0 ? JSON5.stringify(tags, null, 2) : '', inputValidator });
    if (newTagsStr != null) updateSegAtIndex(index, { tags: JSON5.parse(newTagsStr) });
  }, [cutSegments, updateSegAtIndex]);

  const updateSegOrder = useCallback((index, newOrder) => {
    if (newOrder > cutSegments.length - 1 || newOrder < 0) return;
    const newSegments = [...cutSegments];
    const removedSeg = newSegments.splice(index, 1)[0];
    newSegments.splice(newOrder, 0, removedSeg);
    setCutSegments(newSegments);
    setCurrentSegIndex(newOrder);
  }, [cutSegments, setCurrentSegIndex, setCutSegments]);

  const updateSegOrders = useCallback((newOrders) => {
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

      if (suggestedStart >= duration) return;

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

  const onLabelSegment = useCallback(async (index) => {
    const { name } = cutSegments[index];
    const value = await labelSegmentDialog({ currentName: name, maxLength: maxLabelLength });
    if (value != null) updateSegAtIndex(index, { name: value });
  }, [cutSegments, updateSegAtIndex, maxLabelLength]);

  const splitCurrentSegment = useCallback(() => {
    const relevantTime = getRelevantTime();
    const segmentsAtCursorIndexes = findSegmentsAtCursor(apparentCutSegments, relevantTime);

    if (segmentsAtCursorIndexes.length === 0) {
      errorToast(i18n.t('No segment to split. Please move cursor over the segment you want to split'));
      return;
    }

    const firstSegmentAtCursorIndex = segmentsAtCursorIndexes[0];
    const segment = cutSegments[firstSegmentAtCursorIndex];

    const getNewName = (oldName, suffix) => oldName && `${segment.name} ${suffix}`;

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
    const segments = await createFixedDurationSegmentsDialog(duration);
    if (segments) loadCutSegments(segments);
  }, [checkFileOpened, duration, loadCutSegments]);

  const createRandomSegments = useCallback(async () => {
    if (!checkFileOpened() || !isDurationValid(duration)) return;
    const segments = await createRandomSegmentsDialog(duration);
    if (segments) loadCutSegments(segments);
  }, [checkFileOpened, duration, loadCutSegments]);

  const onSelectSegmentsByLabel = useCallback(async () => {
    const { name } = currentCutSeg;
    const value = await selectSegmentsByLabelDialog(name);
    if (value == null) return;
    const segmentsToEnable = cutSegments.filter((seg) => (seg.name || '') === value);
    if (segmentsToEnable.length === 0 || segmentsToEnable.length === cutSegments.length) return; // no point
    setDeselectedSegmentIds((existing) => {
      const ret = { ...existing };
      segmentsToEnable.forEach(({ segId }) => { ret[segId] = false; });
      return ret;
    });
  }, [currentCutSeg, cutSegments]);

  const onLabelSelectedSegments = useCallback(async () => {
    if (selectedSegmentsRaw.length < 1) return;
    const { name } = selectedSegmentsRaw[0];
    const value = await labelSegmentDialog({ currentName: name, maxLength: maxLabelLength });
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

  const removeSelectedSegments = useCallback(() => removeSegments(selectedSegmentsRaw.map((seg) => seg.segId)), [removeSegments, selectedSegmentsRaw]);

  const selectOnlySegment = useCallback((seg) => setDeselectedSegmentIds(Object.fromEntries(cutSegments.filter((s) => s.segId !== seg.segId).map((s) => [s.segId, true]))), [cutSegments]);
  const toggleSegmentSelected = useCallback((seg) => setDeselectedSegmentIds((existing) => ({ ...existing, [seg.segId]: !existing[seg.segId] })), []);
  const deselectAllSegments = useCallback(() => setDeselectedSegmentIds(Object.fromEntries(cutSegments.map((s) => [s.segId, true]))), [cutSegments]);
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
    shiftAllSegmentTimes,
    alignSegmentTimesToKeyframes,
    onViewSegmentTags,
    updateSegOrder,
    updateSegOrders,
    reorderSegsByStartTime,
    addSegment,
    setCutStart,
    setCutEnd,
    onLabelSegment,
    splitCurrentSegment,
    createNumSegments,
    createFixedDurationSegments,
    createRandomSegments,
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
    getSegApparentEnd,
    setCurrentSegIndex,

    setDeselectedSegmentIds,
    onLabelSelectedSegments,
    deselectAllSegments,
    selectAllSegments,
    selectOnlyCurrentSegment,
    toggleCurrentSegmentSelected,
    removeSelectedSegments,
    onSelectSegmentsByLabel,
    toggleSegmentSelected,
    selectOnlySegment,
  };
};
