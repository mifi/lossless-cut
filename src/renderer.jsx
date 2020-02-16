import React, { memo, useEffect, useState, useCallback, useRef } from 'react';
import { IoIosHelpCircle, IoIosCamera } from 'react-icons/io';
import { FaPlus, FaMinus, FaAngleLeft, FaAngleRight, FaTrashAlt, FaVolumeMute, FaVolumeUp } from 'react-icons/fa';
import { MdRotate90DegreesCcw } from 'react-icons/md';
import { FiScissors } from 'react-icons/fi';
import { AnimatePresence } from 'framer-motion';

import { Popover, Button } from 'evergreen-ui';
import fromPairs from 'lodash/fromPairs';
import clamp from 'lodash/clamp';
import clone from 'lodash/clone';
import sortBy from 'lodash/sortBy';

import HelpSheet from './HelpSheet';
import TimelineSeg from './TimelineSeg';
import StreamsSelector from './StreamsSelector';
import { loadMifiLink } from './mifi';


const isDev = require('electron-is-dev');
const electron = require('electron'); // eslint-disable-line
const Mousetrap = require('mousetrap');
const Hammer = require('react-hammerjs').default;
const path = require('path');
const trash = require('trash');
const uuid = require('uuid');

const ReactDOM = require('react-dom');
const { default: PQueue } = require('p-queue');
const { unlink, exists } = require('fs-extra');


const { showMergeDialog, showOpenAndMergeDialog } = require('./merge/merge');

const captureFrame = require('./capture-frame');
const ffmpeg = require('./ffmpeg');

const { defaultProcessedCodecTypes, getStreamFps } = ffmpeg;


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
  const [currentSeg, setCurrentSeg] = useState(0);
  const [cutStartTimeManual, setCutStartTimeManual] = useState();
  const [cutEndTimeManual, setCutEndTimeManual] = useState();
  const [fileFormat, setFileFormat] = useState();
  const [detectedFileFormat, setDetectedFileFormat] = useState();
  const [rotation, setRotation] = useState(360);
  const [cutProgress, setCutProgress] = useState();
  const [startTimeOffset, setStartTimeOffset] = useState(0);
  const [rotationPreviewRequested, setRotationPreviewRequested] = useState(false);
  const [filePath, setFilePath] = useState('');
  const [detectedFps, setDetectedFps] = useState();
  const [streams, setStreams] = useState([]);
  const [copyStreamIds, setCopyStreamIds] = useState({});
  const [muted, setMuted] = useState(false);

  // Global state
  const [captureFormat, setCaptureFormat] = useState('jpeg');
  const [customOutDir, setCustomOutDir] = useState();
  const [keyframeCut, setKeyframeCut] = useState(true);
  const [autoMerge, setAutoMerge] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  const [timecodeShowFrames, setTimecodeShowFrames] = useState(false);
  const [mifiLink, setMifiLink] = useState();

  const videoRef = useRef();
  const timelineWrapperRef = useRef();


  function toggleCopyStreamId(index) {
    setCopyStreamIds(v => ({ ...v, [index]: !v[index] }));
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
    setCurrentSeg(0);
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
    setDetectedFps();
    setStreams([]);
    setCopyStreamIds({});
    setMuted(false);
  }, []);

  useEffect(() => () => {
    if (dummyVideoPath) unlink(dummyVideoPath).catch(console.error);
  }, [dummyVideoPath]);

  const frameRenderEnabled = !!(rotationPreviewRequested || dummyVideoPath);

  // Because segments could have undefined start / end (meaning extend to start of timeline or end duration)
  function getSegApparentStart(time) {
    if (time !== undefined) return time;
    return 0;
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

  const inverseCutSegments = (() => {
    if (haveInvalidSegs) return undefined;
    if (apparentCutSegments.length < 1) return undefined;

    const sorted = sortBy(apparentCutSegments, 'start');

    const foundOverlap = sorted.some((cutSegment, i) => {
      if (i === 0) return false;
      return sorted[i - 1].end > cutSegment.start;
    });

    if (foundOverlap) return undefined;

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
    cloned[currentSeg][type] = time;
    setCutSegments(cloned);
  }, [currentSeg, cutSegments]);

  function formatTimecode(sec) {
    return formatDuration({ seconds: sec, fps: timecodeShowFrames ? detectedFps : undefined });
  }

  const getCutSeg = useCallback((i) => cutSegments[i !== undefined ? i : currentSeg],
    [currentSeg, cutSegments]);

  const addCutSegment = useCallback(() => {
    const cutStartTime = getCutSeg().start;
    const cutEndTime = getCutSeg().end;

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

    const currentSegNew = cutSegmentsNew.length - 1;
    setCutSegments(cutSegmentsNew);
    setCurrentSeg(currentSegNew);
  }, [
    getCutSeg, cutSegments, currentTime, duration,
  ]);

  const setCutStart = useCallback(() => {
    const curSeg = getCutSeg();
    // https://github.com/mifi/lossless-cut/issues/168
    // If we are after the end of the last segment in the timeline,
    // add a new segment that starts at currentTime
    if (curSeg.start != null && curSeg.end != null && currentTime > curSeg.end) {
      addCutSegment();
    } else {
      setCutTime('start', currentTime);
    }
  }, [setCutTime, currentTime, getCutSeg, addCutSegment]);

  const setCutEnd = useCallback(() => setCutTime('end', currentTime), [setCutTime, currentTime]);

  async function setOutputDir() {
    const { filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    setCustomOutDir((filePaths && filePaths.length === 1) ? filePaths[0] : undefined);
  }

  const fileUri = (dummyVideoPath || html5FriendlyPath || filePath || '').replace(/#/g, '%23');

  function getOutputDir() {
    if (customOutDir) return customOutDir;
    if (filePath) return path.dirname(filePath);
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

  const getApparentCutStartTimeOrCurrent = useCallback((i) => getSegApparentStart(getCutSeg(i).start), [getCutSeg]);

  const getApparentCutEndTimeOrCurrent = useCallback((i) => {
    const cutEndTime = getCutSeg(i).end;
    return getSegApparentEnd(cutEndTime);
  }, [getCutSeg, getSegApparentEnd]);

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

  const copyAnyAudioTrack = streams.some(stream => copyStreamIds[stream.index] && stream.codec_type === 'audio');
  function toggleStripAudio() {
    setCopyStreamIds((old) => {
      const newCopyStreamIds = { ...old };
      streams.forEach((stream) => {
        if (stream.codec_type === 'audio') newCopyStreamIds[stream.index] = !copyAnyAudioTrack;
      });
      return newCopyStreamIds;
    });
  }

  const removeCutSegment = useCallback(() => {
    if (cutSegments.length < 2) return;

    const cutSegmentsNew = [...cutSegments];
    cutSegmentsNew.splice(currentSeg, 1);

    const currentSegNew = Math.min(currentSeg, cutSegmentsNew.length - 1);
    setCurrentSeg(currentSegNew);
    setCutSegments(cutSegmentsNew);
  }, [currentSeg, cutSegments]);

  const jumpCutStart = () => seekAbs(getApparentCutStartTimeOrCurrent());
  const jumpCutEnd = () => seekAbs(getApparentCutEndTimeOrCurrent());

  function handleTap(e) {
    const target = timelineWrapperRef.current;
    const rect = target.getBoundingClientRect();
    const relX = e.srcEvent.pageX - (rect.left + document.body.scrollLeft);
    seekAbs((relX / target.offsetWidth) * (duration || 0));
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

  async function deleteSourceClick() {
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
  }

  const cutClick = useCallback(async () => {
    if (working) {
      errorToast('I\'m busy');
      return;
    }

    if (haveInvalidSegs) {
      errorToast('Start time must be before end time');
      return;
    }

    try {
      setWorking(true);

      const segments = cutSegments.map((seg, i) => ({
        cutFrom: getApparentCutStartTimeOrCurrent(i),
        cutTo: getApparentCutEndTimeOrCurrent(i),
      }));

      const outFiles = await ffmpeg.cutMultiple({
        customOutDir,
        filePath,
        format: fileFormat,
        videoDuration: duration,
        rotation: effectiveRotation,
        copyStreamIds,
        keyframeCut,
        segments,
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

      toast.fire({ timer: 10000, type: 'success', title: `Cut completed! Output file(s) can be found at: ${getOutDir(customOutDir, filePath)}. You can change the output directory in settings` });
    } catch (err) {
      console.error('stdout:', err.stdout);
      console.error('stderr:', err.stderr);

      if (err.code === 1 || err.code === 'ENOENT') {
        errorToast(`Whoops! ffmpeg was unable to cut this video. Try each the following things before attempting to cut again:\n1. Select a different output format from the ${fileFormat} button (matroska takes almost everything).\n2. toggle the button "all" to "ps"`);
        return;
      }

      showFfmpegFail(err);
    } finally {
      setWorking(false);
    }
  }, [
    effectiveRotation, getApparentCutStartTimeOrCurrent, getApparentCutEndTimeOrCurrent,
    working, cutSegments, duration, filePath, keyframeCut,
    autoMerge, customOutDir, fileFormat, copyStreamIds, haveInvalidSegs,
  ]);

  function showUnsupportedFileMessage() {
    toast.fire({ timer: 10000, type: 'warning', title: 'This video is not natively supported', text: 'This means that there is no audio in the preview and it has low quality. The final cut operation will however be lossless and contains audio!' });
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

      const { streams: streamsNew } = await ffmpeg.getAllStreams(fp);
      console.log('streams', streamsNew);
      setStreams(streamsNew);
      setCopyStreamIds(fromPairs(streamsNew.map((stream) => [
        stream.index, defaultProcessedCodecTypes.includes(stream.codec_type),
      ])));


      streamsNew.find((stream) => {
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
        && !doesPlayerSupportFile(streamsNew)
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
    };
  }, [
    addCutSegment, capture, changePlaybackRate, cutClick, playCommand, removeCutSegment,
    setCutEnd, setCutStart, seekRel, shortStep,
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

  useEffect(() => {
    function fileOpened(event, filePaths) {
      if (!filePaths || filePaths.length !== 1) return;
      load(filePaths[0]);
    }

    function closeFile() {
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
      electron.ipcRenderer.removeListener('close-file', fileOpened);
      electron.ipcRenderer.removeListener('html5ify', html5ify);
      electron.ipcRenderer.removeListener('show-merge-dialog', showOpenAndMergeDialog2);
      electron.ipcRenderer.removeListener('set-start-offset', setStartOffset);
      electron.ipcRenderer.removeListener('extract-all-streams', extractAllStreams);
    };
  }, [
    load, mergeFiles, outputDir, filePath, customOutDir, startTimeOffset, getHtml5ifiedPath,
    createDummyVideo, resetState, extractAllStreams,
  ]);

  const onDrop = useCallback((ev) => {
    ev.preventDefault();
    const { files } = ev.dataTransfer;
    if (files.length < 1) return;
    if (files.length === 1) load(files[0].path);
    else showMergeDialog(Array.from(files).map(f => f.path), mergeFiles);
  }, [load, mergeFiles]);

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

    const cutTime = type === 'start' ? getApparentCutStartTimeOrCurrent() : getApparentCutEndTimeOrCurrent();

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

  const selectableFormats = ['mov', 'mp4', 'matroska'].filter(f => f !== detectedFileFormat);

  const durationSafe = duration || 1;
  const currentTimePos = currentTime !== undefined && `${(currentTime / durationSafe) * 100}%`;

  const segColor = (getCutSeg() || {}).color;
  const segBgColor = segColor.alpha(0.5).string();

  const jumpCutButtonStyle = {
    position: 'absolute', color: 'black', bottom: 0, top: 0, padding: '2px 8px',
  };

  function renderOutFmt({ width } = {}) {
    return (
      <select style={{ width }} defaultValue="" value={fileFormat} title="Format of current file" onChange={withBlur(e => setFileFormat(e.target.value))}>
        <option key="" value="" disabled>Out fmt</option>
        {detectedFileFormat && (
          <option key={detectedFileFormat} value={detectedFileFormat}>
            {detectedFileFormat}
          </option>
        )}
        {selectableFormats.map(f => <option key={f} value={f}>{f}</option>)}
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
                {autoMerge ? 'Auto merge segments to one file' : 'Export separate segments'}
              </button>
            </td>
          </tr>

          <tr>
            <td>Cut mode</td>
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
              Delete audio?
            </td>
            <td>
              <button
                type="button"
                onClick={toggleStripAudio}
              >
                {!copyAnyAudioTrack ? 'Delete all audio tracks' : 'Keep audio tracks'}
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

  return (
    <div>
      <div style={{ background: '#6b6b6b', height: topBarHeight, display: 'flex', alignItems: 'center', padding: '0 5px', justifyContent: 'space-between' }}>
        <Popover
          content={(
            <StreamsSelector
              streams={streams}
              copyStreamIds={copyStreamIds}
              toggleCopyStreamId={toggleCopyStreamId}
              onExtractAllStreamsPress={onExtractAllStreamsPress}
            />
          )}
        >
          <Button height={20} iconBefore="list">Tracks</Button>
        </Popover>

        <div style={{ flexGrow: 1 }} />

        {renderOutFmt({ width: 60 })}

        <button
          style={{ opacity: cutSegments.length < 2 ? 0.4 : undefined }}
          type="button"
          title={`Auto merge segments to one file after export? ${autoMerge ? 'Auto merge enabled' : 'No merging'}`}
          onClick={withBlur(toggleAutoMerge)}
        >
          {autoMerge ? 'Merge cuts' : 'Separate cuts'}
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
          title={`Delete audio? Current: ${copyAnyAudioTrack ? 'keep audio tracks' : 'delete audio tracks'}`}
          onClick={withBlur(toggleStripAudio)}
        >
          {copyAnyAudioTrack ? 'Keep audio' : 'Delete audio'}
        </button>

        <IoIosHelpCircle size={24} role="button" onClick={toggleHelp} style={{ verticalAlign: 'middle', marginLeft: 5 }} />
      </div>

      {!filePath && (
        <div style={{ position: 'fixed', left: 0, right: 0, top: topBarHeight, bottom: bottomBarHeight, border: '2vmin dashed #252525', color: '#505050', margin: '5vmin', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', whiteSpace: 'nowrap' }}>
          <div style={{ fontSize: '9vmin' }}>DROP VIDEO</div>

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
            <div className="timeline-wrapper" ref={timelineWrapperRef}>
              {currentTimePos !== undefined && <div style={{ position: 'absolute', bottom: 0, top: 0, left: currentTimePos, zIndex: 3, backgroundColor: 'rgba(255, 255, 255, 1)', width: 1, pointerEvents: 'none' }} />}

              <AnimatePresence>
                {cutSegments.map((seg, i) => (
                  <TimelineSeg
                    key={seg.uuid}
                    segNum={i}
                    color={seg.color}
                    onSegClick={currentSegNew => setCurrentSeg(currentSegNew)}
                    isActive={i === currentSeg}
                    duration={durationSafe}
                    apparentCutStart={getApparentCutStartTimeOrCurrent(i)}
                    apparentCutEnd={getApparentCutEndTimeOrCurrent(i)}
                  />
                ))}
              </AnimatePresence>

              <div>
                {inverseCutSegments && inverseCutSegments.map((seg) => (
                  <div
                    key={seg.start}
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: `${(seg.start / duration) * 100}%`,
                      width: `${Math.max(((seg.end - seg.start) / duration) * 100, 1)}%`,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ flexGrow: 1, borderBottom: '1px dashed rgba(255, 255, 255, 0.3)', marginLeft: 5, marginRight: 5 }} />
                    <FaTrashAlt
                      style={{ color: 'rgba(255, 255, 255, 0.3)' }}
                      size={16}
                    />
                    <div style={{ flexGrow: 1, borderBottom: '1px dashed rgba(255, 255, 255, 0.3)', marginLeft: 5, marginRight: 5 }} />
                  </div>
                ))}
              </div>

              <div style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.8)', padding: '.5em' }}>
                <span role="button" onClick={() => setTimecodeShowFrames(v => !v)} style={{ background: 'rgba(0,0,0,0.5)', borderRadius: 3, padding: '2px 4px' }}>
                  {formatTimecode(offsetCurrentTime)}
                </span>
              </div>
            </div>
          </div>
        </Hammer>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <FaAngleLeft
            title="Set cut start to current position"
            style={{ background: segBgColor, borderRadius: 10, padding: 3 }}
            size={16}
            onClick={setCutStart}
            role="button"
          />

          <i
            className="button fa fa-step-backward"
            role="button"
            tabIndex="0"
            title="Jump to start of video"
            onClick={() => seekAbs(0)}
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

          <i
            className="button fa fa-step-forward"
            role="button"
            tabIndex="0"
            title="Jump to end of video"
            onClick={() => seekAbs(durationSafe)}
          />

          <FaAngleRight
            title="Set cut end to current position"
            style={{ background: segBgColor, borderRadius: 10, padding: 3 }}
            size={16}
            onClick={setCutEnd}
            role="button"
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
          title={`Delete current segment ${currentSeg + 1}`}
          onClick={removeCutSegment}
        />
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
          onClick={deleteSourceClick}
          role="button"
        />

        {renderCaptureFormatButton()}

        <IoIosCamera
          style={{ paddingLeft: 5, paddingRight: 15 }}
          size={25}
          title="Capture frame"
          onClick={capture}
        />

        <span style={{ background: 'hsl(194, 78%, 47%)', borderRadius: 5, padding: '3px 7px', fontSize: 14 }}>
          <FiScissors
            style={{ verticalAlign: 'middle', marginRight: 3 }}
            size={16}
            onClick={cutClick}
            title={cutSegments.length > 1 ? 'Export all segments' : 'Export selection'}
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
