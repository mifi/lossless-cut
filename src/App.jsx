import React, { memo, useEffect, useState, useCallback, useRef, Fragment, useMemo } from 'react';
import { FaVolumeMute, FaVolumeUp, FaAngleLeft } from 'react-icons/fa';
import { AnimatePresence, motion } from 'framer-motion';
import Swal from 'sweetalert2';
import Lottie from 'react-lottie';
import { SideSheet, Button, Position, SegmentedControl, Select } from 'evergreen-ui';
import { useStateWithHistory } from 'react-use/lib/useStateWithHistory';
import useDebounce from 'react-use/lib/useDebounce';
import PQueue from 'p-queue';
import filePathToUrl from 'file-url';
import Mousetrap from 'mousetrap';
import uuid from 'uuid';

import fromPairs from 'lodash/fromPairs';
import clamp from 'lodash/clamp';
import cloneDeep from 'lodash/cloneDeep';
import sortBy from 'lodash/sortBy';
import flatMap from 'lodash/flatMap';
import isEqual from 'lodash/isEqual';

import TopMenu from './TopMenu';
import HelpSheet from './HelpSheet';
import SettingsSheet from './SettingsSheet';
import StreamsSelector from './StreamsSelector';
import SegmentList from './SegmentList';
import Settings from './Settings';
import LeftMenu from './LeftMenu';
import Timeline from './Timeline';
import RightMenu from './RightMenu';
import TimelineControls from './TimelineControls';
import { loadMifiLink } from './mifi';
import { primaryColor, controlsBackground, waveformColor } from './colors';
import { showMergeDialog, showOpenAndMergeDialog } from './merge/merge';
import allOutFormats from './outFormats';
import captureFrame from './capture-frame';
import {
  defaultProcessedCodecTypes, getStreamFps, isCuttingStart, isCuttingEnd,
  getDefaultOutFormat, getFormatData, renderFrame, mergeAnyFiles, renderThumbnails as ffmpegRenderThumbnails,
  readFrames, renderWaveformPng, html5ifyDummy, cutMultiple, extractStreams, autoMergeSegments, getAllStreams,
  findNearestKeyFrameTime, html5ify as ffmpegHtml5ify,
} from './ffmpeg';
import configStore from './store';
import { save as edlStoreSave, load as edlStoreLoad } from './edlStore';
import {
  getOutPath, formatDuration, toast, errorToast, showFfmpegFail, setFileNameTitle,
  promptTimeOffset, generateColor, getOutDir, withBlur,
} from './util';


import loadingLottie from './7077-magic-flow.json';


// const isDev = window.require('electron-is-dev');
const electron = window.require('electron'); // eslint-disable-line
const trash = window.require('trash');
const { unlink, exists } = window.require('fs-extra');


const { dialog } = electron.remote;


function createSegment({ start, end, name } = {}) {
  return {
    start,
    end,
    name: name || '',
    color: generateColor(),
    uuid: uuid.v4(),
  };
}

const createInitialCutSegments = () => [createSegment()];

// Because segments could have undefined start / end
// (meaning extend to start of timeline or end duration)
function getSegApparentStart(seg) {
  const time = seg.start;
  return time !== undefined ? time : 0;
}

const cleanCutSegments = (cs) => cs.map((seg) => ({
  start: seg.start,
  end: seg.end,
  name: seg.name,
}));

const dragPreventer = ev => {
  ev.preventDefault();
};

function doesPlayerSupportFile(streams) {
  // TODO improve, whitelist supported codecs instead
  return !streams.find(s => ['hevc', 'prores'].includes(s.codec_name));
  // return true;
}

const ffmpegExtractWindow = 60;
const calcShouldShowWaveform = (zoomedDuration) => (zoomedDuration != null && zoomedDuration < ffmpegExtractWindow * 8);
const calcShouldShowKeyframes = (zoomedDuration) => (zoomedDuration != null && zoomedDuration < ffmpegExtractWindow * 8);


const commonFormats = ['mov', 'mp4', 'matroska', 'mp3', 'ipod'];


// TODO flex
const topBarHeight = 32;
const timelineHeight = 36;
const zoomMax = 2 ** 14;

const videoStyle = { width: '100%', height: '100%', objectFit: 'contain' };


const queue = new PQueue({ concurrency: 1 });

const App = memo(() => {
  // Per project state
  const [framePath, setFramePath] = useState();
  const [waveform, setWaveform] = useState();
  const [html5FriendlyPath, setHtml5FriendlyPath] = useState();
  const [working, setWorking] = useState(false);
  const [dummyVideoPath, setDummyVideoPath] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [playerTime, setPlayerTime] = useState();
  const [duration, setDuration] = useState();
  const [fileFormat, setFileFormat] = useState();
  const [fileFormatData, setFileFormatData] = useState();
  const [detectedFileFormat, setDetectedFileFormat] = useState();
  const [rotation, setRotation] = useState(360);
  const [cutProgress, setCutProgress] = useState();
  const [startTimeOffset, setStartTimeOffset] = useState(0);
  const [rotationPreviewRequested, setRotationPreviewRequested] = useState(false);
  const [filePath, setFilePath] = useState('');
  const [externalStreamFiles, setExternalStreamFiles] = useState([]);
  const [detectedFps, setDetectedFps] = useState();
  const [mainStreams, setMainStreams] = useState([]);
  const [mainVideoStream, setMainVideoStream] = useState();
  const [mainAudioStream, setMainAudioStream] = useState();
  const [copyStreamIdsByFile, setCopyStreamIdsByFile] = useState({});
  const [streamsSelectorShown, setStreamsSelectorShown] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [commandedTime, setCommandedTime] = useState(0);
  const [ffmpegCommandLog, setFfmpegCommandLog] = useState([]);
  const [neighbouringFrames, setNeighbouringFrames] = useState([]);
  const [thumbnails, setThumbnails] = useState([]);
  const [shortestFlag, setShortestFlag] = useState(false);
  const [zoomWindowStartTime, setZoomWindowStartTime] = useState(0);

  const [keyframesEnabled, setKeyframesEnabled] = useState(true);
  const [waveformEnabled, setWaveformEnabled] = useState(false);
  const [thumbnailsEnabled, setThumbnailsEnabled] = useState(false);
  const [showSideBar, setShowSideBar] = useState(true);

  // Segment related state
  const [currentSegIndex, setCurrentSegIndex] = useState(0);
  const [cutStartTimeManual, setCutStartTimeManual] = useState();
  const [cutEndTimeManual, setCutEndTimeManual] = useState();
  const [cutSegments, setCutSegments, cutSegmentsHistory] = useStateWithHistory(
    createInitialCutSegments(),
    100,
  );
  const [debouncedCutSegments, setDebouncedCutSegments] = useState(
    createInitialCutSegments(),
  );

  const [, cancelCutSegmentsDebounce] = useDebounce(() => {
    setDebouncedCutSegments(cutSegments);
  }, 500, [cutSegments]);

  const durationSafe = duration || 1;
  const zoomedDuration = duration != null ? duration / zoom : undefined;

  // Preferences
  const [captureFormat, setCaptureFormat] = useState(configStore.get('captureFormat'));
  useEffect(() => configStore.set('captureFormat', captureFormat), [captureFormat]);
  const [customOutDir, setCustomOutDir] = useState(configStore.get('customOutDir'));
  useEffect(() => (customOutDir === undefined ? configStore.delete('customOutDir') : configStore.set('customOutDir', customOutDir)), [customOutDir]);
  const [keyframeCut, setKeyframeCut] = useState(configStore.get('keyframeCut'));
  useEffect(() => configStore.set('keyframeCut', keyframeCut), [keyframeCut]);
  const [autoMerge, setAutoMerge] = useState(configStore.get('autoMerge'));
  useEffect(() => configStore.set('autoMerge', autoMerge), [autoMerge]);
  const [timecodeShowFrames, setTimecodeShowFrames] = useState(configStore.get('timecodeShowFrames'));
  useEffect(() => configStore.set('timecodeShowFrames', timecodeShowFrames), [timecodeShowFrames]);
  const [invertCutSegments, setInvertCutSegments] = useState(configStore.get('invertCutSegments'));
  useEffect(() => configStore.set('invertCutSegments', invertCutSegments), [invertCutSegments]);
  const [autoExportExtraStreams, setAutoExportExtraStreams] = useState(configStore.get('autoExportExtraStreams'));
  useEffect(() => configStore.set('autoExportExtraStreams', autoExportExtraStreams), [autoExportExtraStreams]);
  const [askBeforeClose, setAskBeforeClose] = useState(configStore.get('askBeforeClose'));
  useEffect(() => configStore.set('askBeforeClose', askBeforeClose), [askBeforeClose]);
  const [muted, setMuted] = useState(configStore.get('muted'));
  useEffect(() => configStore.set('muted', muted), [muted]);
  const [autoSaveProjectFile, setAutoSaveProjectFile] = useState(configStore.get('autoSaveProjectFile'));
  useEffect(() => configStore.set('autoSaveProjectFile', autoSaveProjectFile), [autoSaveProjectFile]);

  // Global state
  const [helpVisible, setHelpVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [mifiLink, setMifiLink] = useState();

  const videoRef = useRef();
  const lastSavedCutSegmentsRef = useRef();
  const readingKeyframesPromise = useRef();
  const creatingWaveformPromise = useRef();
  const currentTimeRef = useRef();

  const isFileOpened = !!filePath;

  function setTimelineMode(newMode) {
    if (newMode === 'waveform') {
      setWaveformEnabled(v => !v);
      setThumbnailsEnabled(false);
    } else {
      setThumbnailsEnabled(v => !v);
      setWaveformEnabled(false);
    }
  }

  function appendFfmpegCommandLog(command) {
    setFfmpegCommandLog(old => [...old, { command, time: new Date() }]);
  }

  const getCurrentTime = useCallback(() => currentTimeRef.current, []);

  function setCopyStreamIdsForPath(path, cb) {
    setCopyStreamIdsByFile((old) => {
      const oldIds = old[path] || {};
      return ({ ...old, [path]: cb(oldIds) });
    });
  }

  const toggleSideBar = useCallback(() => setShowSideBar(v => !v), []);

  const toggleCopyStreamId = useCallback((path, index) => {
    setCopyStreamIdsForPath(path, (old) => ({ ...old, [index]: !old[index] }));
  }, []);

  function toggleMute() {
    setMuted((v) => {
      if (!v) toast.fire({ title: 'Muted preview (note that exported file will not be affected)' });
      return !v;
    });
  }

  const seekAbs = useCallback((val) => {
    const video = videoRef.current;
    if (val == null || Number.isNaN(val)) return;
    let valRounded = val;
    if (detectedFps) valRounded = Math.round(detectedFps * val) / detectedFps; // Round to nearest frame

    let outVal = valRounded;
    if (outVal < 0) outVal = 0;
    if (outVal > video.duration) outVal = video.duration;

    video.currentTime = outVal;
    setCommandedTime(outVal);
  }, [detectedFps]);

  const seekRel = useCallback((val) => {
    seekAbs(videoRef.current.currentTime + val);
  }, [seekAbs]);

  const seekRelPercent = useCallback((val) => {
    seekRel(val * zoomedDuration);
  }, [seekRel, zoomedDuration]);

  const shortStep = useCallback((dir) => {
    seekRel((1 / (detectedFps || 60)) * dir);
  }, [seekRel, detectedFps]);

  useEffect(() => () => {
    if (dummyVideoPath) unlink(dummyVideoPath).catch(console.error);
  }, [dummyVideoPath]);

  const zoomRel = useCallback((rel) => setZoom(z => Math.min(Math.max(z + rel, 1), zoomMax)), []);
  const frameRenderEnabled = !!(rotationPreviewRequested || dummyVideoPath);

  const comfortZoom = duration ? Math.max(duration / 100, 1) : undefined;
  const toggleComfortZoom = useCallback(() => {
    if (!comfortZoom) return;

    setZoom((prevZoom) => {
      if (prevZoom === 1) return comfortZoom;
      return 1;
    });
  }, [comfortZoom]);

  const getSegApparentEnd = useCallback((seg) => {
    const time = seg.end;
    if (time !== undefined) return time;
    if (duration !== undefined) return duration;
    return 0; // Haven't gotten duration yet
  }, [duration]);

  const apparentCutSegments = useMemo(() => cutSegments.map(cutSegment => ({
    ...cutSegment,
    start: getSegApparentStart(cutSegment),
    end: getSegApparentEnd(cutSegment),
  })), [cutSegments, getSegApparentEnd]);

  const invalidSegUuids = apparentCutSegments
    .filter(cutSegment => cutSegment.start >= cutSegment.end)
    .map(cutSegment => cutSegment.uuid);

  const haveInvalidSegs = invalidSegUuids.length > 0;

  const currentSegIndexSafe = Math.min(currentSegIndex, cutSegments.length - 1);
  const currentCutSeg = useMemo(() => cutSegments[currentSegIndexSafe], [currentSegIndexSafe, cutSegments]);
  const currentApparentCutSeg = useMemo(() => apparentCutSegments[currentSegIndexSafe], [apparentCutSegments, currentSegIndexSafe]);
  const areWeCutting = apparentCutSegments.length > 1
    || isCuttingStart(currentApparentCutSeg.start)
    || isCuttingEnd(currentApparentCutSeg.end, duration);

  const jumpCutStart = useCallback(() => seekAbs(currentApparentCutSeg.start), [currentApparentCutSeg.start, seekAbs]);
  const jumpCutEnd = useCallback(() => seekAbs(currentApparentCutSeg.end), [currentApparentCutSeg.end, seekAbs]);

  const sortedCutSegments = useMemo(() => sortBy(apparentCutSegments, 'start'), [apparentCutSegments]);

  const inverseCutSegments = useMemo(() => {
    if (haveInvalidSegs) return undefined;
    if (sortedCutSegments.length < 1) return undefined;

    const foundOverlap = sortedCutSegments.some((cutSegment, i) => {
      if (i === 0) return false;
      return sortedCutSegments[i - 1].end > cutSegment.start;
    });

    if (foundOverlap) return undefined;
    if (duration == null) return undefined;

    const ret = [];

    if (sortedCutSegments[0].start > 0) {
      ret.push({
        start: 0,
        end: sortedCutSegments[0].start,
      });
    }

    sortedCutSegments.forEach((cutSegment, i) => {
      if (i === 0) return;
      ret.push({
        start: sortedCutSegments[i - 1].end,
        end: cutSegment.start,
      });
    });

    const last = sortedCutSegments[sortedCutSegments.length - 1];
    if (last.end < duration) {
      ret.push({
        start: last.end,
        end: duration,
      });
    }

    return ret;
  }, [duration, haveInvalidSegs, sortedCutSegments]);

  const setCutTime = useCallback((type, time) => {
    const currentSeg = currentCutSeg;
    if (type === 'start' && time >= getSegApparentEnd(currentSeg)) {
      throw new Error('Start time must precede end time');
    }
    if (type === 'end' && time <= getSegApparentStart(currentSeg)) {
      throw new Error('Start time must precede end time');
    }
    const cloned = cloneDeep(cutSegments);
    cloned[currentSegIndexSafe][type] = Math.min(Math.max(time, 0), duration);
    setCutSegments(cloned);
  }, [
    currentSegIndexSafe, getSegApparentEnd, cutSegments, currentCutSeg, setCutSegments, duration,
  ]);

  const setCurrentSegmentName = useCallback((name) => {
    const cloned = cloneDeep(cutSegments);
    cloned[currentSegIndexSafe].name = name;
    setCutSegments(cloned);
  }, [currentSegIndexSafe, cutSegments, setCutSegments]);

  const updateCurrentSegOrder = useCallback((newOrder) => {
    const segAtNewIndex = cutSegments[newOrder];
    const segAtOldIndex = cutSegments[currentSegIndexSafe];
    const newSegments = [...cutSegments];
    // Swap indexes:
    newSegments[currentSegIndexSafe] = segAtNewIndex;
    newSegments[newOrder] = segAtOldIndex;
    setCutSegments(newSegments);
    setCurrentSegIndex(newOrder);
  }, [currentSegIndexSafe, cutSegments, setCutSegments]);

  const formatTimecode = useCallback((sec) => formatDuration({
    seconds: sec, fps: timecodeShowFrames ? detectedFps : undefined,
  }), [detectedFps, timecodeShowFrames]);

  const getFrameCount = useCallback((sec) => {
    if (detectedFps == null) return undefined;
    return Math.floor(sec * detectedFps);
  }, [detectedFps]);

  useEffect(() => {
    currentTimeRef.current = playing ? playerTime : commandedTime;
  }, [commandedTime, playerTime, playing]);

  // const getSafeCutTime = useCallback((cutTime, next) => ffmpeg.getSafeCutTime(neighbouringFrames, cutTime, next), [neighbouringFrames]);

  const addCutSegment = useCallback(() => {
    try {
      // Cannot add if prev seg is not finished
      if (currentCutSeg.start === undefined && currentCutSeg.end === undefined) return;

      const suggestedStart = currentTimeRef.current;
      /* if (keyframeCut) {
        const keyframeAlignedStart = getSafeCutTime(suggestedStart, true);
        if (keyframeAlignedStart != null) suggestedStart = keyframeAlignedStart;
      } */

      const cutSegmentsNew = [
        ...cutSegments,
        createSegment({ start: suggestedStart }),
      ];

      setCutSegments(cutSegmentsNew);
      setCurrentSegIndex(cutSegmentsNew.length - 1);
    } catch (err) {
      console.error(err);
    }
  }, [
    currentCutSeg.start, currentCutSeg.end, cutSegments, setCutSegments,
  ]);

  const setCutStart = useCallback(() => {
    // https://github.com/mifi/lossless-cut/issues/168
    // If we are after the end of the last segment in the timeline,
    // add a new segment that starts at playerTime
    if (currentCutSeg.end != null && currentTimeRef.current > currentCutSeg.end) {
      addCutSegment();
    } else {
      try {
        const startTime = currentTimeRef.current;
        /* if (keyframeCut) {
          const keyframeAlignedCutTo = getSafeCutTime(startTime, true);
          if (keyframeAlignedCutTo != null) startTime = keyframeAlignedCutTo;
        } */
        setCutTime('start', startTime);
      } catch (err) {
        errorToast(err.message);
      }
    }
  }, [setCutTime, currentCutSeg, addCutSegment]);

  const setCutEnd = useCallback(() => {
    try {
      const endTime = currentTimeRef.current;

      /* if (keyframeCut) {
        const keyframeAlignedCutTo = getSafeCutTime(endTime, false);
        if (keyframeAlignedCutTo != null) endTime = keyframeAlignedCutTo;
      } */
      setCutTime('end', endTime);
    } catch (err) {
      errorToast(err.message);
    }
  }, [setCutTime]);

  const setOutputDir = useCallback(async () => {
    const { filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    setCustomOutDir((filePaths && filePaths.length === 1) ? filePaths[0] : undefined);
  }, []);

  const effectiveFilePath = dummyVideoPath || html5FriendlyPath || filePath;
  const fileUri = effectiveFilePath ? filePathToUrl(effectiveFilePath) : '';


  const outputDir = getOutDir(customOutDir, filePath);

  const getEdlFilePath = useCallback((fp) => getOutPath(customOutDir, fp, 'llc-edl.csv'), [customOutDir]);
  const edlFilePath = getEdlFilePath(filePath);

  useEffect(() => {
    async function save() {
      if (!edlFilePath) return;

      try {
        if (!autoSaveProjectFile) return;

        // Initial state? don't save
        if (isEqual(cleanCutSegments(debouncedCutSegments),
          cleanCutSegments(createInitialCutSegments()))) return;

        /* if (lastSavedCutSegmentsRef.current
          && isEqual(cleanCutSegments(lastSavedCutSegmentsRef.current),
            cleanCutSegments(debouncedCutSegments))) {
          // console.log('Seg state didn\'t change, skipping save');
          return;
        } */

        await edlStoreSave(edlFilePath, debouncedCutSegments);
        lastSavedCutSegmentsRef.current = debouncedCutSegments;
      } catch (err) {
        errorToast('Failed to save CSV');
        console.error('Failed to save CSV', err);
      }
    }
    save();
  }, [debouncedCutSegments, edlFilePath, autoSaveProjectFile]);

  // 360 means we don't modify rotation
  const isRotationSet = rotation !== 360;
  const effectiveRotation = isRotationSet ? rotation : undefined;

  useEffect(() => {
    async function throttledRender() {
      if (queue.size < 2) {
        queue.add(async () => {
          if (!frameRenderEnabled) return;

          if (playerTime == null || !filePath) return;

          try {
            const framePathNew = await renderFrame(playerTime, filePath, effectiveRotation);
            setFramePath(framePathNew);
          } catch (err) {
            console.error(err);
          }
        });
      }

      await queue.onIdle();
    }

    throttledRender();
  }, [
    filePath, playerTime, frameRenderEnabled, effectiveRotation,
  ]);

  // Cleanup old
  useEffect(() => () => URL.revokeObjectURL(framePath), [framePath]);

  function onPlayingChange(val) {
    setPlaying(val);
    if (!val) {
      videoRef.current.playbackRate = 1;
      setCommandedTime(videoRef.current.currentTime);
    }
  }

  const onStopPlaying = useCallback(() => onPlayingChange(false), []);
  const onSartPlaying = useCallback(() => onPlayingChange(true), []);
  const onDurationChange = useCallback(e => setDuration(e.target.duration), []);

  const onTimeUpdate = useCallback((e) => {
    const { currentTime } = e.target;
    if (playerTime === currentTime) return;
    setRotationPreviewRequested(false); // Reset this
    setPlayerTime(currentTime);
  }, [playerTime]);

  const increaseRotation = useCallback(() => {
    setRotation((r) => (r + 90) % 450);
    setRotationPreviewRequested(true);
  }, []);

  const mergeFiles = useCallback(async ({ paths, allStreams }) => {
    try {
      setWorking(true);

      // console.log('merge', paths);
      await mergeAnyFiles({
        customOutDir, paths, allStreams,
      });
    } catch (err) {
      errorToast('Failed to merge files. Make sure they are all of the exact same format and codecs');
      console.error('Failed to merge files', err);
    } finally {
      setWorking(false);
    }
  }, [customOutDir]);

  const toggleCaptureFormat = useCallback(() => setCaptureFormat(f => (f === 'png' ? 'jpeg' : 'png')), []);
  const toggleKeyframeCut = useCallback(() => setKeyframeCut(val => !val), []);
  const toggleAutoMerge = useCallback(() => setAutoMerge(val => !val), []);

  const isCopyingStreamId = useCallback((path, streamId) => (
    !!(copyStreamIdsByFile[path] || {})[streamId]
  ), [copyStreamIdsByFile]);

  const copyAnyAudioTrack = mainStreams.some(stream => isCopyingStreamId(filePath, stream.index) && stream.codec_type === 'audio');

  // Streams that are not copy enabled by default
  const extraStreams = useMemo(() => mainStreams
    .filter((stream) => !defaultProcessedCodecTypes.includes(stream.codec_type)), [mainStreams]);

  // Extra streams that the user has not selected for copy
  const nonCopiedExtraStreams = useMemo(() => extraStreams
    .filter((stream) => !isCopyingStreamId(filePath, stream.index)), [extraStreams, filePath, isCopyingStreamId]);

  const exportExtraStreams = autoExportExtraStreams && nonCopiedExtraStreams.length > 0;

  const copyStreamIds = useMemo(() => Object.entries(copyStreamIdsByFile).map(([path, streamIdsMap]) => ({
    path,
    streamIds: Object.keys(streamIdsMap).filter(index => streamIdsMap[index]),
  })), [copyStreamIdsByFile]);

  const numStreamsToCopy = copyStreamIds
    .reduce((acc, { streamIds }) => acc + streamIds.length, 0);

  const numStreamsTotal = [
    ...mainStreams,
    ...flatMap(Object.values(externalStreamFiles), ({ streams }) => streams),
  ].length;

  const toggleStripAudio = useCallback(() => {
    setCopyStreamIdsForPath(filePath, (old) => {
      const newCopyStreamIds = { ...old };
      mainStreams.forEach((stream) => {
        if (stream.codec_type === 'audio') newCopyStreamIds[stream.index] = !copyAnyAudioTrack;
      });
      return newCopyStreamIds;
    });
  }, [copyAnyAudioTrack, filePath, mainStreams]);

  const removeCutSegment = useCallback(() => {
    if (cutSegments.length < 2) return;

    const cutSegmentsNew = [...cutSegments];
    cutSegmentsNew.splice(currentSegIndexSafe, 1);

    setCutSegments(cutSegmentsNew);
  }, [currentSegIndexSafe, cutSegments, setCutSegments]);

  const thumnailsRef = useRef([]);
  const thumnailsRenderingPromiseRef = useRef();

  function addThumbnail(thumbnail) {
    // console.log('Rendered thumbnail', thumbnail.url);
    setThumbnails(v => [...v, thumbnail]);
  }

  useEffect(() => {
    async function renderThumbnails() {
      if (!thumbnailsEnabled || thumnailsRenderingPromiseRef.current) return;

      try {
        setThumbnails([]);
        const promise = ffmpegRenderThumbnails({ filePath, from: zoomWindowStartTime, duration: zoomedDuration, onThumbnail: addThumbnail });
        thumnailsRenderingPromiseRef.current = promise;
        await promise;
      } catch (err) {
        console.error('Failed to render thumbnail', err);
      } finally {
        thumnailsRenderingPromiseRef.current = undefined;
      }
    }

    if (duration) renderThumbnails();
  }, [zoomedDuration, duration, filePath, zoomWindowStartTime, thumbnailsEnabled]);

  // Cleanup removed thumbnails
  useEffect(() => {
    thumnailsRef.current.forEach((thumbnail) => {
      if (!thumbnails.some(t => t.url === thumbnail.url)) URL.revokeObjectURL(thumbnail.url);
    });
    thumnailsRef.current = thumbnails;
  }, [thumbnails]);

  const [, cancelReadKeyframeDataDebounce] = useDebounce(() => {
    async function run() {
      // We still want to calculate keyframes even if not shouldShowKeyframes because maybe we want to step to closest keyframe
      if (!keyframesEnabled || !filePath || !mainVideoStream || commandedTime == null || readingKeyframesPromise.current) return;

      try {
        const promise = readFrames({ filePath, aroundTime: commandedTime, stream: mainVideoStream.index, window: ffmpegExtractWindow });
        readingKeyframesPromise.current = promise;
        const newFrames = await promise;
        // console.log(newFrames);
        setNeighbouringFrames(newFrames);
      } catch (err) {
        console.error('Failed to read keyframes', err);
      } finally {
        readingKeyframesPromise.current = undefined;
      }
    }
    run();
  }, 500, [keyframesEnabled, filePath, commandedTime, mainVideoStream]);

  const hasAudio = !!mainAudioStream;
  const hasVideo = !!mainVideoStream;
  const shouldShowKeyframes = keyframesEnabled && !!mainVideoStream && calcShouldShowKeyframes(zoomedDuration);
  const shouldShowWaveform = calcShouldShowWaveform(zoomedDuration);

  const [, cancelWaveformDataDebounce] = useDebounce(() => {
    async function run() {
      if (!filePath || !mainAudioStream || commandedTime == null || !shouldShowWaveform || !waveformEnabled || creatingWaveformPromise.current) return;
      try {
        const promise = renderWaveformPng({ filePath, aroundTime: commandedTime, window: ffmpegExtractWindow, color: waveformColor });
        creatingWaveformPromise.current = promise;
        const wf = await promise;
        setWaveform(wf);
      } catch (err) {
        console.error('Failed to render waveform', err);
      } finally {
        creatingWaveformPromise.current = undefined;
      }
    }

    run();
  }, 500, [filePath, commandedTime, zoomedDuration, waveformEnabled, mainAudioStream, shouldShowWaveform]);


  const resetState = useCallback(() => {
    const video = videoRef.current;
    setCommandedTime(0);
    video.currentTime = 0;
    video.playbackRate = 1;

    setFileNameTitle();
    setFramePath();
    setHtml5FriendlyPath();
    setDummyVideoPath();
    setWorking(false);
    setPlaying(false);
    setDuration();
    cutSegmentsHistory.go(0);
    cancelCutSegmentsDebounce(); // TODO auto save when loading new file/closing file
    setDebouncedCutSegments(createInitialCutSegments());
    setCutSegments(createInitialCutSegments()); // TODO this will cause two history items
    setCutStartTimeManual();
    setCutEndTimeManual();
    setFileFormat();
    setFileFormatData();
    setDetectedFileFormat();
    setRotation(360);
    setCutProgress();
    setStartTimeOffset(0);
    setRotationPreviewRequested(false);
    setFilePath(''); // Setting video src="" prevents memory leak in chromium
    setExternalStreamFiles([]);
    setDetectedFps();
    setMainStreams([]);
    setMainVideoStream();
    setMainAudioStream();
    setCopyStreamIdsByFile({});
    setStreamsSelectorShown(false);
    setZoom(1);
    setShortestFlag(false);
    setZoomWindowStartTime(0);

    setWaveform();
    cancelWaveformDataDebounce();

    setNeighbouringFrames([]);
    cancelReadKeyframeDataDebounce();

    setThumbnails([]);
  }, [cutSegmentsHistory, cancelCutSegmentsDebounce, setCutSegments, cancelWaveformDataDebounce, cancelReadKeyframeDataDebounce]);


  // Cleanup old
  useEffect(() => () => waveform && URL.revokeObjectURL(waveform.url), [waveform]);

  function showUnsupportedFileMessage() {
    toast.fire({ timer: 10000, icon: 'warning', title: 'This video is not natively supported', text: 'This means that there is no audio in the preview and it has low quality. The final export operation will however be lossless and contains audio!' });
  }

  const createDummyVideo = useCallback(async (fp) => {
    const html5ifiedDummyPathDummy = getOutPath(customOutDir, fp, 'html5ified-dummy.mkv');
    await html5ifyDummy(fp, html5ifiedDummyPathDummy);
    setDummyVideoPath(html5ifiedDummyPathDummy);
    setHtml5FriendlyPath();
    showUnsupportedFileMessage();
  }, [customOutDir]);

  const tryCreateDummyVideo = useCallback(async () => {
    try {
      if (working) return;
      setWorking(true);
      await createDummyVideo(filePath);
    } catch (err) {
      console.error(err);
      errorToast('Failed to playback this file. Try to convert to friendly format from the menu');
    } finally {
      setWorking(false);
    }
  }, [createDummyVideo, filePath, working]);

  const playCommand = useCallback(() => {
    if (!filePath) return;

    const video = videoRef.current;
    if (playing) {
      video.pause();
      return;
    }

    video.play().catch((err) => {
      console.error(err);
      if (err.name === 'NotSupportedError') {
        console.log('NotSupportedError, trying to create dummy');
        tryCreateDummyVideo(filePath);
      }
    });
  }, [playing, filePath, tryCreateDummyVideo]);

  const deleteSource = useCallback(async () => {
    if (!filePath) return;

    // eslint-disable-next-line no-alert
    if (working || !window.confirm(`Are you sure you want to move the source file to trash? ${filePath}`)) return;

    try {
      setWorking(true);

      await trash(filePath);
      if (html5FriendlyPath) await trash(html5FriendlyPath);
    } catch (err) {
      toast.fire({ icon: 'error', title: `Failed to trash source file: ${err.message}` });
    } finally {
      resetState();
    }
  }, [filePath, html5FriendlyPath, resetState, working]);

  const outSegments = useMemo(() => (invertCutSegments ? inverseCutSegments : apparentCutSegments),
    [invertCutSegments, inverseCutSegments, apparentCutSegments]);

  const cutClick = useCallback(async () => {
    if (working) {
      errorToast('I\'m busy');
      return;
    }

    if (haveInvalidSegs) {
      errorToast('Start time must be before end time');
      return;
    }

    if (numStreamsToCopy === 0) {
      errorToast('No tracks to export!');
      return;
    }

    if (!outSegments) {
      errorToast('No segments to export!');
      return;
    }

    if (outSegments.length < 1) {
      errorToast('No segments to export');
      return;
    }

    try {
      setWorking(true);

      const outFiles = await cutMultiple({
        customOutDir,
        filePath,
        outFormat: fileFormat,
        isOutFormatUserSelected: fileFormat !== detectedFileFormat,
        videoDuration: duration,
        rotation: effectiveRotation,
        copyStreamIds,
        keyframeCut,
        segments: outSegments,
        onProgress: setCutProgress,
        appendFfmpegCommandLog,
        shortestFlag,
      });

      if (outFiles.length > 1 && autoMerge) {
        setCutProgress(0); // TODO implement progress

        await autoMergeSegments({
          customOutDir,
          sourceFile: filePath,
          segmentPaths: outFiles,
        });
      }

      if (exportExtraStreams) {
        try {
          await extractStreams({
            filePath, customOutDir, streams: nonCopiedExtraStreams,
          });
        } catch (err) {
          console.error('Extra stream export failed', err);
        }
      }

      toast.fire({ timer: 5000, icon: 'success', title: `Export completed! Go to settings to view the ffmpeg commands that were executed. Output file(s) can be found at: ${outputDir}.${exportExtraStreams ? ' Extra unprocessable streams were exported to separate files.' : ''}` });
    } catch (err) {
      console.error('stdout:', err.stdout);
      console.error('stderr:', err.stderr);

      if (err.code === 1 || err.code === 'ENOENT') {
        toast.fire({ icon: 'error', title: `Whoops! ffmpeg was unable to export this video. Try one of the following before exporting again:\n1. Select a different output format from the ${fileFormat} button (matroska takes almost everything).\n2. Exclude unnecessary tracks\n3. Try "Normal cut" and "Keyframe cut"`, timer: 10000 });
        return;
      }

      showFfmpegFail(err);
    } finally {
      setWorking(false);
    }
  }, [
    effectiveRotation, outSegments,
    working, duration, filePath, keyframeCut, detectedFileFormat,
    autoMerge, customOutDir, fileFormat, haveInvalidSegs, copyStreamIds, numStreamsToCopy,
    exportExtraStreams, nonCopiedExtraStreams, outputDir, shortestFlag,
  ]);

  // TODO use ffmpeg to capture frame
  const capture = useCallback(async () => {
    if (!filePath) return;
    if (html5FriendlyPath || dummyVideoPath) {
      errorToast('Capture frame from this video not yet implemented');
      return;
    }
    try {
      const outPath = await captureFrame(customOutDir, filePath, videoRef.current, currentTimeRef.current, captureFormat);
      toast.fire({ icon: 'success', title: `Screenshot captured to: ${outPath}` });
    } catch (err) {
      console.error(err);
      errorToast('Failed to capture frame');
    }
  }, [filePath, captureFormat, customOutDir, html5FriendlyPath, dummyVideoPath]);

  const changePlaybackRate = useCallback((dir) => {
    const video = videoRef.current;
    if (!playing) {
      video.playbackRate = 0.5; // dir * 0.5;
      video.play();
    } else {
      const newRate = video.playbackRate + (dir * 0.15);
      video.playbackRate = clamp(newRate, 0.05, 16);
    }
  }, [playing]);

  const getHtml5ifiedPath = useCallback((fp, type) => getOutPath(customOutDir, fp, `html5ified-${type}.mp4`), [customOutDir]);

  const checkExistingHtml5FriendlyFile = useCallback(async (fp, speed) => {
    const existing = getHtml5ifiedPath(fp, speed);
    const ret = existing && await exists(existing);
    if (ret) {
      setHtml5FriendlyPath(existing);
      showUnsupportedFileMessage();
    }
    return ret;
  }, [getHtml5ifiedPath]);

  const loadEdlFile = useCallback(async (edlPath) => {
    try {
      const storedEdl = await edlStoreLoad(edlPath);
      const allRowsValid = storedEdl
        .every(row => row.start === undefined || row.end === undefined || row.start < row.end);

      if (!allRowsValid) {
        throw new Error('Invalid start or end values for one or more segments');
      }

      cutSegmentsHistory.go(0);
      setCutSegments(storedEdl.map(createSegment));
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('EDL load failed', err);
        errorToast(`Failed to load EDL file (${err.message})`);
      }
    }
  }, [cutSegmentsHistory, setCutSegments]);

  const load = useCallback(async (fp, html5FriendlyPathRequested) => {
    console.log('Load', { fp, html5FriendlyPathRequested });
    if (working) {
      errorToast('Tried to load file while busy');
      return;
    }

    resetState();

    setWorking(true);

    try {
      const fd = await getFormatData(fp);

      const ff = await getDefaultOutFormat(fp, fd);
      if (!ff) {
        errorToast('Unsupported file');
        return;
      }

      const { streams } = await getAllStreams(fp);
      // console.log('streams', streamsNew);
      setMainStreams(streams);
      setCopyStreamIdsForPath(fp, () => fromPairs(streams.map((stream) => [
        stream.index, defaultProcessedCodecTypes.includes(stream.codec_type),
      ])));

      const videoStream = streams.find(stream => stream.codec_type === 'video' && !['png'].includes(stream.codec_name));
      const audioStream = streams.find(stream => stream.codec_type === 'audio');
      setMainVideoStream(videoStream);
      setMainAudioStream(audioStream);
      if (videoStream) {
        const streamFps = getStreamFps(videoStream);
        if (streamFps != null) setDetectedFps(streamFps);
      }

      setFileNameTitle(fp);
      setFilePath(fp);
      setFileFormat(ff);
      setDetectedFileFormat(ff);
      setFileFormatData(fd);

      if (html5FriendlyPathRequested) {
        setHtml5FriendlyPath(html5FriendlyPathRequested);
        showUnsupportedFileMessage();
      } else if (
        !(await checkExistingHtml5FriendlyFile(fp, 'slow-audio') || await checkExistingHtml5FriendlyFile(fp, 'slow') || await checkExistingHtml5FriendlyFile(fp, 'fast'))
        && !doesPlayerSupportFile(streams)
      ) {
        await createDummyVideo(fp);
      }

      await loadEdlFile(getEdlFilePath(fp));
    } catch (err) {
      if (err.code === 1 || err.code === 'ENOENT') {
        console.error('ENOENT', err);
        errorToast('Unsupported file');
        return;
      }
      showFfmpegFail(err);
    } finally {
      setWorking(false);
    }
  }, [
    resetState, working, createDummyVideo, checkExistingHtml5FriendlyFile, loadEdlFile,
    getEdlFilePath,
  ]);

  const toggleHelp = useCallback(() => setHelpVisible(val => !val), []);
  const toggleSettings = useCallback(() => setSettingsVisible(val => !val), []);

  const jumpSeg = useCallback((val) => setCurrentSegIndex((old) => Math.max(Math.min(old + val, cutSegments.length - 1), 0)), [cutSegments.length]);

  const seekClosestKeyframe = useCallback((direction) => {
    const time = findNearestKeyFrameTime({ frames: neighbouringFrames, time: commandedTime, direction, fps: detectedFps });
    if (time == null) return;
    seekAbs(time);
  }, [commandedTime, neighbouringFrames, seekAbs, detectedFps]);

  useEffect(() => {
    Mousetrap.bind('space', () => playCommand());
    Mousetrap.bind('k', () => playCommand());
    Mousetrap.bind('j', () => changePlaybackRate(-1));
    Mousetrap.bind('l', () => changePlaybackRate(1));
    Mousetrap.bind('left', () => seekRel(-1));
    Mousetrap.bind('right', () => seekRel(1));
    Mousetrap.bind(['ctrl+left', 'command+left'], () => { seekRelPercent(-0.01); return false; });
    Mousetrap.bind(['ctrl+right', 'command+right'], () => { seekRelPercent(0.01); return false; });
    Mousetrap.bind('alt+left', () => seekClosestKeyframe(-1));
    Mousetrap.bind('alt+right', () => seekClosestKeyframe(1));
    Mousetrap.bind('up', () => jumpSeg(-1));
    Mousetrap.bind('down', () => jumpSeg(1));
    Mousetrap.bind(['ctrl+up', 'command+up'], () => { zoomRel(1); return false; });
    Mousetrap.bind(['ctrl+down', 'command+down'], () => { zoomRel(-1); return false; });
    Mousetrap.bind('z', () => toggleComfortZoom());
    Mousetrap.bind('.', () => shortStep(1));
    Mousetrap.bind(',', () => shortStep(-1));
    Mousetrap.bind('c', () => capture());
    Mousetrap.bind('e', () => cutClick());
    Mousetrap.bind('i', () => setCutStart());
    Mousetrap.bind('o', () => setCutEnd());
    Mousetrap.bind('h', () => toggleHelp());
    Mousetrap.bind('+', () => addCutSegment());
    Mousetrap.bind('backspace', () => removeCutSegment());
    Mousetrap.bind('d', () => deleteSource());

    return () => {
      Mousetrap.unbind('space');
      Mousetrap.unbind('k');
      Mousetrap.unbind('j');
      Mousetrap.unbind('l');
      Mousetrap.unbind('left');
      Mousetrap.unbind('right');
      Mousetrap.unbind(['ctrl+left', 'command+left']);
      Mousetrap.unbind(['ctrl+right', 'command+right']);
      Mousetrap.unbind('alt+left');
      Mousetrap.unbind('alt+right');
      Mousetrap.unbind('up');
      Mousetrap.unbind('down');
      Mousetrap.unbind(['ctrl+up', 'command+up']);
      Mousetrap.unbind(['ctrl+down', 'command+down']);
      Mousetrap.unbind('z');
      Mousetrap.unbind('.');
      Mousetrap.unbind(',');
      Mousetrap.unbind('c');
      Mousetrap.unbind('e');
      Mousetrap.unbind('i');
      Mousetrap.unbind('o');
      Mousetrap.unbind('h');
      Mousetrap.unbind('+');
      Mousetrap.unbind('backspace');
      Mousetrap.unbind('d');
    };
  }, [
    addCutSegment, capture, changePlaybackRate, cutClick, playCommand, removeCutSegment,
    setCutEnd, setCutStart, seekRel, seekRelPercent, shortStep, deleteSource, jumpSeg, toggleHelp,
    seekClosestKeyframe, zoomRel, toggleComfortZoom,
  ]);

  useEffect(() => {
    document.ondragover = dragPreventer;
    document.ondragend = dragPreventer;

    electron.ipcRenderer.send('renderer-ready');
  }, []);

  useEffect(() => {
    electron.ipcRenderer.send('setAskBeforeClose', askBeforeClose && isFileOpened);
  }, [askBeforeClose, isFileOpened]);

  const extractAllStreams = useCallback(async () => {
    if (!filePath) return;

    try {
      setWorking(true);
      await extractStreams({ customOutDir, filePath, streams: mainStreams });
      toast.fire({ icon: 'success', title: `All streams can be found as separate files at: ${outputDir}` });
    } catch (err) {
      errorToast('Failed to extract all streams');
      console.error('Failed to extract all streams', err);
    } finally {
      setWorking(false);
    }
  }, [customOutDir, filePath, mainStreams, outputDir]);

  function onExtractAllStreamsPress() {
    extractAllStreams();
  }

  const addStreamSourceFile = useCallback(async (path) => {
    if (externalStreamFiles[path]) return;
    const { streams } = await getAllStreams(path);
    const formatData = await getFormatData(path);
    // console.log('streams', streams);
    setExternalStreamFiles(old => ({ ...old, [path]: { streams, formatData } }));
    setCopyStreamIdsForPath(path, () => fromPairs(streams.map(({ index }) => [index, true])));
  }, [externalStreamFiles]);

  const userOpenFiles = useCallback(async (filePaths) => {
    if (filePaths.length < 1) return;
    if (filePaths.length > 1) {
      showMergeDialog(filePaths, mergeFiles);
      return;
    }

    const firstFile = filePaths[0];

    if (!isFileOpened) {
      load(firstFile);
      return;
    }
    const { value } = await Swal.fire({
      title: 'You opened a new file. What do you want to do?',
      icon: 'question',
      input: 'radio',
      inputValue: 'open',
      showCancelButton: true,
      inputOptions: {
        open: 'Open the file instead of the current one. You will lose all unsaved work',
        add: 'Include all tracks from the new file',
      },
      inputValidator: (v) => !v && 'You need to choose something!',
    });

    if (value === 'open') {
      load(firstFile);
    } else if (value === 'add') {
      addStreamSourceFile(firstFile);
      setStreamsSelectorShown(true);
    }
  }, [addStreamSourceFile, isFileOpened, load, mergeFiles]);

  const onDrop = useCallback(async (ev) => {
    ev.preventDefault();
    const { files } = ev.dataTransfer;
    const filePaths = Array.from(files).map(f => f.path);

    if (filePaths.length === 1 && filePaths[0].toLowerCase().endsWith('.csv')) {
      loadEdlFile(filePaths[0]);
      return;
    }
    userOpenFiles(filePaths);
  }, [userOpenFiles, loadEdlFile]);

  useEffect(() => {
    function fileOpened(event, filePaths) {
      userOpenFiles(filePaths);
    }

    function closeFile() {
      if (!isFileOpened) return;
      // eslint-disable-next-line no-alert
      if (askBeforeClose && !window.confirm('Are you sure you want to close the current file? You will lose all unsaved work')) return;

      resetState();
    }

    async function html5ify(event, speed) {
      if (!filePath) return;

      try {
        setWorking(true);
        if (['fast', 'slow', 'slow-audio'].includes(speed)) {
          const html5FriendlyPathNew = getHtml5ifiedPath(filePath, speed);
          const encodeVideo = ['slow', 'slow-audio'].includes(speed);
          const encodeAudio = speed === 'slow-audio';
          await ffmpegHtml5ify(filePath, html5FriendlyPathNew, encodeVideo, encodeAudio);
          load(filePath, html5FriendlyPathNew);
        } else {
          await createDummyVideo(filePath);
        }
      } catch (err) {
        errorToast('Failed to html5ify file');
        console.error('Failed to html5ify file', err);
      } finally {
        setWorking(false);
      }
    }

    function showOpenAndMergeDialog2() {
      showOpenAndMergeDialog({
        dialog,
        defaultPath: outputDir,
        onMergeClick: mergeFiles,
      });
    }

    async function setStartOffset() {
      const newStartTimeOffset = await promptTimeOffset(
        startTimeOffset !== undefined ? formatDuration({ seconds: startTimeOffset }) : undefined,
      );

      if (newStartTimeOffset === undefined) return;

      setStartTimeOffset(newStartTimeOffset);
    }

    function undo() {
      cutSegmentsHistory.back();
    }

    function redo() {
      cutSegmentsHistory.forward();
    }

    async function exportEdlFile() {
      try {
        const { canceled, filePath: fp } = await dialog.showSaveDialog({ defaultPath: `${new Date().getTime()}.csv`, filters: [{ name: 'CSV files', extensions: ['csv'] }] });
        if (canceled || !fp) return;
        if (await exists(fp)) {
          errorToast('File exists, bailing');
          return;
        }
        await edlStoreSave(fp, cutSegments);
      } catch (err) {
        errorToast('Failed to export CSV');
        console.error('Failed to export CSV', err);
      }
    }

    async function importEdlFile() {
      if (!isFileOpened) return;
      const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'CSV files', extensions: ['csv'] }] });
      if (canceled || filePaths.length < 1) return;
      await loadEdlFile(filePaths[0]);
    }

    function openHelp() {
      toggleHelp();
    }

    function openSettings() {
      toggleSettings();
    }

    electron.ipcRenderer.on('file-opened', fileOpened);
    electron.ipcRenderer.on('close-file', closeFile);
    electron.ipcRenderer.on('html5ify', html5ify);
    electron.ipcRenderer.on('show-merge-dialog', showOpenAndMergeDialog2);
    electron.ipcRenderer.on('set-start-offset', setStartOffset);
    electron.ipcRenderer.on('extract-all-streams', extractAllStreams);
    electron.ipcRenderer.on('undo', undo);
    electron.ipcRenderer.on('redo', redo);
    electron.ipcRenderer.on('importEdlFile', importEdlFile);
    electron.ipcRenderer.on('exportEdlFile', exportEdlFile);
    electron.ipcRenderer.on('openHelp', openHelp);
    electron.ipcRenderer.on('openSettings', openSettings);

    return () => {
      electron.ipcRenderer.removeListener('file-opened', fileOpened);
      electron.ipcRenderer.removeListener('close-file', closeFile);
      electron.ipcRenderer.removeListener('html5ify', html5ify);
      electron.ipcRenderer.removeListener('show-merge-dialog', showOpenAndMergeDialog2);
      electron.ipcRenderer.removeListener('set-start-offset', setStartOffset);
      electron.ipcRenderer.removeListener('extract-all-streams', extractAllStreams);
      electron.ipcRenderer.removeListener('undo', undo);
      electron.ipcRenderer.removeListener('redo', redo);
      electron.ipcRenderer.removeListener('importEdlFile', importEdlFile);
      electron.ipcRenderer.removeListener('exportEdlFile', exportEdlFile);
      electron.ipcRenderer.removeListener('openHelp', openHelp);
      electron.ipcRenderer.removeListener('openSettings', openSettings);
    };
  }, [
    load, mergeFiles, outputDir, filePath, isFileOpened, customOutDir, startTimeOffset, getHtml5ifiedPath,
    createDummyVideo, resetState, extractAllStreams, userOpenFiles, cutSegmentsHistory,
    loadEdlFile, cutSegments, edlFilePath, askBeforeClose, toggleHelp, toggleSettings,
  ]);

  async function showAddStreamSourceDialog() {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'] });
    if (canceled || filePaths.length < 1) return;
    await addStreamSourceFile(filePaths[0]);
  }

  useEffect(() => {
    document.body.addEventListener('drop', onDrop);
    return () => document.body.removeEventListener('drop', onDrop);
  }, [load, mergeFiles, onDrop]);


  const commonFormatsMap = useMemo(() => fromPairs(commonFormats.map(format => [format, allOutFormats[format]])
    .filter(([f]) => f !== detectedFileFormat)), [detectedFileFormat]);

  const otherFormatsMap = useMemo(() => fromPairs(Object.entries(allOutFormats)
    .filter(([f]) => ![...commonFormats, detectedFileFormat].includes(f))), [detectedFileFormat]);

  function renderFormatOptions(map) {
    return Object.entries(map).map(([f, name]) => (
      <option key={f} value={f}>{f} - {name}</option>
    ));
  }

  const renderOutFmt = useCallback((props) => (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <Select value={fileFormat || ''} title="Output format" onChange={withBlur(e => setFileFormat(e.target.value))} {...props}>
      <option key="disabled1" value="" disabled>Format</option>

      {detectedFileFormat && (
        <option key={detectedFileFormat} value={detectedFileFormat}>
          {detectedFileFormat} - {allOutFormats[detectedFileFormat]} (detected)
        </option>
      )}

      <option key="disabled2" value="" disabled>--- Common formats: ---</option>
      {renderFormatOptions(commonFormatsMap)}

      <option key="disabled3" value="" disabled>--- All formats: ---</option>
      {renderFormatOptions(otherFormatsMap)}
    </Select>
  ), [commonFormatsMap, detectedFileFormat, fileFormat, otherFormatsMap]);

  const renderCaptureFormatButton = useCallback((props) => (
    <Button
      title="Capture frame format"
      onClick={withBlur(toggleCaptureFormat)}
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...props}
    >
      {captureFormat}
    </Button>
  ), [captureFormat, toggleCaptureFormat]);

  const AutoExportToggler = useCallback(() => (
    <SegmentedControl
      options={[{ label: 'Extract', value: 'extract' }, { label: 'Discard', value: 'discard' }]}
      value={autoExportExtraStreams ? 'extract' : 'discard'}
      onChange={value => setAutoExportExtraStreams(value === 'extract')}
    />
  ), [autoExportExtraStreams]);

  const renderSettings = useCallback(() => (
    <Settings
      setOutputDir={setOutputDir}
      customOutDir={customOutDir}
      autoMerge={autoMerge}
      setAutoMerge={setAutoMerge}
      keyframeCut={keyframeCut}
      setKeyframeCut={setKeyframeCut}
      invertCutSegments={invertCutSegments}
      setInvertCutSegments={setInvertCutSegments}
      autoSaveProjectFile={autoSaveProjectFile}
      setAutoSaveProjectFile={setAutoSaveProjectFile}
      timecodeShowFrames={timecodeShowFrames}
      setTimecodeShowFrames={setTimecodeShowFrames}
      askBeforeClose={askBeforeClose}
      setAskBeforeClose={setAskBeforeClose}

      renderOutFmt={renderOutFmt}
      AutoExportToggler={AutoExportToggler}
      renderCaptureFormatButton={renderCaptureFormatButton}
    />
  ), [AutoExportToggler, askBeforeClose, autoMerge, autoSaveProjectFile, customOutDir, invertCutSegments, keyframeCut, renderCaptureFormatButton, renderOutFmt, timecodeShowFrames, setOutputDir]);

  useEffect(() => {
    loadMifiLink().then(setMifiLink);
  }, []);

  useEffect(() => {
    // Testing:
    // if (isDev) load('/Users/mifi/Downloads/inp.MOV');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const VolumeIcon = muted || dummyVideoPath ? FaVolumeMute : FaVolumeUp;

  useEffect(() => {
    const keyScrollPreventer = (e) => {
      // https://stackoverflow.com/questions/8916620/disable-arrow-key-scrolling-in-users-browser
      if (e.target === document.body && [32, 37, 38, 39, 40].indexOf(e.keyCode) > -1) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', keyScrollPreventer);
    return () => window.removeEventListener('keydown', keyScrollPreventer);
  }, []);

  const sideBarWidth = showSideBar ? 200 : 0;

  const bottomBarHeight = 96 + ((hasAudio && waveformEnabled) || (hasVideo && thumbnailsEnabled) ? timelineHeight : 0);

  const thumbnailsSorted = useMemo(() => sortBy(thumbnails, thumbnail => thumbnail.time), [thumbnails]);

  let timelineMode;
  if (thumbnailsEnabled) timelineMode = 'thumbnails';
  if (waveformEnabled) timelineMode = 'waveform';

  return (
    <div>
      <div className="no-user-select" style={{ background: controlsBackground, height: topBarHeight, display: 'flex', alignItems: 'center', padding: '0 5px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <SideSheet
          containerProps={{ style: { maxWidth: '100%' } }}
          position={Position.LEFT}
          isShown={streamsSelectorShown}
          onCloseComplete={() => setStreamsSelectorShown(false)}
        >
          <StreamsSelector
            mainFilePath={filePath}
            mainFileFormatData={fileFormatData}
            externalFiles={externalStreamFiles}
            setExternalFiles={setExternalStreamFiles}
            showAddStreamSourceDialog={showAddStreamSourceDialog}
            streams={mainStreams}
            isCopyingStreamId={isCopyingStreamId}
            toggleCopyStreamId={toggleCopyStreamId}
            setCopyStreamIdsForPath={setCopyStreamIdsForPath}
            onExtractAllStreamsPress={onExtractAllStreamsPress}
            areWeCutting={areWeCutting}
            shortestFlag={shortestFlag}
            setShortestFlag={setShortestFlag}
            nonCopiedExtraStreams={nonCopiedExtraStreams}
            AutoExportToggler={AutoExportToggler}
          />
        </SideSheet>

        <TopMenu
          filePath={filePath}
          height={topBarHeight}
          copyAnyAudioTrack={copyAnyAudioTrack}
          toggleStripAudio={toggleStripAudio}
          customOutDir={customOutDir}
          setOutputDir={setOutputDir}
          renderOutFmt={renderOutFmt}
          outSegments={outSegments}
          autoMerge={autoMerge}
          toggleAutoMerge={toggleAutoMerge}
          keyframeCut={keyframeCut}
          toggleKeyframeCut={toggleKeyframeCut}
          toggleHelp={toggleHelp}
          toggleSettings={toggleSettings}
          numStreamsToCopy={numStreamsToCopy}
          numStreamsTotal={numStreamsTotal}
          setStreamsSelectorShown={setStreamsSelectorShown}
        />
      </div>

      {!isFileOpened && (
        <div className="no-user-select" style={{ position: 'fixed', left: 0, right: 0, top: topBarHeight, bottom: bottomBarHeight, border: '2vmin dashed #252525', color: '#505050', margin: '5vmin', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', whiteSpace: 'nowrap' }}>
          <div style={{ fontSize: '9vmin' }}>DROP VIDEO(S)</div>

          {mifiLink && mifiLink.loadUrl && (
            <div style={{ position: 'relative', margin: '3vmin', width: '60vmin', height: '20vmin' }}>
              <iframe src={mifiLink.loadUrl} title="iframe" style={{ background: 'rgba(0,0,0,0)', border: 'none', pointerEvents: 'none', width: '100%', height: '100%', position: 'absolute' }} />
              {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus */}
              <div style={{ width: '100%', height: '100%', position: 'absolute', cursor: 'pointer' }} role="button" onClick={() => electron.shell.openExternal(mifiLink.targetUrl)} />
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {working && (
          <div style={{
            position: 'absolute', zIndex: 1, bottom: bottomBarHeight, top: topBarHeight, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', pointerEvents: 'none',
          }}
          >
            <motion.div
              style={{ background: primaryColor, boxShadow: `${primaryColor} 0px 0px 20px 25px`, borderRadius: 20, paddingBottom: 15, color: 'white', textAlign: 'center', fontSize: 14 }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
            >
              <div style={{ width: 150, height: 150 }}>
                <Lottie
                  options={{ loop: true, autoplay: true, animationData: loadingLottie }}
                  style={{ width: '170%', height: '130%', marginLeft: '-35%', marginTop: '-29%' }}
                />
              </div>

              <div style={{ marginTop: 10 }}>
                WORKING
              </div>

              {(cutProgress != null) && (
                <div style={{ marginTop: 10 }}>
                  {`${Math.floor(cutProgress * 100)} %`}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="no-user-select" style={{ position: 'absolute', top: topBarHeight, left: 0, right: sideBarWidth, bottom: bottomBarHeight }}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          muted={muted}
          ref={videoRef}
          style={videoStyle}
          src={fileUri}
          onPlay={onSartPlaying}
          onPause={onStopPlaying}
          onDurationChange={onDurationChange}
          onTimeUpdate={onTimeUpdate}
        />

        {framePath && frameRenderEnabled && (
          <img
            draggable={false}
            style={{
              width: '100%', height: '100%', objectFit: 'contain', left: 0, right: 0, top: 0, bottom: 0, position: 'absolute', background: 'black',
            }}
            src={framePath}
            alt=""
          />
        )}
      </div>

      {rotationPreviewRequested && (
        <div style={{
          position: 'absolute', top: topBarHeight, marginTop: '1em', marginRight: '1em', right: sideBarWidth, color: 'white',
        }}
        >
          Lossless rotation preview
        </div>
      )}

      {isFileOpened && (
        <Fragment>
          <div
            className="no-user-select"
            style={{
              position: 'absolute', right: sideBarWidth, bottom: bottomBarHeight, color: 'rgba(255,255,255,0.7)',
            }}
          >
            <VolumeIcon
              title="Mute preview? (will not affect output)"
              size={30}
              role="button"
              style={{ margin: '0 10px 10px 10px' }}
              onClick={toggleMute}
            />

            {!showSideBar && (
              <FaAngleLeft
                title="Show sidebar"
                size={30}
                role="button"
                style={{ margin: '0 10px 10px 10px' }}
                onClick={toggleSideBar}
              />
            )}
          </div>

          <AnimatePresence>
            {showSideBar && (
              <motion.div
                style={{ position: 'absolute', width: sideBarWidth, right: 0, bottom: bottomBarHeight, top: topBarHeight, background: controlsBackground, color: 'rgba(255,255,255,0.7)', display: 'flex', flexDirection: 'column' }}
                initial={{ x: sideBarWidth }}
                animate={{ x: 0 }}
                exit={{ x: sideBarWidth }}
              >
                <SegmentList
                  currentSegIndex={currentSegIndexSafe}
                  cutSegments={outSegments}
                  getFrameCount={getFrameCount}
                  formatTimecode={formatTimecode}
                  invertCutSegments={invertCutSegments}
                  onSegClick={setCurrentSegIndex}
                  updateCurrentSegOrder={updateCurrentSegOrder}
                  setCurrentSegmentName={setCurrentSegmentName}
                  currentCutSeg={currentCutSeg}
                  addCutSegment={addCutSegment}
                  removeCutSegment={removeCutSegment}
                  toggleSideBar={toggleSideBar}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </Fragment>
      )}

      <motion.div
        className="no-user-select"
        style={{ background: controlsBackground, position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
        animate={{ height: bottomBarHeight }}
      >
        <Timeline
          shouldShowKeyframes={shouldShowKeyframes}
          waveform={waveform}
          shouldShowWaveform={shouldShowWaveform}
          waveformEnabled={waveformEnabled}
          thumbnailsEnabled={thumbnailsEnabled}
          neighbouringFrames={neighbouringFrames}
          thumbnails={thumbnailsSorted}
          getCurrentTime={getCurrentTime}
          startTimeOffset={startTimeOffset}
          playerTime={playerTime}
          commandedTime={commandedTime}
          zoom={zoom}
          seekAbs={seekAbs}
          seekRel={seekRel}
          zoomRel={zoomRel}
          duration={duration}
          durationSafe={durationSafe}
          apparentCutSegments={apparentCutSegments}
          setCurrentSegIndex={setCurrentSegIndex}
          currentSegIndexSafe={currentSegIndexSafe}
          invertCutSegments={invertCutSegments}
          inverseCutSegments={inverseCutSegments}
          mainVideoStream={mainVideoStream}
          formatTimecode={formatTimecode}
          timelineHeight={timelineHeight}
          onZoomWindowStartTimeChange={setZoomWindowStartTime}
        />

        <TimelineControls
          seekAbs={seekAbs}
          currentSegIndexSafe={currentSegIndexSafe}
          cutSegments={cutSegments}
          currentCutSeg={currentCutSeg}
          setCutStart={setCutStart}
          setCutEnd={setCutEnd}
          setCurrentSegIndex={setCurrentSegIndex}
          cutStartTimeManual={cutStartTimeManual}
          setCutStartTimeManual={setCutStartTimeManual}
          cutEndTimeManual={cutEndTimeManual}
          setCutEndTimeManual={setCutEndTimeManual}
          duration={durationSafe}
          jumpCutEnd={jumpCutEnd}
          jumpCutStart={jumpCutStart}
          startTimeOffset={startTimeOffset}
          setCutTime={setCutTime}
          currentApparentCutSeg={currentApparentCutSeg}
          playing={playing}
          shortStep={shortStep}
          seekClosestKeyframe={seekClosestKeyframe}
          playCommand={playCommand}
          setTimelineMode={setTimelineMode}
          timelineMode={timelineMode}
          hasAudio={hasAudio}
          hasVideo={hasVideo}
          keyframesEnabled={keyframesEnabled}
          setKeyframesEnabled={setKeyframesEnabled}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <LeftMenu
            zoom={zoom}
            setZoom={setZoom}
            invertCutSegments={invertCutSegments}
            setInvertCutSegments={setInvertCutSegments}
          />

          <RightMenu
            isRotationSet={isRotationSet}
            rotation={rotation}
            areWeCutting={areWeCutting}
            increaseRotation={increaseRotation}
            deleteSource={deleteSource}
            renderCaptureFormatButton={renderCaptureFormatButton}
            capture={capture}
            cutClick={cutClick}
            multipleCutSegments={cutSegments.length > 1}
          />
        </div>
      </motion.div>

      <HelpSheet
        visible={helpVisible}
        onTogglePress={toggleHelp}
        ffmpegCommandLog={ffmpegCommandLog}
      />

      <SettingsSheet
        visible={settingsVisible}
        onTogglePress={toggleSettings}
        renderSettings={renderSettings}
      />
    </div>
  );
});

export default App;
