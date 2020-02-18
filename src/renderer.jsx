import React, { memo, useEffect, useState, useCallback, useRef } from 'react';
import { IoIosHelpCircle, IoIosCamera } from 'react-icons/io';
import { FaPlus, FaMinus, FaAngleLeft, FaAngleRight, FaTrashAlt, FaVolumeMute, FaVolumeUp, FaYinYang, FaFileExport } from 'react-icons/fa';
import { MdRotate90DegreesCcw } from 'react-icons/md';
import { GiYinYang } from 'react-icons/gi';
import { FiScissors } from 'react-icons/fi';
import { AnimatePresence, motion } from 'framer-motion';
import Swal from 'sweetalert2';

import { SideSheet, Button, Position } from 'evergreen-ui';
import fromPairs from 'lodash/fromPairs';
import clamp from 'lodash/clamp';
import clone from 'lodash/clone';
import sortBy from 'lodash/sortBy';
import flatMap from 'lodash/flatMap';

import HelpSheet from './HelpSheet';
import TimelineSeg from './TimelineSeg';
import InverseCutSegment from './InverseCutSegment';
import StreamsSelector from './StreamsSelector';
import { loadMifiLink } from './mifi';


const isDev = require('electron-is-dev');
const electron = require('electron'); // eslint-disable-line
const Mousetrap = require('mousetrap');
const Hammer = require('react-hammerjs').default;
const { dirname } = require('path');
const trash = require('trash');
const uuid = require('uuid');

const ReactDOM = require('react-dom');
const { default: PQueue } = require('p-queue');
const { unlink, exists } = require('fs-extra');


const { showMergeDialog, showOpenAndMergeDialog } = require('./merge/merge');
const allOutFormats = require('./outFormats');
const captureFrame = require('./capture-frame');
const ffmpeg = require('./ffmpeg');

const { defaultProcessedCodecTypes, getStreamFps, isCuttingStart, isCuttingEnd } = ffmpeg;


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

function createSegment({ start, end } = {}) {
  return {
    start,
    end,
    color: generateColor(),
    uuid: uuid.v4(),
  };
}

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
  const [framePath, setFramePath] = useState();
  const [html5FriendlyPath, setHtml5FriendlyPath] = useState();
  const [working, setWorking] = useState(false);
  const [dummyVideoPath, setDummyVideoPath] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState();
  const [duration, setDuration] = useState();
  const [cutSegments, setCutSegments] = useState([createSegment()]);
  const [currentSegIndex, setCurrentSegIndex] = useState(0);
  const [cutStartTimeManual, setCutStartTimeManual] = useState();
  const [cutEndTimeManual, setCutEndTimeManual] = useState();
  const [fileFormat, setFileFormat] = useState();
  const [detectedFileFormat, setDetectedFileFormat] = useState();
  const [rotation, setRotation] = useState(360);
  const [cutProgress, setCutProgress] = useState();
  const [startTimeOffset, setStartTimeOffset] = useState(0);
  const [rotationPreviewRequested, setRotationPreviewRequested] = useState(false);
  const [filePath, setFilePath] = useState('');
  const [externalStreamFiles, setExternalStreamFiles] = useState([]);
  const [detectedFps, setDetectedFps] = useState();
  const [mainStreams, setStreams] = useState([]);
  const [copyStreamIdsByFile, setCopyStreamIdsByFile] = useState({});
  const [muted, setMuted] = useState(false);
  const [streamsSelectorShown, setStreamsSelectorShown] = useState(false);

  // Global state
  const [captureFormat, setCaptureFormat] = useState('jpeg');
  const [customOutDir, setCustomOutDir] = useState();
  const [keyframeCut, setKeyframeCut] = useState(true);
  const [autoMerge, setAutoMerge] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  const [timecodeShowFrames, setTimecodeShowFrames] = useState(false);
  const [mifiLink, setMifiLink] = useState();
  const [invertCutSegments, setInvertCutSegments] = useState(false);

  const videoRef = useRef();
  const timelineWrapperRef = useRef();


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

  function seekAbs(val) {
    const video = videoRef.current;
    if (val == null || Number.isNaN(val)) return;

    let outVal = val;
    if (outVal < 0) outVal = 0;
    if (outVal > video.duration) outVal = video.duration;

    video.currentTime = outVal;
  }

  const seekRel = useCallback((val) => {
    seekAbs(videoRef.current.currentTime + val);
  }, []);

  const shortStep = useCallback((dir) => {
    seekRel((1 / 60) * dir);
  }, [seekRel]);

  const resetState = useCallback(() => {
    const video = videoRef.current;
    video.currentTime = 0;
    video.playbackRate = 1;

    setFileNameTitle();
    setFramePath();
    setHtml5FriendlyPath();
    setDummyVideoPath();
    setWorking(false);
    setPlaying(false);
    setDuration();
    setCurrentSegIndex(0);
    setCutSegments([createSegment()]);
    setCutStartTimeManual();
    setCutEndTimeManual();
    setFileFormat();
    setDetectedFileFormat();
    setRotation(360);
    setCutProgress();
    setStartTimeOffset(0);
    setRotationPreviewRequested(false);
    setFilePath(''); // Setting video src="" prevents memory leak in chromium
    setExternalStreamFiles([]);
    setDetectedFps();
    setStreams([]);
    setCopyStreamIdsByFile({});
    setMuted(false);
    setInvertCutSegments(false);
    setStreamsSelectorShown(false);
  }, []);

  useEffect(() => () => {
    if (dummyVideoPath) unlink(dummyVideoPath).catch(console.error);
  }, [dummyVideoPath]);

  const frameRenderEnabled = !!(rotationPreviewRequested || dummyVideoPath);

  // Because segments could have undefined start / end
  // (meaning extend to start of timeline or end duration)
  function getSegApparentStart(time) {
    return time !== undefined ? time : 0;
  }

  const getSegApparentEnd = useCallback((time) => {
    if (time !== undefined) return time;
    if (duration !== undefined) return duration;
    return 0; // Haven't gotten duration yet
  }, [duration]);

  const apparentCutSegments = cutSegments.map(cutSegment => ({
    ...cutSegment,
    start: getSegApparentStart(cutSegment.start),
    end: getSegApparentEnd(cutSegment.end),
  }));

  const invalidSegUuids = apparentCutSegments
    .filter(cutSegment => cutSegment.start >= cutSegment.end)
    .map(cutSegment => cutSegment.uuid);

  const haveInvalidSegs = invalidSegUuids.length > 0;

  const currentCutSeg = cutSegments[currentSegIndex];
  const currentApparentCutSeg = apparentCutSegments[currentSegIndex];
  const areWeCutting = apparentCutSegments.length > 1
    || isCuttingStart(currentApparentCutSeg.start)
    || isCuttingEnd(currentApparentCutSeg.end, duration);

  const inverseCutSegments = (() => {
    if (haveInvalidSegs) return undefined;
    if (apparentCutSegments.length < 1) return undefined;

    const sorted = sortBy(apparentCutSegments, 'start');

    const foundOverlap = sorted.some((cutSegment, i) => {
      if (i === 0) return false;
      return sorted[i - 1].end > cutSegment.start;
    });

    if (foundOverlap) return undefined;
    if (duration == null) return undefined;

    const ret = [];

    if (sorted[0].start > 0) {
      ret.push({
        start: 0,
        end: sorted[0].start,
      });
    }

    sorted.forEach((cutSegment, i) => {
      if (i === 0) return;
      ret.push({
        start: sorted[i - 1].end,
        end: cutSegment.start,
      });
    });

    const last = sorted[sorted.length - 1];
    if (last.end < duration) {
      ret.push({
        start: last.end,
        end: duration,
      });
    }

    return ret;
  })();

  const setCutTime = useCallback((type, time) => {
    const cloned = clone(cutSegments);
    cloned[currentSegIndex][type] = time;
    setCutSegments(cloned);
  }, [currentSegIndex, cutSegments]);

  function formatTimecode(sec) {
    return formatDuration({ seconds: sec, fps: timecodeShowFrames ? detectedFps : undefined });
  }

  const addCutSegment = useCallback(() => {
    const cutStartTime = currentCutSeg.start;
    const cutEndTime = currentCutSeg.end;

    if (cutStartTime === undefined && cutEndTime === undefined) return;

    const suggestedStart = currentTime;
    const suggestedEnd = suggestedStart + 10;

    const cutSegmentsNew = [
      ...cutSegments,
      createSegment({
        start: currentTime,
        end: suggestedEnd <= duration ? suggestedEnd : undefined,
      }),
    ];

    const currentSegIndexNew = cutSegmentsNew.length - 1;
    setCutSegments(cutSegmentsNew);
    setCurrentSegIndex(currentSegIndexNew);
  }, [
    currentCutSeg, cutSegments, currentTime, duration,
  ]);

  const setCutStart = useCallback(() => {
    // https://github.com/mifi/lossless-cut/issues/168
    // If we are after the end of the last segment in the timeline,
    // add a new segment that starts at currentTime
    if (currentCutSeg.start != null && currentCutSeg.end != null
      && currentTime > currentCutSeg.end) {
      addCutSegment();
    } else {
      setCutTime('start', currentTime);
    }
  }, [setCutTime, currentTime, currentCutSeg, addCutSegment]);

  const setCutEnd = useCallback(() => setCutTime('end', currentTime), [setCutTime, currentTime]);

  async function setOutputDir() {
    const { filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    setCustomOutDir((filePaths && filePaths.length === 1) ? filePaths[0] : undefined);
  }

  const fileUri = (dummyVideoPath || html5FriendlyPath || filePath || '').replace(/#/g, '%23');

  function getOutputDir() {
    if (customOutDir) return customOutDir;
    if (filePath) return dirname(filePath);
    return undefined;
  }

  const outputDir = getOutputDir();

  // 360 means we don't modify rotation
  const isRotationSet = rotation !== 360;
  const effectiveRotation = isRotationSet ? rotation : undefined;
  const rotationStr = `${rotation}°`;

  useEffect(() => {
    async function throttledRender() {
      if (queue.size < 2) {
        queue.add(async () => {
          if (!frameRenderEnabled) return;

          if (currentTime == null || !filePath) return;

          try {
            const framePathNew = await ffmpeg.renderFrame(currentTime, filePath, effectiveRotation);
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
    filePath, currentTime, frameRenderEnabled, effectiveRotation,
  ]);

  // Cleanup old frames
  useEffect(() => () => URL.revokeObjectURL(framePath), [framePath]);

  function onPlayingChange(val) {
    setPlaying(val);
    if (!val) videoRef.current.playbackRate = 1;
  }

  function onTimeUpdate(e) {
    const { currentTime: ct } = e.target;
    if (currentTime === ct) return;
    setRotationPreviewRequested(false); // Reset this
    setCurrentTime(ct);
  }

  function increaseRotation() {
    setRotation((r) => (r + 90) % 450);
    setRotationPreviewRequested(true);
  }

  const offsetCurrentTime = (currentTime || 0) + startTimeOffset;

  const mergeFiles = useCallback(async (paths) => {
    try {
      setWorking(true);

      // console.log('merge', paths);
      await ffmpeg.mergeAnyFiles({
        customOutDir, paths,
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
    cutSegmentsNew.splice(currentSegIndex, 1);

    const currentSegIndexNew = Math.min(currentSegIndex, cutSegmentsNew.length - 1);
    setCurrentSegIndex(currentSegIndexNew);
    setCutSegments(cutSegmentsNew);
  }, [currentSegIndex, cutSegments]);

  const jumpCutStart = () => seekAbs(currentApparentCutSeg.start);
  const jumpCutEnd = () => seekAbs(currentApparentCutSeg.end);

  function handleTap(e) {
    const target = timelineWrapperRef.current;
    const rect = target.getBoundingClientRect();
    const relX = e.srcEvent.pageX - (rect.left + document.body.scrollLeft);
    if (duration) seekAbs((relX / target.offsetWidth) * duration);
  }

  function onWheel(e) {
    seekRel(e.deltaX / 10);
  }

  const playCommand = useCallback(() => {
    const video = videoRef.current;
    if (playing) return video.pause();

    return video.play().catch((err) => {
      console.error(err);
      if (err.name === 'NotSupportedError') {
        toast.fire({ type: 'error', title: 'This format/codec is not supported. Try to convert it to a friendly format/codec in the player from the "File" menu.', timer: 10000 });
      }
    });
  }, [playing]);

  const deleteSource = useCallback(async () => {
    if (!filePath) return;

    // eslint-disable-next-line no-alert
    if (working || !window.confirm(`Are you sure you want to move the source file to trash? ${filePath}`)) return;

    try {
      setWorking(true);

      await trash(filePath);
      if (html5FriendlyPath) await trash(html5FriendlyPath);
    } catch (err) {
      toast.fire({ type: 'error', title: `Failed to trash source file: ${err.message}` });
    } finally {
      resetState();
    }
  }, [filePath, html5FriendlyPath, resetState, working]);

  const cutClick = useCallback(async () => {
    if (working) {
      errorToast('I\'m busy');
      return;
    }

    if (haveInvalidSegs) {
      errorToast('Start time must be before end time');
      return;
    }

    const segments = invertCutSegments ? inverseCutSegments : apparentCutSegments;

    const ffmpegSegments = segments.map((seg) => ({
      cutFrom: seg.start,
      cutTo: seg.end,
    }));

    if (segments.length < 1) {
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
      });

      if (outFiles.length > 1 && autoMerge) {
        setCutProgress(0); // TODO implement progress

        await ffmpeg.autoMergeSegments({
          customOutDir,
          sourceFile: filePath,
          segmentPaths: outFiles,
        });
      }

      toast.fire({ timer: 10000, type: 'success', title: `Export completed! Output file(s) can be found at: ${getOutDir(customOutDir, filePath)}. You can change the output directory in settings` });
    } catch (err) {
      console.error('stdout:', err.stdout);
      console.error('stderr:', err.stderr);

      if (err.code === 1 || err.code === 'ENOENT') {
        errorToast(`Whoops! ffmpeg was unable to export this video. Try one of the following before exporting again:\n1. Select a different output format from the ${fileFormat} button (matroska takes almost everything).\n2. Exclude unnecessary tracks`);
        return;
      }

      showFfmpegFail(err);
    } finally {
      setWorking(false);
    }
  }, [
    effectiveRotation, apparentCutSegments, invertCutSegments, inverseCutSegments,
    working, duration, filePath, keyframeCut, detectedFileFormat,
    autoMerge, customOutDir, fileFormat, haveInvalidSegs, copyStreamIds,
  ]);

  function showUnsupportedFileMessage() {
    toast.fire({ timer: 10000, type: 'warning', title: 'This video is not natively supported', text: 'This means that there is no audio in the preview and it has low quality. The final export operation will however be lossless and contains audio!' });
  }

  // TODO use ffmpeg to capture frame
  const capture = useCallback(async () => {
    if (!filePath) return;
    if (html5FriendlyPath || dummyVideoPath) {
      errorToast('Capture frame from this video not yet implemented');
      return;
    }
    try {
      await captureFrame(customOutDir, filePath, videoRef.current, currentTime, captureFormat);
    } catch (err) {
      console.error(err);
      errorToast('Failed to capture frame');
    }
  }, [filePath, currentTime, captureFormat, customOutDir, html5FriendlyPath, dummyVideoPath]);

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

  const createDummyVideo = useCallback(async (fp) => {
    const html5ifiedDummyPathDummy = getOutPath(customOutDir, fp, 'html5ified-dummy.mkv');
    await ffmpeg.html5ifyDummy(fp, html5ifiedDummyPathDummy);
    setDummyVideoPath(html5ifiedDummyPathDummy);
    setHtml5FriendlyPath();
    showUnsupportedFileMessage();
  }, [customOutDir]);

  const checkExistingHtml5FriendlyFile = useCallback(async (fp, speed) => {
    const existing = getHtml5ifiedPath(fp, speed);
    const ret = existing && await exists(existing);
    if (ret) {
      setHtml5FriendlyPath(existing);
      showUnsupportedFileMessage();
    }
    return ret;
  }, [getHtml5ifiedPath]);


  const load = useCallback(async (fp, html5FriendlyPathRequested) => {
    console.log('Load', { fp, html5FriendlyPathRequested });
    if (working) {
      errorToast('I\'m busy');
      return;
    }

    resetState();

    setWorking(true);

    try {
      const ff = await ffmpeg.getFormat(fp);
      if (!ff) {
        errorToast('Unsupported file');
        return;
      }

      const { streams } = await ffmpeg.getAllStreams(fp);
      // console.log('streams', streamsNew);
      setStreams(streams);
      setCopyStreamIdsForPath(fp, () => fromPairs(streams.map((stream) => [
        stream.index, defaultProcessedCodecTypes.includes(stream.codec_type),
      ])));


      streams.find((stream) => {
        const streamFps = getStreamFps(stream);
        if (streamFps != null) {
          setDetectedFps(streamFps);
          return true;
        }
        return false;
      });

      setFileNameTitle(fp);
      setFilePath(fp);
      setFileFormat(ff);
      setDetectedFileFormat(ff);

      if (html5FriendlyPathRequested) {
        setHtml5FriendlyPath(html5FriendlyPathRequested);
        showUnsupportedFileMessage();
      } else if (
        !(await checkExistingHtml5FriendlyFile(fp, 'slow-audio') || await checkExistingHtml5FriendlyFile(fp, 'slow') || await checkExistingHtml5FriendlyFile(fp, 'fast'))
        && !doesPlayerSupportFile(streams)
      ) {
        await createDummyVideo(fp);
      }
    } catch (err) {
      if (err.code === 1 || err.code === 'ENOENT') {
        errorToast('Unsupported file');
        return;
      }
      showFfmpegFail(err);
    } finally {
      setWorking(false);
    }
  }, [resetState, working, createDummyVideo, checkExistingHtml5FriendlyFile]);

  const toggleHelp = () => setHelpVisible(val => !val);

  useEffect(() => {
    Mousetrap.bind('space', () => playCommand());
    Mousetrap.bind('k', () => playCommand());
    Mousetrap.bind('j', () => changePlaybackRate(-1));
    Mousetrap.bind('l', () => changePlaybackRate(1));
    Mousetrap.bind('left', () => seekRel(-1));
    Mousetrap.bind('right', () => seekRel(1));
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
    setCutEnd, setCutStart, seekRel, shortStep, deleteSource,
  ]);

  useEffect(() => {
    document.ondragover = dragPreventer;
    document.ondragend = dragPreventer;

    electron.ipcRenderer.send('renderer-ready');
  }, []);

  const extractAllStreams = useCallback(async () => {
    if (!filePath) return;

    try {
      setWorking(true);
      await ffmpeg.extractAllStreams({ customOutDir, filePath });
      toast.fire({ type: 'success', title: `All streams can be found as separate files at: ${getOutDir(customOutDir, filePath)}` });
    } catch (err) {
      errorToast('Failed to extract all streams');
      console.error('Failed to extract all streams', err);
    } finally {
      setWorking(false);
    }
  }, [customOutDir, filePath]);

  function onExtractAllStreamsPress() {
    extractAllStreams();
  }

  const addStreamSourceFile = useCallback(async (path) => {
    if (externalStreamFiles[path]) return;
    const { streams } = await ffmpeg.getAllStreams(path);
    // console.log('streams', streams);
    setExternalStreamFiles(old => ({ ...old, [path]: { streams } }));
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
      input: 'radio',
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
    userOpenFiles(Array.from(files).map(f => f.path));
  }, [userOpenFiles]);

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

    electron.ipcRenderer.on('file-opened', fileOpened);
    electron.ipcRenderer.on('close-file', closeFile);
    electron.ipcRenderer.on('html5ify', html5ify);
    electron.ipcRenderer.on('show-merge-dialog', showOpenAndMergeDialog2);
    electron.ipcRenderer.on('set-start-offset', setStartOffset);
    electron.ipcRenderer.on('extract-all-streams', extractAllStreams);

    return () => {
      electron.ipcRenderer.removeListener('file-opened', fileOpened);
      electron.ipcRenderer.removeListener('close-file', closeFile);
      electron.ipcRenderer.removeListener('html5ify', html5ify);
      electron.ipcRenderer.removeListener('show-merge-dialog', showOpenAndMergeDialog2);
      electron.ipcRenderer.removeListener('set-start-offset', setStartOffset);
      electron.ipcRenderer.removeListener('extract-all-streams', extractAllStreams);
    };
  }, [
    load, mergeFiles, outputDir, filePath, customOutDir, startTimeOffset, getHtml5ifiedPath,
    createDummyVideo, resetState, extractAllStreams, userOpenFiles,
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
      setCutTime(type, rel);
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

  const durationSafe = duration || 1;
  const currentTimePos = currentTime !== undefined && `${(currentTime / durationSafe) * 100}%`;

  const segColor = (currentCutSeg || {}).color;
  const segBgColor = segColor.alpha(0.5).string();

  const jumpCutButtonStyle = {
    position: 'absolute', color: 'black', bottom: 0, top: 0, padding: '2px 8px',
  };

  function renderFormatOptions(map) {
    return Object.entries(map).map(([f, name]) => (
      <option key={f} value={f}>{f} - {name}</option>
    ));
  }
  function renderOutFmt({ width } = {}) {
    return (
      <select style={{ width }} defaultValue="" value={fileFormat} title="Output format" onChange={withBlur(e => setFileFormat(e.target.value))}>
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
      </select>
    );
  }

  function renderCaptureFormatButton() {
    return (
      <button
        type="button"
        title="Capture frame format"
        onClick={withBlur(toggleCaptureFormat)}
      >
        {captureFormat}
      </button>
    );
  }

  function renderSettings() {
    return (
      <table>
        <tbody>
          <tr>
            <td>Output format (default autodetected)</td>
            <td style={{ width: '50%' }}>{renderOutFmt()}</td>
          </tr>

          <tr>
            <td>Output directory</td>
            <td>
              <button
                type="button"
                onClick={setOutputDir}
              >
                {customOutDir ? 'Custom output directory' : 'Output files to same directory as current file'}
              </button>
              <div>{customOutDir}</div>
            </td>
          </tr>

          <tr>
            <td>Auto merge segments to one file after export?</td>
            <td>
              <button
                type="button"
                onClick={toggleAutoMerge}
              >
                {autoMerge ? 'Auto merge segments to one file' : 'Export separate files'}
              </button>
            </td>
          </tr>

          <tr>
            <td>keyframe cut mode</td>
            <td>
              <button
                type="button"
                onClick={toggleKeyframeCut}
              >
                {keyframeCut ? 'Nearest keyframe cut - will cut at the nearest keyframe' : 'Normal cut - cut accurate position but could leave an empty portion'}
              </button>
            </td>
          </tr>

          <tr>
            <td>
              Discard (cut away) or keep selected segments from video when exporting
            </td>
            <td>
              <button
                type="button"
                onClick={withBlur(() => setInvertCutSegments(v => !v))}
              >
                {invertCutSegments ? 'Discard' : 'Keep'}
              </button>
            </td>
          </tr>

          <tr>
            <td>
              Discard audio?
            </td>
            <td>
              <button
                type="button"
                onClick={toggleStripAudio}
              >
                {!copyAnyAudioTrack ? 'Discard all audio tracks' : 'Keep audio tracks'}
              </button>
            </td>
          </tr>

          <tr>
            <td>
              Snapshot capture format
            </td>
            <td>
              {renderCaptureFormatButton()}
            </td>
          </tr>

          <tr>
            <td>In timecode show</td>
            <td>
              <button
                type="button"
                onClick={() => setTimecodeShowFrames(v => !v)}
              >
                {timecodeShowFrames ? 'Frame numbers' : 'Millisecond fractions'}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    );
  }

  useEffect(() => {
    loadMifiLink().then(setMifiLink);
  }, []);

  useEffect(() => {
    // Testing:
    if (isDev) load('/Users/mifi/Downloads/inp.MOV');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const topBarHeight = '2rem';
  const bottomBarHeight = '6rem';

  const VolumeIcon = muted ? FaVolumeMute : FaVolumeUp;
  const CutIcon = areWeCutting ? FiScissors : FaFileExport;

  function renderInvertCutButton() {
    const KeepOrDiscardIcon = invertCutSegments ? GiYinYang : FaYinYang;

    return (
      <div style={{ position: 'relative', width: 26, height: 26, marginLeft: 5 }}>
        <AnimatePresence>
          <motion.div style={{ position: 'absolute' }} key={invertCutSegments} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0 }}>
            <KeepOrDiscardIcon
              size={26}
              role="button"
              title={invertCutSegments ? 'Discard selected segments' : 'Keep selected segments'}
              onClick={withBlur(() => setInvertCutSegments(v => !v))}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div>
      <div style={{ background: '#6b6b6b', height: topBarHeight, display: 'flex', alignItems: 'center', padding: '0 5px', justifyContent: 'space-between' }}>
        <SideSheet
          containerProps={{ style: { maxWidth: '100%' } }}
          position={Position.LEFT}
          isShown={streamsSelectorShown}
          onCloseComplete={() => setStreamsSelectorShown(false)}
        >
          <StreamsSelector
            mainFilePath={filePath}
            externalFiles={externalStreamFiles}
            setExternalFiles={setExternalStreamFiles}
            showAddStreamSourceDialog={showAddStreamSourceDialog}
            streams={mainStreams}
            isCopyingStreamId={isCopyingStreamId}
            toggleCopyStreamId={toggleCopyStreamId}
            setCopyStreamIdsForPath={setCopyStreamIdsForPath}
            onExtractAllStreamsPress={onExtractAllStreamsPress}
          />
        </SideSheet>
        <Button height={20} iconBefore="list" onClick={withBlur(() => setStreamsSelectorShown(true))}>
          Tracks ({numStreamsToCopy}/{numStreamsTotal})
        </Button>

        <div style={{ flexGrow: 1 }} />

        <button
          type="button"
          onClick={withBlur(setOutputDir)}
          title={customOutDir}
        >
          {`Out path ${customOutDir ? 'set' : 'unset'}`}
        </button>

        {renderOutFmt({ width: 60 })}

        <button
          style={{ opacity: cutSegments.length < 2 ? 0.4 : undefined }}
          type="button"
          title={autoMerge ? 'Auto merge segments to one file after export' : 'Export to separate files'}
          onClick={withBlur(toggleAutoMerge)}
        >
          {autoMerge ? 'Merge cuts' : 'Separate files'}
        </button>

        <button
          type="button"
          title={`Cut mode ${keyframeCut ? 'nearest keyframe cut' : 'normal cut'}`}
          onClick={withBlur(toggleKeyframeCut)}
        >
          {keyframeCut ? 'Keyframe cut' : 'Normal cut'}
        </button>

        <button
          type="button"
          title={`Discard audio? Current: ${copyAnyAudioTrack ? 'keep audio tracks' : 'Discard audio tracks'}`}
          onClick={withBlur(toggleStripAudio)}
        >
          {copyAnyAudioTrack ? 'Keep audio' : 'Discard audio'}
        </button>

        <IoIosHelpCircle size={24} role="button" onClick={toggleHelp} style={{ verticalAlign: 'middle', marginLeft: 5 }} />
      </div>

      {!filePath && (
        <div style={{ position: 'fixed', left: 0, right: 0, top: topBarHeight, bottom: bottomBarHeight, border: '2vmin dashed #252525', color: '#505050', margin: '5vmin', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', whiteSpace: 'nowrap' }}>
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

      {working && (
        <div style={{
          color: 'white', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '.5em', margin: '1em', padding: '.2em .5em', position: 'absolute', zIndex: 1, top: topBarHeight, left: 0,
        }}
        >
          <i className="fa fa-cog fa-spin fa-3x fa-fw" style={{ verticalAlign: 'middle', width: '1em', height: '1em' }} />
          {cutProgress != null && (
            <span style={{ color: 'rgba(255, 255, 255, 0.7)', paddingLeft: '.4em' }}>
              {`${Math.floor(cutProgress * 100)} %`}
            </span>
          )}
        </div>
      )}

      <div style={{ position: 'absolute', top: topBarHeight, left: 0, right: 0, bottom: bottomBarHeight }}>
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
          position: 'absolute', top: topBarHeight, marginTop: '1em', marginRight: '1em', right: 0, color: 'white',
        }}
        >
          Lossless rotation preview
        </div>
      )}

      {filePath && (
        <div style={{
          position: 'absolute', margin: '1em', right: 0, bottom: bottomBarHeight, color: 'rgba(255,255,255,0.7)',
        }}
        >
          <VolumeIcon
            title="Mute preview? (will not affect output)"
            size={30}
            role="button"
            onClick={toggleMute}
          />
        </div>
      )}

      <div className="controls-wrapper" style={{ height: bottomBarHeight }}>
        <Hammer
          onTap={handleTap}
          onPan={handleTap}
          options={{ recognizers: {} }}
        >
          <div>
            <div style={{ height: 36, width: '100%', position: 'relative', backgroundColor: '#444' }} ref={timelineWrapperRef} onWheel={onWheel}>
              {currentTimePos !== undefined && <div style={{ position: 'absolute', bottom: 0, top: 0, left: currentTimePos, zIndex: 3, backgroundColor: 'rgba(255, 255, 255, 1)', width: 1, pointerEvents: 'none' }} />}

              <AnimatePresence>
                {apparentCutSegments.map((seg, i) => (
                  <TimelineSeg
                    key={seg.uuid}
                    segNum={i}
                    color={seg.color}
                    onSegClick={currentSegIndexNew => setCurrentSegIndex(currentSegIndexNew)}
                    isActive={i === currentSegIndex}
                    duration={durationSafe}
                    cutStart={seg.start}
                    cutEnd={seg.end}
                    invertCutSegments={invertCutSegments}
                  />
                ))}
              </AnimatePresence>

              {inverseCutSegments && inverseCutSegments.map((seg, i) => (
                <InverseCutSegment
                  // eslint-disable-next-line react/no-array-index-key
                  key={i}
                  seg={seg}
                  duration={durationSafe}
                  invertCutSegments={invertCutSegments}
                />
              ))}

              <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 3, padding: '2px 4px', color: 'rgba(255, 255, 255, 0.8)' }}>
                  {formatTimecode(offsetCurrentTime)}
                </div>
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

          <FaAngleLeft
            title="Set cut start to current position"
            style={{ background: segBgColor, borderRadius: 10, padding: 3 }}
            size={16}
            onClick={setCutStart}
            role="button"
          />

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

          <FaAngleRight
            title="Set cut end to current position"
            style={{ background: segBgColor, borderRadius: 10, padding: 3 }}
            size={16}
            onClick={setCutEnd}
            role="button"
          />

          <i
            className="button fa fa-step-forward"
            role="button"
            tabIndex="0"
            title="Jump to end of video"
            onClick={() => seekAbs(durationSafe)}
          />
        </div>
      </div>

      <div className="left-menu" style={{ position: 'absolute', left: 0, bottom: 0, padding: '.3em', display: 'flex', alignItems: 'center' }}>
        <FaPlus
          size={30}
          style={{ margin: '0 5px', color: 'white' }}
          role="button"
          title="Add segment"
          onClick={addCutSegment}
        />

        <FaMinus
          size={30}
          style={{ margin: '0 5px', background: cutSegments.length < 2 ? undefined : segBgColor, borderRadius: 3, color: 'white' }}
          role="button"
          title={`Delete current segment ${currentSegIndex + 1}`}
          onClick={removeCutSegment}
        />

        {renderInvertCutButton()}
      </div>

      <div className="right-menu" style={{ position: 'absolute', right: 0, bottom: 0, padding: '.3em', display: 'flex', alignItems: 'center' }}>
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

        {renderCaptureFormatButton()}

        <IoIosCamera
          style={{ paddingLeft: 5, paddingRight: 15 }}
          size={25}
          title="Capture frame"
          onClick={capture}
        />

        <span
          style={{ background: 'hsl(194, 78%, 47%)', borderRadius: 5, padding: '3px 7px', fontSize: 14 }}
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
      />
    </div>
  );
});

ReactDOM.render(<App />, document.getElementById('app'));

console.log('Version', electron.remote.app.getVersion());
