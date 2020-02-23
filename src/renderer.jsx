import React, { memo, useEffect, useState, useCallback, useRef, Fragment, useMemo } from 'react';
import { IoIosHelpCircle, IoIosCamera } from 'react-icons/io';
import { FaHandPointRight, FaHandPointLeft, FaTrashAlt, FaVolumeMute, FaVolumeUp, FaYinYang, FaFileExport } from 'react-icons/fa';
import { MdRotate90DegreesCcw, MdCallSplit, MdCallMerge } from 'react-icons/md';
import { FiScissors } from 'react-icons/fi';
import { AnimatePresence, motion } from 'framer-motion';
import Swal from 'sweetalert2';
import Lottie from 'react-lottie';
import { SideSheet, Button, Position, Table, SegmentedControl, Checkbox, Select } from 'evergreen-ui';
import { useStateWithHistory } from 'react-use/lib/useStateWithHistory';
import useDebounce from 'react-use/lib/useDebounce';

import fromPairs from 'lodash/fromPairs';
import clamp from 'lodash/clamp';
import cloneDeep from 'lodash/cloneDeep';
import sortBy from 'lodash/sortBy';
import flatMap from 'lodash/flatMap';
import isEqual from 'lodash/isEqual';

import HelpSheet from './HelpSheet';
import SegmentList from './SegmentList';
import TimelineSeg from './TimelineSeg';
import InverseCutSegment from './InverseCutSegment';
import StreamsSelector from './StreamsSelector';
import { loadMifiLink } from './mifi';
import { primaryColor, controlsBackground, timelineBackground } from './colors';

import loadingLottie from './7077-magic-flow.json';


const isDev = require('electron-is-dev');
const electron = require('electron'); // eslint-disable-line
const Mousetrap = require('mousetrap');
const Hammer = require('react-hammerjs').default;
const trash = require('trash');
const uuid = require('uuid');

const ReactDOM = require('react-dom');
const { default: PQueue } = require('p-queue');
const { unlink, exists } = require('fs-extra');


const { showMergeDialog, showOpenAndMergeDialog } = require('./merge/merge');
const allOutFormats = require('./outFormats');
const captureFrame = require('./capture-frame');
const ffmpeg = require('./ffmpeg');
const configStore = require('./store');
const edlStore = require('./edlStore');

const {
  defaultProcessedCodecTypes, getStreamFps, isCuttingStart, isCuttingEnd,
  getDefaultOutFormat, getFormatData,
} = ffmpeg;


const {
  getOutPath, parseDuration, formatDuration, toast, errorToast, showFfmpegFail, setFileNameTitle,
  promptTimeOffset, generateColor, getOutDir,
} = require('./util');

const { dialog } = electron.remote;

function withBlur(cb) {
  return (e) => {
    cb(e);
    e.target.blur();
  };
}

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


const dragPreventer = ev => {
  ev.preventDefault();
};

function doesPlayerSupportFile(streams) {
  // TODO improve, whitelist supported codecs instead
  return !streams.find(s => ['hevc', 'prores'].includes(s.codec_name));
  // return true;
}

const queue = new PQueue({ concurrency: 1 });

const App = memo(() => {
  // Per project state
  const [framePath, setFramePath] = useState();
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
  const [copyStreamIdsByFile, setCopyStreamIdsByFile] = useState({});
  const [streamsSelectorShown, setStreamsSelectorShown] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [commandedTime, setCommandedTime] = useState(0);
  const [debouncedCommandedTime, setDebouncedCommandedTime] = useState(0);
  const [ffmpegCommandLog, setFfmpegCommandLog] = useState([]);
  const [neighbouringFrames, setNeighbouringFrames] = useState([]);
  const [shortestFlag, setShortestFlag] = useState(false);

  // Segment related state
  const [currentSegIndex, setCurrentSegIndex] = useState(0);
  const [cutStartTimeManual, setCutStartTimeManual] = useState();
  const [cutEndTimeManual, setCutEndTimeManual] = useState();
  const [cutSegments, setCutSegments, cutSegmentsHistory] = useStateWithHistory(
    createInitialCutSegments(),
    100,
  );

  const [, cancelCommandedTimeDebounce] = useDebounce(() => {
    setDebouncedCommandedTime(commandedTime);
  }, 300, [commandedTime]);


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
  const [mifiLink, setMifiLink] = useState();

  const videoRef = useRef();
  const timelineWrapperRef = useRef();
  const timelineScrollerRef = useRef();
  const timelineScrollerSkipEventRef = useRef();
  const lastSavedCutSegmentsRef = useRef();
  const readingKeyframesPromise = useRef();


  function appendFfmpegCommandLog(command) {
    setFfmpegCommandLog(old => [...old, { command, time: new Date() }]);
  }

  function setCopyStreamIdsForPath(path, cb) {
    setCopyStreamIdsByFile((old) => {
      const oldIds = old[path] || {};
      return ({ ...old, [path]: cb(oldIds) });
    });
  }

  function toggleCopyStreamId(path, index) {
    setCopyStreamIdsForPath(path, (old) => ({ ...old, [index]: !old[index] }));
  }

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

  const shortStep = useCallback((dir) => {
    seekRel((1 / (detectedFps || 60)) * dir);
  }, [seekRel, detectedFps]);

  const resetState = useCallback(() => {
    const video = videoRef.current;
    cancelCommandedTimeDebounce();
    setDebouncedCommandedTime(0);
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
    setCopyStreamIdsByFile({});
    setStreamsSelectorShown(false);
    setZoom(1);
    setNeighbouringFrames([]);
    setShortestFlag(false);
  }, [cutSegmentsHistory, setCutSegments, cancelCommandedTimeDebounce]);

  useEffect(() => () => {
    if (dummyVideoPath) unlink(dummyVideoPath).catch(console.error);
  }, [dummyVideoPath]);

  const frameRenderEnabled = !!(rotationPreviewRequested || dummyVideoPath);

  // Because segments could have undefined start / end
  // (meaning extend to start of timeline or end duration)
  function getSegApparentStart(seg) {
    const time = seg.start;
    return time !== undefined ? time : 0;
  }

  const getSegApparentEnd = useCallback((seg) => {
    const time = seg.end;
    if (time !== undefined) return time;
    if (duration !== undefined) return duration;
    return 0; // Haven't gotten duration yet
  }, [duration]);

  const cleanCutSegments = (cs) => cs.map((seg) => ({
    start: seg.start,
    end: seg.end,
    name: seg.name,
  }));

  const apparentCutSegments = cutSegments.map(cutSegment => ({
    ...cutSegment,
    start: getSegApparentStart(cutSegment),
    end: getSegApparentEnd(cutSegment),
  }));

  const invalidSegUuids = apparentCutSegments
    .filter(cutSegment => cutSegment.start >= cutSegment.end)
    .map(cutSegment => cutSegment.uuid);

  const haveInvalidSegs = invalidSegUuids.length > 0;

  const currentSegIndexSafe = Math.min(currentSegIndex, cutSegments.length - 1);
  const currentCutSeg = cutSegments[currentSegIndexSafe];
  const currentApparentCutSeg = apparentCutSegments[currentSegIndexSafe];
  const areWeCutting = apparentCutSegments.length > 1
    || isCuttingStart(currentApparentCutSeg.start)
    || isCuttingEnd(currentApparentCutSeg.end, duration);

  const sortedCutSegments = sortBy(apparentCutSegments, 'start');

  const inverseCutSegments = (() => {
    if (haveInvalidSegs) return undefined;
    if (apparentCutSegments.length < 1) return undefined;

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
  })();

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

  const setCurrentSegmentName = (name) => {
    const cloned = cloneDeep(cutSegments);
    cloned[currentSegIndexSafe].name = name;
    setCutSegments(cloned);
  };

  const updateCurrentSegOrder = (newOrder) => {
    const segAtNewIndex = cutSegments[newOrder];
    const segAtOldIndex = cutSegments[currentSegIndexSafe];
    const newSegments = [...cutSegments];
    // Swap indexes:
    newSegments[currentSegIndexSafe] = segAtNewIndex;
    newSegments[newOrder] = segAtOldIndex;
    setCutSegments(newSegments);
    setCurrentSegIndex(newOrder);
  };

  const formatTimecode = useCallback((sec) => formatDuration({
    seconds: sec, fps: timecodeShowFrames ? detectedFps : undefined,
  }), [detectedFps, timecodeShowFrames]);

  const getFrameCount = useCallback((sec) => {
    if (detectedFps == null) return undefined;
    return Math.floor(sec * detectedFps);
  }, [detectedFps]);

  const getCurrentTime = useCallback(() => (
    playing ? playerTime : commandedTime), [commandedTime, playerTime, playing]);

  // const getNextPrevKeyframe = useCallback((cutTime, next) => ffmpeg.getNextPrevKeyframe(neighbouringFrames, cutTime, next), [neighbouringFrames]);

  const addCutSegment = useCallback(() => {
    try {
      // Cannot add if prev seg is not finished
      if (currentCutSeg.start === undefined && currentCutSeg.end === undefined) return;

      const suggestedStart = getCurrentTime();
      /* if (keyframeCut) {
        const keyframeAlignedStart = getNextPrevKeyframe(suggestedStart, true);
        if (keyframeAlignedStart != null) suggestedStart = keyframeAlignedStart;
      } */

      let suggestedEnd = suggestedStart + 10;
      if (suggestedEnd >= duration) {
        suggestedEnd = undefined;
      } /* else if (keyframeCut) {
        const keyframeAlignedEnd = getNextPrevKeyframe(suggestedEnd, false);
        if (keyframeAlignedEnd != null) suggestedEnd = keyframeAlignedEnd;
      } */

      const cutSegmentsNew = [
        ...cutSegments,
        createSegment({
          start: suggestedStart,
          end: suggestedEnd,
        }),
      ];

      setCutSegments(cutSegmentsNew);
      setCurrentSegIndex(cutSegmentsNew.length - 1);
    } catch (err) {
      console.error(err);
    }
  }, [
    currentCutSeg.start, currentCutSeg.end, cutSegments, getCurrentTime, duration, setCutSegments,
  ]);

  const setCutStart = useCallback(() => {
    // https://github.com/mifi/lossless-cut/issues/168
    // If we are after the end of the last segment in the timeline,
    // add a new segment that starts at playerTime
    if (currentCutSeg.end != null && getCurrentTime() > currentCutSeg.end) {
      addCutSegment();
    } else {
      try {
        const startTime = getCurrentTime();
        /* if (keyframeCut) {
          const keyframeAlignedCutTo = getNextPrevKeyframe(startTime, true);
          if (keyframeAlignedCutTo != null) startTime = keyframeAlignedCutTo;
        } */
        setCutTime('start', startTime);
      } catch (err) {
        errorToast(err.message);
      }
    }
  }, [setCutTime, getCurrentTime, currentCutSeg, addCutSegment]);

  const setCutEnd = useCallback(() => {
    try {
      const endTime = getCurrentTime();

      /* if (keyframeCut) {
        const keyframeAlignedCutTo = getNextPrevKeyframe(endTime, false);
        if (keyframeAlignedCutTo != null) endTime = keyframeAlignedCutTo;
      } */
      setCutTime('end', endTime);
    } catch (err) {
      errorToast(err.message);
    }
  }, [setCutTime, getCurrentTime]);

  async function setOutputDir() {
    const { filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    setCustomOutDir((filePaths && filePaths.length === 1) ? filePaths[0] : undefined);
  }

  const fileUri = (dummyVideoPath || html5FriendlyPath || filePath || '').replace(/#/g, '%23');

  const outputDir = getOutDir(customOutDir, filePath);

  const getEdlFilePath = useCallback((fp) => getOutPath(customOutDir, fp, 'llc-edl.csv'), [customOutDir]);
  const edlFilePath = getEdlFilePath(filePath);

  useEffect(() => {
    async function save() {
      if (!edlFilePath) return;

      try {
        if (!autoSaveProjectFile) return;

        // Initial state? don't save
        if (isEqual(cleanCutSegments(cutSegments),
          cleanCutSegments(createInitialCutSegments()))) return;

        if (lastSavedCutSegmentsRef.current
          && isEqual(cleanCutSegments(lastSavedCutSegmentsRef.current),
            cleanCutSegments(cutSegments))) {
          // console.log('Seg state didn\'t change, skipping save');
          return;
        }

        await edlStore.save(edlFilePath, cutSegments);
        lastSavedCutSegmentsRef.current = cutSegments;
      } catch (err) {
        errorToast('Failed to save CSV');
        console.error('Failed to save CSV', err);
      }
    }
    save();
  }, [cutSegments, edlFilePath, autoSaveProjectFile]);

  // 360 means we don't modify rotation
  const isRotationSet = rotation !== 360;
  const effectiveRotation = isRotationSet ? rotation : undefined;
  const rotationStr = `${rotation}°`;

  useEffect(() => {
    async function throttledRender() {
      if (queue.size < 2) {
        queue.add(async () => {
          if (!frameRenderEnabled) return;

          if (playerTime == null || !filePath) return;

          try {
            const framePathNew = await ffmpeg.renderFrame(playerTime, filePath, effectiveRotation);
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

  // Cleanup old frames
  useEffect(() => () => URL.revokeObjectURL(framePath), [framePath]);

  function onPlayingChange(val) {
    setPlaying(val);
    if (!val) {
      videoRef.current.playbackRate = 1;
      setCommandedTime(videoRef.current.currentTime);
    }
  }

  function onTimeUpdate(e) {
    const { currentTime } = e.target;
    if (playerTime === currentTime) return;
    setRotationPreviewRequested(false); // Reset this
    setPlayerTime(currentTime);
  }

  function increaseRotation() {
    setRotation((r) => (r + 90) % 450);
    setRotationPreviewRequested(true);
  }

  const offsetCurrentTime = (getCurrentTime() || 0) + startTimeOffset;

  const mergeFiles = useCallback(async ({ paths, allStreams }) => {
    try {
      setWorking(true);

      // console.log('merge', paths);
      await ffmpeg.mergeAnyFiles({
        customOutDir, paths, allStreams,
      });
    } catch (err) {
      errorToast('Failed to merge files. Make sure they are all of the exact same format and codecs');
      console.error('Failed to merge files', err);
    } finally {
      setWorking(false);
    }
  }, [customOutDir]);

  const toggleCaptureFormat = () => setCaptureFormat(f => (f === 'png' ? 'jpeg' : 'png'));
  const toggleKeyframeCut = () => setKeyframeCut(val => !val);
  const toggleAutoMerge = () => setAutoMerge(val => !val);

  const isCopyingStreamId = useCallback((path, streamId) => (
    !!(copyStreamIdsByFile[path] || {})[streamId]
  ), [copyStreamIdsByFile]);

  const copyAnyAudioTrack = mainStreams.some(stream => isCopyingStreamId(filePath, stream.index) && stream.codec_type === 'audio');

  // Streams that are not copy enabled by default
  const extraStreams = mainStreams
    .filter((stream) => !defaultProcessedCodecTypes.includes(stream.codec_type));

  // Extra streams that the user has not selected for copy
  const nonCopiedExtraStreams = extraStreams
    .filter((stream) => !isCopyingStreamId(filePath, stream.index));

  const exportExtraStreams = autoExportExtraStreams && nonCopiedExtraStreams.length > 0;

  const copyStreamIds = Object.entries(copyStreamIdsByFile).map(([path, streamIdsMap]) => ({
    path,
    streamIds: Object.keys(streamIdsMap).filter(index => streamIdsMap[index]),
  }));

  const numStreamsToCopy = copyStreamIds
    .reduce((acc, { streamIds }) => acc + streamIds.length, 0);

  const numStreamsTotal = [
    ...mainStreams,
    ...flatMap(Object.values(externalStreamFiles), ({ streams }) => streams),
  ].length;

  function toggleStripAudio() {
    setCopyStreamIdsForPath(filePath, (old) => {
      const newCopyStreamIds = { ...old };
      mainStreams.forEach((stream) => {
        if (stream.codec_type === 'audio') newCopyStreamIds[stream.index] = !copyAnyAudioTrack;
      });
      return newCopyStreamIds;
    });
  }

  const removeCutSegment = useCallback(() => {
    if (cutSegments.length < 2) return;

    const cutSegmentsNew = [...cutSegments];
    cutSegmentsNew.splice(currentSegIndexSafe, 1);

    setCutSegments(cutSegmentsNew);
  }, [currentSegIndexSafe, cutSegments, setCutSegments]);

  const jumpCutStart = () => seekAbs(currentApparentCutSeg.start);
  const jumpCutEnd = () => seekAbs(currentApparentCutSeg.end);

  function handleTap(e) {
    const target = timelineWrapperRef.current;
    const rect = target.getBoundingClientRect();
    const relX = e.srcEvent.pageX - (rect.left + document.body.scrollLeft);
    if (duration) seekAbs((relX / target.offsetWidth) * duration);
  }

  const durationSafe = duration || 1;
  const currentTimeWidth = 1;
  // Prevent it from overflowing (and causing scroll) when end of timeline

  const calculateTimelinePos = (time) => (time !== undefined && time < durationSafe ? `${(time / durationSafe) * 100}%` : undefined);
  const currentTimePos = calculateTimelinePos(playerTime);
  const commandedTimePos = calculateTimelinePos(commandedTime);

  const zoomed = zoom > 1;

  useEffect(() => {
    const { currentTime } = videoRef.current;
    timelineScrollerSkipEventRef.current = true;
    if (zoom > 1) {
      timelineScrollerRef.current.scrollLeft = (currentTime / durationSafe)
        * (timelineWrapperRef.current.offsetWidth - timelineScrollerRef.current.offsetWidth);
    }
  }, [zoom, durationSafe]);

  function onTimelineScroll(e) {
    if (timelineScrollerSkipEventRef.current) {
      timelineScrollerSkipEventRef.current = false;
      return;
    }
    if (!zoomed) return;
    seekAbs((((e.target.scrollLeft + (timelineScrollerRef.current.offsetWidth / 2))
      / timelineWrapperRef.current.offsetWidth) * duration));
  }

  function onWheel(e) {
    if (!zoomed) seekRel((e.deltaX + e.deltaY) / 15);
  }

  function showUnsupportedFileMessage() {
    toast.fire({ timer: 10000, icon: 'warning', title: 'This video is not natively supported', text: 'This means that there is no audio in the preview and it has low quality. The final export operation will however be lossless and contains audio!' });
  }

  const createDummyVideo = useCallback(async (fp) => {
    const html5ifiedDummyPathDummy = getOutPath(customOutDir, fp, 'html5ified-dummy.mkv');
    await ffmpeg.html5ifyDummy(fp, html5ifiedDummyPathDummy);
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
    const video = videoRef.current;
    if (playing) return video.pause();

    return video.play().catch((err) => {
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

    const ffmpegSegments = outSegments.map((seg) => ({
      cutFrom: seg.start,
      cutTo: seg.end,
    }));

    if (outSegments.length < 1) {
      errorToast('No segments to export');
      return;
    }

    try {
      setWorking(true);

      const outFiles = await ffmpeg.cutMultiple({
        customOutDir,
        filePath,
        outFormat: fileFormat,
        isOutFormatUserSelected: fileFormat !== detectedFileFormat,
        videoDuration: duration,
        rotation: effectiveRotation,
        copyStreamIds,
        keyframeCut,
        segments: ffmpegSegments,
        onProgress: setCutProgress,
        appendFfmpegCommandLog,
        shortestFlag,
      });

      if (outFiles.length > 1 && autoMerge) {
        setCutProgress(0); // TODO implement progress

        await ffmpeg.autoMergeSegments({
          customOutDir,
          sourceFile: filePath,
          segmentPaths: outFiles,
        });
      }

      if (exportExtraStreams) {
        try {
          await ffmpeg.extractStreams({
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
      await captureFrame(customOutDir, filePath, videoRef.current, playerTime, captureFormat);
    } catch (err) {
      console.error(err);
      errorToast('Failed to capture frame');
    }
  }, [filePath, playerTime, captureFormat, customOutDir, html5FriendlyPath, dummyVideoPath]);

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
      const storedEdl = await edlStore.load(edlPath);
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

      const { streams } = await ffmpeg.getAllStreams(fp);
      // console.log('streams', streamsNew);
      setMainStreams(streams);
      setCopyStreamIdsForPath(fp, () => fromPairs(streams.map((stream) => [
        stream.index, defaultProcessedCodecTypes.includes(stream.codec_type),
      ])));

      const videoStream = streams.find(stream => stream.codec_type === 'video');
      setMainVideoStream(videoStream);
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

  const toggleHelp = () => setHelpVisible(val => !val);

  const jumpSeg = useCallback((val) => setCurrentSegIndex((old) => Math.max(Math.min(old + val, cutSegments.length - 1), 0)), [cutSegments.length]);

  useEffect(() => {
    Mousetrap.bind('space', () => playCommand());
    Mousetrap.bind('k', () => playCommand());
    Mousetrap.bind('j', () => changePlaybackRate(-1));
    Mousetrap.bind('l', () => changePlaybackRate(1));
    Mousetrap.bind('left', () => seekRel(-1));
    Mousetrap.bind('right', () => seekRel(1));
    Mousetrap.bind('up', () => jumpSeg(-1));
    Mousetrap.bind('down', () => jumpSeg(1));
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
      Mousetrap.unbind('up');
      Mousetrap.unbind('down');
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
    setCutEnd, setCutStart, seekRel, shortStep, deleteSource, jumpSeg,
  ]);

  useEffect(() => {
    document.ondragover = dragPreventer;
    document.ondragend = dragPreventer;

    electron.ipcRenderer.send('renderer-ready');
  }, []);

  useEffect(() => {
    electron.ipcRenderer.send('setAskBeforeClose', askBeforeClose);
  }, [askBeforeClose]);

  const extractAllStreams = useCallback(async () => {
    if (!filePath) return;

    try {
      setWorking(true);
      await ffmpeg.extractStreams({ customOutDir, filePath, streams: mainStreams });
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
    const { streams } = await ffmpeg.getAllStreams(path);
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

    if (!filePath) {
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
        open: 'Open the file instead of the current one. You will lose all work',
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
  }, [addStreamSourceFile, filePath, load, mergeFiles]);

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
      // eslint-disable-next-line no-alert
      if (!window.confirm('Are you sure you want to close the current file? You will lose all work')) return;

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
          await ffmpeg.html5ify(filePath, html5FriendlyPathNew, encodeVideo, encodeAudio);
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
        await edlStore.save(fp, cutSegments);
      } catch (err) {
        errorToast('Failed to export CSV');
        console.error('Failed to export CSV', err);
      }
    }

    async function importEdlFile() {
      if (!filePath) return;
      const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'CSV files', extensions: ['csv'] }] });
      if (canceled || filePaths.length < 1) return;
      await loadEdlFile(filePaths[0]);
    }

    function openHelp() {
      toggleHelp();
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
    };
  }, [
    load, mergeFiles, outputDir, filePath, customOutDir, startTimeOffset, getHtml5ifiedPath,
    createDummyVideo, resetState, extractAllStreams, userOpenFiles, cutSegmentsHistory,
    loadEdlFile, cutSegments, edlFilePath,
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

  function renderCutTimeInput(type) {
    const cutTimeManual = type === 'start' ? cutStartTimeManual : cutEndTimeManual;
    const cutTimeInputStyle = { width: '8em', textAlign: type === 'start' ? 'right' : 'left' };

    const isCutTimeManualSet = () => cutTimeManual !== undefined;

    const set = type === 'start' ? setCutStartTimeManual : setCutEndTimeManual;

    const handleCutTimeInput = (text) => {
      // Allow the user to erase
      if (text.length === 0) {
        set();
        return;
      }

      const time = parseDuration(text);
      if (time === undefined) {
        set(text);
        return;
      }

      set();

      const rel = time - startTimeOffset;
      try {
        setCutTime(type, rel);
      } catch (err) {
        console.error('Cannot set cut time', err);
      }
      seekAbs(rel);
    };

    const cutTime = type === 'start' ? currentApparentCutSeg.start : currentApparentCutSeg.end;

    return (
      <input
        style={{ ...cutTimeInputStyle, color: isCutTimeManualSet() ? '#dc1d1d' : undefined }}
        type="text"
        onChange={e => handleCutTimeInput(e.target.value)}
        value={isCutTimeManualSet()
          ? cutTimeManual
          : formatDuration({ seconds: cutTime + startTimeOffset })}
      />
    );
  }

  const commonFormats = ['mov', 'mp4', 'matroska', 'mp3', 'ipod'];
  const commonFormatsMap = fromPairs(commonFormats.map(format => [format, allOutFormats[format]])
    .filter(([f]) => f !== detectedFileFormat));
  const otherFormatsMap = fromPairs(Object.entries(allOutFormats)
    .filter(([f]) => ![...commonFormats, detectedFileFormat].includes(f)));

  const shouldShowKeyframes = neighbouringFrames.length >= 2 && (neighbouringFrames[neighbouringFrames.length - 1].time - neighbouringFrames[0].time) / durationSafe > (0.1 / zoom);

  function getSegColors(seg) {
    if (!seg) return {};
    const { color } = seg;
    return {
      segBgColor: color.alpha(0.5).string(),
      segActiveBgColor: color.lighten(0.5).alpha(0.5).string(),
      segBorderColor: color.lighten(0.5).string(),
    };
  }

  const {
    segActiveBgColor: currentSegActiveBgColor,
    segBorderColor: currentSegBorderColor,
  } = getSegColors(currentCutSeg);

  const jumpCutButtonStyle = {
    position: 'absolute', color: 'black', bottom: 0, top: 0, padding: '2px 8px',
  };

  function renderFormatOptions(map) {
    return Object.entries(map).map(([f, name]) => (
      <option key={f} value={f}>{f} - {name}</option>
    ));
  }
  function renderOutFmt(props) {
    return (
      // eslint-disable-next-line react/jsx-props-no-spreading
      <Select defaultValue="" value={fileFormat} title="Output format" onChange={withBlur(e => setFileFormat(e.target.value))} {...props}>
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
    );
  }

  function renderCaptureFormatButton(props) {
    return (
      <Button
        title="Capture frame format"
        onClick={withBlur(toggleCaptureFormat)}
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...props}
      >
        {captureFormat}
      </Button>
    );
  }

  const renderSettings = () => {
    // eslint-disable-next-line react/jsx-props-no-spreading
    const Row = (props) => <Table.Row height="auto" paddingY={12} {...props} />;
    // eslint-disable-next-line react/jsx-props-no-spreading
    const KeyCell = (props) => <Table.TextCell textProps={{ whiteSpace: 'auto' }} {...props} />;

    return (
      <Fragment>
        <Row>
          <KeyCell textProps={{ whiteSpace: 'auto' }}>Output format (default autodetected)</KeyCell>
          <Table.TextCell>{renderOutFmt({ width: '100%' })}</Table.TextCell>
        </Row>

        <Row>
          <KeyCell>
            Working directory<br />
            This is where working files, exported files, project files (CSV) are stored.
          </KeyCell>
          <Table.TextCell>
            <Button onClick={setOutputDir}>
              {customOutDir ? 'Custom working directory' : 'Same directory as input file'}
            </Button>
            <div>{customOutDir}</div>
          </Table.TextCell>
        </Row>

        <Row>
          <KeyCell>Auto merge segments to one file during export or export to separate files?</KeyCell>
          <Table.TextCell>
            <SegmentedControl
              options={[{ label: 'Auto merge', value: 'automerge' }, { label: 'Separate', value: 'separate' }]}
              value={autoMerge ? 'automerge' : 'separate'}
              onChange={value => setAutoMerge(value === 'automerge')}
            />
          </Table.TextCell>
        </Row>

        <Row>
          <KeyCell>
            Keyframe cut mode<br />
            <b>Nearest keyframe</b>: Cut at the nearest keyframe (not accurate time.) Equiv to <i>ffmpeg -ss -i ...</i><br />
            <b>Normal cut</b>: Accurate time but could leave an empty portion at the beginning of the video. Equiv to <i>ffmpeg -i -ss ...</i><br />
          </KeyCell>
          <Table.TextCell>
            <SegmentedControl
              options={[{ label: 'Nearest keyframe', value: 'keyframe' }, { label: 'Normal cut', value: 'normal' }]}
              value={keyframeCut ? 'keyframe' : 'normal'}
              onChange={value => setKeyframeCut(value === 'keyframe')}
            />
          </Table.TextCell>
        </Row>

        <Row>
          <KeyCell>
            <span role="img" aria-label="Yin Yang">☯️</span> Choose cutting mode: Cut away or keep selected segments from video when exporting?<br />
            When <b>Keep</b> is selected, the video inside segments will be kept, while the video outside will be discarded.<br />
            When <b>Cut away</b> is selected, the video inside segments will be discarded, while the video surrounding them will be kept.
          </KeyCell>
          <Table.TextCell>
            <SegmentedControl
              options={[{ label: 'Cut away', value: 'discard' }, { label: 'Keep', value: 'keep' }]}
              value={invertCutSegments ? 'discard' : 'keep'}
              onChange={value => setInvertCutSegments(value === 'discard')}
            />
          </Table.TextCell>
        </Row>

        <Row>
          <KeyCell>
            Extract unprocessable tracks to separate files or discard them?<br />
            (data tracks such as GoPro GPS, telemetry etc. are not copied over by default because ffmpeg cannot cut them, thus they will cause the media duration to stay the same after cutting video/audio)
          </KeyCell>
          <Table.TextCell>
            <SegmentedControl
              options={[{ label: 'Extract', value: 'extract' }, { label: 'Discard', value: 'discard' }]}
              value={autoExportExtraStreams ? 'extract' : 'discard'}
              onChange={value => setAutoExportExtraStreams(value === 'extract')}
            />
          </Table.TextCell>
        </Row>

        <Row>
          <KeyCell>
            Auto save project file?<br />
            The project will be stored along with the output files as a CSV file
          </KeyCell>
          <Table.TextCell>
            <Checkbox
              label="Auto save project"
              checked={autoSaveProjectFile}
              onChange={e => setAutoSaveProjectFile(e.target.checked)}
            />
          </Table.TextCell>
        </Row>

        <Row>
          <KeyCell>
            Snapshot capture format
          </KeyCell>
          <Table.TextCell>
            {renderCaptureFormatButton()}
          </Table.TextCell>
        </Row>

        <Row>
          <KeyCell>In timecode show</KeyCell>
          <Table.TextCell>
            <SegmentedControl
              options={[{ label: 'Frame numbers', value: 'frames' }, { label: 'Millisecond fractions', value: 'ms' }]}
              value={timecodeShowFrames ? 'frames' : 'ms'}
              onChange={value => setTimecodeShowFrames(value === 'frames')}
            />
          </Table.TextCell>
        </Row>

        <Row>
          <KeyCell>Ask for confirmation when closing app?</KeyCell>
          <Table.TextCell>
            <Checkbox
              label="Ask before closing"
              checked={askBeforeClose}
              onChange={e => setAskBeforeClose(e.target.checked)}
            />
          </Table.TextCell>
        </Row>
      </Fragment>
    );
  };

  useEffect(() => {
    loadMifiLink().then(setMifiLink);
  }, []);

  useEffect(() => {
    // Testing:
    if (isDev) load('/Users/mifi/Downloads/inp.MOV');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function run() {
      if (!filePath || debouncedCommandedTime == null || !mainVideoStream || readingKeyframesPromise.current) return;
      try {
        const promise = ffmpeg.readFrames({ filePath, aroundTime: debouncedCommandedTime, stream: mainVideoStream.index });
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
  }, [filePath, debouncedCommandedTime, mainVideoStream]);

  const topBarHeight = '2rem';
  const bottomBarHeight = '6rem';

  const VolumeIcon = muted || dummyVideoPath ? FaVolumeMute : FaVolumeUp;
  const CutIcon = areWeCutting ? FiScissors : FaFileExport;

  function renderInvertCutButton() {
    return (
      <div style={{ marginLeft: 5 }}>
        <motion.div
          animate={{ rotateX: invertCutSegments ? 0 : 180, width: 26, height: 26 }}
          transition={{ duration: 0.3 }}
        >
          <FaYinYang
            size={26}
            role="button"
            title={invertCutSegments ? 'Discard selected segments' : 'Keep selected segments'}
            onClick={withBlur(() => setInvertCutSegments(v => !v))}
          />
        </motion.div>
      </div>
    );
  }

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

  function renderSetCutpointButton(side) {
    const start = side === 'start';
    const Icon = start ? FaHandPointLeft : FaHandPointRight;
    const border = `4px solid ${currentSegBorderColor}`;
    return (
      <Icon
        size={13}
        title="Set cut end to current position"
        role="button"
        style={{ padding: start ? '4px 4px 4px 2px' : '4px 2px 4px 4px', borderLeft: start && border, borderRight: !start && border, background: currentSegActiveBgColor, borderRadius: 6 }}
        onClick={start ? setCutStart : setCutEnd}
      />
    );
  }

  const getSegButtonStyle = ({ segActiveBgColor, segBorderColor }) => ({ background: segActiveBgColor, border: `2px solid ${segBorderColor}`, borderRadius: 6, color: 'white', fontSize: 14, textAlign: 'center', lineHeight: '11px', fontWeight: 'bold' });

  function renderJumpCutpointButton(direction) {
    const newIndex = currentSegIndexSafe + direction;
    const seg = cutSegments[newIndex];

    let segButtonStyle;

    if (seg) {
      const { segActiveBgColor, segBorderColor } = getSegColors(seg);
      segButtonStyle = getSegButtonStyle({ segActiveBgColor, segBorderColor });
    } else {
      segButtonStyle = getSegButtonStyle({ segActiveBgColor: 'rgba(255,255,255,0.3)', segBorderColor: 'rgba(255,255,255,0.5)' });
    }

    return (
      <div
        style={{ ...segButtonStyle, height: 10, padding: 4, margin: '0 5px' }}
        role="button"
        title={`Jump to ${direction > 0 ? 'next' : 'previous'} segment (${newIndex + 1})`}
        onClick={() => seg && setCurrentSegIndex(newIndex)}
      >
        {newIndex + 1}
      </div>
    );
  }

  const rightBarWidth = 200; // TODO responsive

  const AutoMergeIcon = autoMerge ? MdCallMerge : MdCallSplit;

  return (
    <div>
      <div className="no-user-select" style={{ background: controlsBackground, height: topBarHeight, display: 'flex', alignItems: 'center', padding: '0 5px', justifyContent: 'space-between' }}>
        {filePath && (
          <Fragment>
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
                shortestFlag={shortestFlag}
                setShortestFlag={setShortestFlag}
                exportExtraStreams={exportExtraStreams}
              />
            </SideSheet>
            <Button height={20} iconBefore="list" onClick={withBlur(() => setStreamsSelectorShown(true))}>
              Tracks ({numStreamsToCopy}/{numStreamsTotal})
            </Button>

            <Button
              iconBefore={copyAnyAudioTrack ? 'volume-up' : 'volume-off'}
              height={20}
              title={`Discard audio? Current: ${copyAnyAudioTrack ? 'keep audio tracks' : 'Discard audio tracks'}`}
              onClick={withBlur(toggleStripAudio)}
            >
              {copyAnyAudioTrack ? 'Keep audio' : 'Discard audio'}
            </Button>
          </Fragment>
        )}

        <div style={{ flexGrow: 1 }} />

        {filePath && (
          <Fragment>
            <Button
              iconBefore={customOutDir ? 'folder-open' : undefined}
              height={20}
              onClick={withBlur(setOutputDir)}
              title={customOutDir}
            >
              {`Working dir ${customOutDir ? 'set' : 'unset'}`}
            </Button>

            <div style={{ width: 60 }}>{renderOutFmt({ height: 20 })}</div>

            <Button
              height={20}
              style={{ opacity: outSegments && outSegments.length < 2 ? 0.4 : undefined }}
              title={autoMerge ? 'Auto merge segments to one file after export' : 'Export to separate files'}
              onClick={withBlur(toggleAutoMerge)}
            >
              <AutoMergeIcon /> {autoMerge ? 'Merge cuts' : 'Separate files'}
            </Button>

            <Button
              height={20}
              iconBefore={keyframeCut ? 'key' : undefined}
              title={`Cut mode is ${keyframeCut ? 'keyframe cut' : 'normal cut'}`}
              onClick={withBlur(toggleKeyframeCut)}
            >
              {keyframeCut ? 'Keyframe cut' : 'Normal cut'}
            </Button>
          </Fragment>
        )}

        <IoIosHelpCircle size={24} role="button" onClick={toggleHelp} style={{ verticalAlign: 'middle', marginLeft: 5 }} />
      </div>

      {!filePath && (
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

      <div className="no-user-select" style={{ position: 'absolute', top: topBarHeight, left: 0, right: rightBarWidth, bottom: bottomBarHeight }}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          muted={muted}
          ref={videoRef}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          src={fileUri}
          onPlay={() => onPlayingChange(true)}
          onPause={() => onPlayingChange(false)}
          onDurationChange={e => setDuration(e.target.duration)}
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
          position: 'absolute', top: topBarHeight, marginTop: '1em', marginRight: '1em', right: rightBarWidth, color: 'white',
        }}
        >
          Lossless rotation preview
        </div>
      )}

      {filePath && (
        <Fragment>
          <div
            className="no-user-select"
            style={{
              position: 'absolute', margin: '1em', right: rightBarWidth, bottom: bottomBarHeight, color: 'rgba(255,255,255,0.7)',
            }}
          >
            <VolumeIcon
              title="Mute preview? (will not affect output)"
              size={30}
              role="button"
              onClick={toggleMute}
            />
          </div>

          <div style={{
            position: 'absolute', width: rightBarWidth, right: 0, bottom: bottomBarHeight, top: topBarHeight, background: controlsBackground, color: 'rgba(255,255,255,0.7)', display: 'flex', flexDirection: 'column',
          }}
          >
            <SegmentList
              currentSegIndex={currentSegIndexSafe}
              cutSegments={outSegments}
              getFrameCount={getFrameCount}
              getSegColors={getSegColors}
              formatTimecode={formatTimecode}
              invertCutSegments={invertCutSegments}
              onSegClick={setCurrentSegIndex}
              updateCurrentSegOrder={updateCurrentSegOrder}
              setCurrentSegmentName={setCurrentSegmentName}
              currentCutSeg={currentCutSeg}
              addCutSegment={addCutSegment}
              removeCutSegment={removeCutSegment}
            />
          </div>
        </Fragment>
      )}

      <div className="controls-wrapper no-user-select" style={{ height: bottomBarHeight, background: controlsBackground, position: 'absolute', left: 0, right: 0, bottom: 0, textAlign: 'center' }}>
        <Hammer
          onTap={handleTap}
          onPan={handleTap}
          options={{ recognizers: {} }}
        >
          <div style={{ position: 'relative' }}>
            <div
              style={{ overflowX: 'scroll' }}
              id="timeline-scroller"
              onWheel={onWheel}
              onScroll={onTimelineScroll}
              ref={timelineScrollerRef}
            >
              <div
                style={{ height: 36, width: `${zoom * 100}%`, position: 'relative', backgroundColor: timelineBackground }}
                ref={timelineWrapperRef}
              >
                {currentTimePos !== undefined && <motion.div transition={{ type: 'spring', damping: 70, stiffness: 800 }} animate={{ left: currentTimePos }} style={{ position: 'absolute', bottom: 0, top: 0, zIndex: 3, backgroundColor: 'black', width: currentTimeWidth, pointerEvents: 'none' }} />}
                {commandedTimePos !== undefined && <div style={{ left: commandedTimePos, position: 'absolute', bottom: 0, top: 0, zIndex: 4, backgroundColor: 'white', width: currentTimeWidth, pointerEvents: 'none' }} />}

                {apparentCutSegments.map((seg, i) => {
                  const {
                    segBgColor, segActiveBgColor, segBorderColor,
                  } = getSegColors(seg);

                  return (
                    <TimelineSeg
                      key={seg.uuid}
                      segNum={i}
                      segBgColor={segBgColor}
                      segActiveBgColor={segActiveBgColor}
                      segBorderColor={segBorderColor}
                      onSegClick={setCurrentSegIndex}
                      isActive={i === currentSegIndexSafe}
                      duration={durationSafe}
                      name={seg.name}
                      cutStart={seg.start}
                      cutEnd={seg.end}
                      invertCutSegments={invertCutSegments}
                      zoomed={zoomed}
                    />
                  );
                })}

                {inverseCutSegments && inverseCutSegments.map((seg, i) => (
                  <InverseCutSegment
                    // eslint-disable-next-line react/no-array-index-key
                    key={i}
                    seg={seg}
                    duration={durationSafe}
                    invertCutSegments={invertCutSegments}
                  />
                ))}

                {mainVideoStream && shouldShowKeyframes && neighbouringFrames.filter(f => f.keyframe).map((f) => (
                  <div key={f.time} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(f.time / duration) * 100}%`, marginLeft: -1, width: 1, background: 'rgba(0,0,0,1)' }} />
                ))}
              </div>
            </div>

            <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 3, padding: '2px 4px', color: 'rgba(255, 255, 255, 0.8)' }}>
                {formatTimecode(offsetCurrentTime)}
              </div>
            </div>
          </div>
        </Hammer>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <i
            className="button fa fa-step-backward"
            role="button"
            tabIndex="0"
            title="Jump to start of video"
            onClick={() => seekAbs(0)}
          />

          {renderJumpCutpointButton(-1)}

          {renderSetCutpointButton('start')}

          <div style={{ position: 'relative' }}>
            {renderCutTimeInput('start')}
            <i
              style={{ ...jumpCutButtonStyle, left: 0 }}
              className="fa fa-step-backward"
              title="Jump to cut start"
              role="button"
              tabIndex="0"
              onClick={withBlur(jumpCutStart)}
            />
          </div>

          <i
            className="button fa fa-caret-left"
            role="button"
            tabIndex="0"
            onClick={() => shortStep(-1)}
          />
          <i
            className={`button fa ${playing ? 'fa-pause' : 'fa-play'}`}
            role="button"
            tabIndex="0"
            onClick={playCommand}
          />
          <i
            className="button fa fa-caret-right"
            role="button"
            tabIndex="0"
            onClick={() => shortStep(1)}
          />

          <div style={{ position: 'relative' }}>
            {renderCutTimeInput('end')}
            <i
              style={{ ...jumpCutButtonStyle, right: 0 }}
              className="fa fa-step-forward"
              title="Jump to cut end"
              role="button"
              tabIndex="0"
              onClick={withBlur(jumpCutEnd)}
            />
          </div>

          {renderSetCutpointButton('end')}

          {renderJumpCutpointButton(1)}

          <i
            className="button fa fa-step-forward"
            role="button"
            tabIndex="0"
            title="Jump to end of video"
            onClick={() => seekAbs(durationSafe)}
          />
        </div>
      </div>

      <div className="left-menu no-user-select" style={{ position: 'absolute', left: 0, bottom: 0, padding: '.3em', display: 'flex', alignItems: 'center' }}>
        {renderInvertCutButton()}

        <Select height={20} style={{ width: 80, margin: '0 10px' }} value={zoom.toString()} title="Zoom" onChange={withBlur(e => setZoom(parseInt(e.target.value, 10)))}>
          {Array(13).fill().map((unused, z) => {
            const val = 2 ** z;
            return (
              <option key={val} value={String(val)}>Zoom {val}x</option>
            );
          })}
        </Select>
      </div>

      <div className="right-menu no-user-select" style={{ position: 'absolute', right: 0, bottom: 0, padding: '.3em', display: 'flex', alignItems: 'center' }}>
        <div>
          <span style={{ width: 40, textAlign: 'right', display: 'inline-block' }}>{isRotationSet && rotationStr}</span>
          <MdRotate90DegreesCcw
            size={26}
            style={{ margin: '0 5px', verticalAlign: 'middle' }}
            title={`Set output rotation. Current: ${isRotationSet ? rotationStr : 'Don\'t modify'}`}
            onClick={increaseRotation}
            role="button"
          />
        </div>

        <FaTrashAlt
          title="Delete source file"
          style={{ padding: '5px 10px' }}
          size={16}
          onClick={deleteSource}
          role="button"
        />

        {renderCaptureFormatButton({ height: 20 })}

        <IoIosCamera
          style={{ paddingLeft: 5, paddingRight: 15 }}
          size={25}
          title="Capture frame"
          onClick={capture}
        />

        <span
          style={{ background: primaryColor, borderRadius: 5, padding: '3px 7px', fontSize: 14 }}
          onClick={cutClick}
          title={cutSegments.length > 1 ? 'Export all segments' : 'Export selection'}
          role="button"
        >
          <CutIcon
            style={{ verticalAlign: 'middle', marginRight: 3 }}
            size={16}
          />
          Export
        </span>
      </div>

      <HelpSheet
        visible={!!helpVisible}
        onTogglePress={toggleHelp}
        renderSettings={renderSettings}
        ffmpegCommandLog={ffmpegCommandLog}
      />
    </div>
  );
});

ReactDOM.render(<App />, document.getElementById('app'));

console.log('Version', electron.remote.app.getVersion());
