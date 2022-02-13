import React, { memo, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { unstable_batchedUpdates as batchedUpdates } from 'react-dom';
import { FaAngleLeft, FaWindowClose, FaTimes } from 'react-icons/fa';
import { AnimatePresence, motion } from 'framer-motion';
import Lottie from 'react-lottie-player';
import { SideSheet, Button, Position, ForkIcon, DisableIcon, Select, ThemeProvider, MergeColumnsIcon } from 'evergreen-ui';
import { useStateWithHistory } from 'react-use/lib/useStateWithHistory';
import useDebounceOld from 'react-use/lib/useDebounce'; // Want to phase out this
import { useDebounce } from 'use-debounce';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';
import Mousetrap from 'mousetrap';
import JSON5 from 'json5';

import fromPairs from 'lodash/fromPairs';
import sortBy from 'lodash/sortBy';
import flatMap from 'lodash/flatMap';
import isEqual from 'lodash/isEqual';

import theme from './theme';
import useTimelineScroll from './hooks/useTimelineScroll';
import useUserPreferences from './hooks/useUserPreferences';
import useFfmpegOperations from './hooks/useFfmpegOperations';
import useKeyframes from './hooks/useKeyframes';
import useWaveform from './hooks/useWaveform';
import NoFileLoaded from './NoFileLoaded';
import Canvas from './Canvas';
import TopMenu from './TopMenu';
import HelpSheet from './HelpSheet';
import SettingsSheet from './SettingsSheet';
import StreamsSelector from './StreamsSelector';
import SegmentList from './SegmentList';
import Settings from './Settings';
import Timeline from './Timeline';
import BottomLeftMenu from './BottomLeftMenu';
import BottomRightMenu from './BottomRightMenu';
import TimelineControls from './TimelineControls';
import ExportConfirm from './ExportConfirm';
import ValueTuner from './components/ValueTuner';
import VolumeControl from './components/VolumeControl';
import SubtitleControl from './components/SubtitleControl';
import BatchFile from './components/BatchFile';
import ConcatDialog from './components/ConcatDialog';

import { loadMifiLink } from './mifi';
import { primaryColor, controlsBackground, timelineBackground } from './colors';
import allOutFormats from './outFormats';
import { captureFrameFromTag, captureFrameFfmpeg } from './capture-frame';
import {
  defaultProcessedCodecTypes, getStreamFps, isCuttingStart, isCuttingEnd,
  readFileMeta, getFormatData, renderThumbnails as ffmpegRenderThumbnails,
  extractStreams, getAllStreams, runStartupCheck,
  isAudioDefinitelyNotSupported, isIphoneHevc, tryMapChaptersToEdl,
  getDuration, getTimecodeFromStreams, createChaptersFromSegments, extractSubtitleTrack,
} from './ffmpeg';
import { exportEdlFile, readEdlFile, saveLlcProject, loadLlcProject, readEdl } from './edlStore';
import { formatYouTube } from './edlFormats';
import {
  getOutPath, toast, errorToast, handleError, setFileNameTitle, getOutDir, withBlur,
  checkDirWriteAccess, dirExists, openDirToast, isMasBuild, isStoreBuild, dragPreventer, doesPlayerSupportFile,
  isDurationValid, isWindows, filenamify, getOutFileExtension, generateSegFileName, defaultOutSegTemplate,
  hasDuplicates, havePermissionToReadFile, isMac, resolvePathIfNeeded, pathExists, html5ifiedPrefix, html5dummySuffix, findExistingHtml5FriendlyFile,
  deleteFiles, getHtml5ifiedPath, isStreamThumbnail, getAudioStreams, getVideoStreams, isOutOfSpaceError,
} from './util';
import { formatDuration } from './util/duration';
import { adjustRate } from './util/rate-calculator';
import { askForOutDir, askForImportChapters, createNumSegments, createFixedDurationSegments, promptTimeOffset, askForHtml5ifySpeed, askForFileOpenAction, confirmExtractAllStreamsDialog, cleanupFilesDialog, showDiskFull, showCutFailedDialog, labelSegmentDialog, openYouTubeChaptersDialog, showMergeFilesOpenDialog, openAbout, showEditableJsonDialog } from './dialogs';
import { openSendReportDialog } from './reporting';
import { fallbackLng } from './i18n';
import { createSegment, getCleanCutSegments, getSegApparentStart, findSegmentsAtCursor, sortSegments, invertSegments, getSegmentTags } from './segments';

import loadingLottie from './7077-magic-flow.json';


const isDev = window.require('electron-is-dev');
const electron = window.require('electron'); // eslint-disable-line
const { exists } = window.require('fs-extra');
const filePathToUrl = window.require('file-url');
const { extname, parse: parsePath, sep: pathSep, join: pathJoin, normalize: pathNormalize, basename, dirname } = window.require('path');

const { dialog } = electron.remote;

const { focusWindow } = electron.remote.require('./electron');


const ffmpegExtractWindow = 60;
const calcShouldShowWaveform = (zoomedDuration) => (zoomedDuration != null && zoomedDuration < ffmpegExtractWindow * 8);
const calcShouldShowKeyframes = (zoomedDuration) => (zoomedDuration != null && zoomedDuration < ffmpegExtractWindow * 8);


const commonFormats = ['mov', 'mp4', 'matroska', 'mp3', 'ipod'];

// TODO flex
const topBarHeight = 32;
const timelineHeight = 36;
const zoomMax = 2 ** 14;

const videoStyle = { width: '100%', height: '100%', objectFit: 'contain' };


const App = memo(() => {
  // Per project state
  const [commandedTime, setCommandedTime] = useState(0);
  const [ffmpegCommandLog, setFfmpegCommandLog] = useState([]);

  const [previewFilePath, setPreviewFilePath] = useState();
  const [working, setWorkingState] = useState();
  const [usingDummyVideo, setUsingDummyVideo] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [playerTime, setPlayerTime] = useState();
  const [duration, setDuration] = useState();
  const [fileFormat, setFileFormat] = useState();
  const [fileFormatData, setFileFormatData] = useState();
  const [chapters, setChapters] = useState();
  const [detectedFileFormat, setDetectedFileFormat] = useState();
  const [rotation, setRotation] = useState(360);
  const [cutProgress, setCutProgress] = useState();
  const [startTimeOffset, setStartTimeOffset] = useState(0);
  const [filePath, setFilePath] = useState('');
  const [externalStreamFiles, setExternalStreamFiles] = useState([]);
  const [customTagsByFile, setCustomTagsByFile] = useState({});
  const [customTagsByStreamId, setCustomTagsByStreamId] = useState({});
  const [dispositionByStreamId, setDispositionByStreamId] = useState({});
  const [detectedFps, setDetectedFps] = useState();
  const [mainStreams, setMainStreams] = useState([]);
  const [mainVideoStream, setMainVideoStream] = useState();
  const [mainAudioStream, setMainAudioStream] = useState();
  const [copyStreamIdsByFile, setCopyStreamIdsByFile] = useState({});
  const [streamsSelectorShown, setStreamsSelectorShown] = useState(false);
  const [concatDialogVisible, setConcatDialogVisible] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [thumbnails, setThumbnails] = useState([]);
  const [shortestFlag, setShortestFlag] = useState(false);
  const [zoomWindowStartTime, setZoomWindowStartTime] = useState(0);
  const [disabledSegmentIds, setDisabledSegmentIds] = useState({});
  const [subtitlesByStreamId, setSubtitlesByStreamId] = useState({});
  const [activeSubtitleStreamIndex, setActiveSubtitleStreamIndex] = useState();
  const [hideCanvasPreview, setHideCanvasPreview] = useState(false);
  const [exportConfirmVisible, setExportConfirmVisible] = useState(false);

  // State per application launch
  const [keyframesEnabled, setKeyframesEnabled] = useState(true);
  const [waveformEnabled, setWaveformEnabled] = useState(false);
  const [thumbnailsEnabled, setThumbnailsEnabled] = useState(false);
  const [showRightBar, setShowRightBar] = useState(true);
  const [cleanupChoices, setCleanupChoices] = useState({ tmpFiles: true });
  const [rememberConvertToSupportedFormat, setRememberConvertToSupportedFormat] = useState();
  const [helpVisible, setHelpVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [tunerVisible, setTunerVisible] = useState();
  const [mifiLink, setMifiLink] = useState();
  const [alwaysConcatMultipleFiles, setAlwaysConcatMultipleFiles] = useState(false);

  // Batch state / concat files
  const [batchFiles, setBatchFiles] = useState([]);

  // Segment related state
  const segCounterRef = useRef(0);
  const clearSegCounter = useCallback(() => {
    segCounterRef.current = 0;
  }, []);

  const createSegmentAndIncrementCount = useCallback((segment) => {
    const ret = createSegment({ segIndex: segCounterRef.current, ...segment });
    segCounterRef.current += 1;
    return ret;
  }, []);

  const createInitialCutSegments = useCallback(() => () => [createSegmentAndIncrementCount()], [createSegmentAndIncrementCount]);

  const [currentSegIndex, setCurrentSegIndex] = useState(0);
  const [cutStartTimeManual, setCutStartTimeManual] = useState();
  const [cutEndTimeManual, setCutEndTimeManual] = useState();
  const [cutSegments, setCutSegments, cutSegmentsHistory] = useStateWithHistory(
    createInitialCutSegments(),
    100,
  );

  const clearSegments = useCallback(() => {
    clearSegCounter();
    setCutSegments(createInitialCutSegments());
  }, [clearSegCounter, createInitialCutSegments, setCutSegments]);

  // Store "working" in a ref so we can avoid race conditions
  const workingRef = useRef(working);
  const setWorking = useCallback((val) => {
    workingRef.current = val;
    setWorkingState(val);
  }, []);

  const durationSafe = isDurationValid(duration) ? duration : 1;
  const zoomedDuration = isDurationValid(duration) ? duration / zoom : undefined;

  const isCustomFormatSelected = fileFormat !== detectedFileFormat;

  const {
    captureFormat, setCaptureFormat, customOutDir, setCustomOutDir, keyframeCut, setKeyframeCut, preserveMovData, setPreserveMovData, movFastStart, setMovFastStart, avoidNegativeTs, setAvoidNegativeTs, autoMerge, setAutoMerge, timecodeFormat, setTimecodeFormat, invertCutSegments, setInvertCutSegments, autoExportExtraStreams, setAutoExportExtraStreams, askBeforeClose, setAskBeforeClose, enableAskForImportChapters, setEnableAskForImportChapters, enableAskForFileOpenAction, setEnableAskForFileOpenAction, playbackVolume, setPlaybackVolume, autoSaveProjectFile, setAutoSaveProjectFile, wheelSensitivity, setWheelSensitivity, invertTimelineScroll, setInvertTimelineScroll, language, setLanguage, ffmpegExperimental, setFfmpegExperimental, hideNotifications, setHideNotifications, autoLoadTimecode, setAutoLoadTimecode, autoDeleteMergedSegments, setAutoDeleteMergedSegments, exportConfirmEnabled, setExportConfirmEnabled, segmentsToChapters, setSegmentsToChapters, preserveMetadataOnMerge, setPreserveMetadataOnMerge, simpleMode, setSimpleMode, outSegTemplate, setOutSegTemplate, keyboardSeekAccFactor, setKeyboardSeekAccFactor, keyboardNormalSeekSpeed, setKeyboardNormalSeekSpeed, enableTransferTimestamps, setEnableTransferTimestamps, outFormatLocked, setOutFormatLocked, safeOutputFileName, setSafeOutputFileName, enableAutoHtml5ify, setEnableAutoHtml5ify,
  } = useUserPreferences();

  const {
    mergeFiles: ffmpegMergeFiles, html5ifyDummy, cutMultiple, autoMergeSegments, html5ify: ffmpegHtml5ify, fixInvalidDuration,
  } = useFfmpegOperations({ filePath, enableTransferTimestamps });

  const outSegTemplateOrDefault = outSegTemplate || defaultOutSegTemplate;

  useEffect(() => {
    const l = language || fallbackLng;
    i18n.changeLanguage(l).catch(console.error);
    electron.ipcRenderer.send('setLanguage', l);
  }, [language]);

  const videoRef = useRef();
  const currentTimeRef = useRef();

  const isFileOpened = !!filePath;

  const onOutFormatLockedClick = () => setOutFormatLocked((v) => (v ? undefined : fileFormat));

  const onOutputFormatUserChange = useCallback((newFormat) => {
    setFileFormat(newFormat);
    if (outFormatLocked) {
      setOutFormatLocked(newFormat === detectedFileFormat ? undefined : newFormat);
    }
  }, [detectedFileFormat, outFormatLocked, setOutFormatLocked]);

  const setTimelineMode = useCallback((newMode) => {
    if (newMode === 'waveform') {
      setWaveformEnabled(v => !v);
      setThumbnailsEnabled(false);
    } else {
      setThumbnailsEnabled(v => !v);
      setWaveformEnabled(false);
    }
  }, []);

  const toggleExportConfirmEnabled = useCallback(() => setExportConfirmEnabled((v) => !v), [setExportConfirmEnabled]);

  const toggleSegmentsToChapters = useCallback(() => setSegmentsToChapters((v) => !v), [setSegmentsToChapters]);

  const togglePreserveMetadataOnMerge = useCallback(() => setPreserveMetadataOnMerge((v) => !v), [setPreserveMetadataOnMerge]);

  const toggleKeyframesEnabled = useCallback(() => {
    setKeyframesEnabled((old) => {
      const enabled = !old;
      if (enabled && !calcShouldShowKeyframes(zoomedDuration)) {
        toast.fire({ text: i18n.t('Key frames will show on the timeline. You need to zoom in to view them') });
      }
      return enabled;
    });
  }, [zoomedDuration]);

  function appendFfmpegCommandLog(command) {
    setFfmpegCommandLog(old => [...old, { command, time: new Date() }]);
  }

  const getCurrentTime = useCallback(() => currentTimeRef.current, []);

  const setCopyStreamIdsForPath = useCallback((path, cb) => {
    setCopyStreamIdsByFile((old) => {
      const oldIds = old[path] || {};
      return ({ ...old, [path]: cb(oldIds) });
    });
  }, []);

  const toggleRightBar = useCallback(() => setShowRightBar(v => !v), []);

  const toggleCopyStreamId = useCallback((path, index) => {
    setCopyStreamIdsForPath(path, (old) => ({ ...old, [index]: !old[index] }));
  }, [setCopyStreamIdsForPath]);

  const hideAllNotifications = hideNotifications === 'all';

  const toggleSafeOutputFileName = useCallback(() => setSafeOutputFileName((v) => {
    if (v && !hideAllNotifications) toast.fire({ icon: 'info', text: i18n.t('Output file name will not be sanitized, and any special characters will be preserved. This may cause the export to fail and can cause other funny issues. Use at your own risk!') });
    return !v;
  }), [setSafeOutputFileName, hideAllNotifications]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = playbackVolume;
  }, [playbackVolume]);

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

  const commandedTimeRef = useRef(commandedTime);
  useEffect(() => {
    commandedTimeRef.current = commandedTime;
  }, [commandedTime]);

  const seekRel = useCallback((val) => {
    seekAbs(videoRef.current.currentTime + val);
  }, [seekAbs]);

  const seekRelPercent = useCallback((val) => {
    if (!isDurationValid(zoomedDuration)) return;
    seekRel(val * zoomedDuration);
  }, [seekRel, zoomedDuration]);

  const shortStep = useCallback((dir) => {
    seekRel((1 / (detectedFps || 60)) * dir);
  }, [seekRel, detectedFps]);

  // 360 means we don't modify rotation
  const isRotationSet = rotation !== 360;
  const effectiveRotation = isRotationSet ? rotation : (mainVideoStream && mainVideoStream.tags && mainVideoStream.tags.rotate && parseInt(mainVideoStream.tags.rotate, 10));

  const zoomRel = useCallback((rel) => setZoom(z => Math.min(Math.max(z + rel, 1), zoomMax)), []);
  const canvasPlayerRequired = !!(mainVideoStream && usingDummyVideo);
  const canvasPlayerWanted = !!(mainVideoStream && isRotationSet && !hideCanvasPreview);
  // Allow user to disable it
  const canvasPlayerEnabled = (canvasPlayerRequired || canvasPlayerWanted);

  useEffect(() => {
    // Reset the user preference when the state changes to true
    if (canvasPlayerEnabled) setHideCanvasPreview(false);
  }, [canvasPlayerEnabled]);

  const comfortZoom = isDurationValid(duration) ? Math.max(duration / 100, 1) : undefined;
  const toggleComfortZoom = useCallback(() => {
    if (!comfortZoom) return;

    setZoom((prevZoom) => {
      if (prevZoom === 1) return comfortZoom;
      return 1;
    });
  }, [comfortZoom]);

  const onTimelineWheel = useTimelineScroll({ wheelSensitivity, invertTimelineScroll, zoomRel, seekRel });

  const getSegApparentEnd = useCallback((seg) => {
    const time = seg.end;
    if (time !== undefined) return time;
    if (isDurationValid(duration)) return duration;
    return 0; // Haven't gotten duration yet
  }, [duration]);

  const apparentCutSegments = useMemo(() => cutSegments.map(cutSegment => ({
    ...cutSegment,
    start: getSegApparentStart(cutSegment),
    end: getSegApparentEnd(cutSegment),
  })), [cutSegments, getSegApparentEnd]);

  const haveInvalidSegs = useMemo(() => apparentCutSegments.filter(cutSegment => cutSegment.start >= cutSegment.end).length > 0, [apparentCutSegments]);

  const currentSegIndexSafe = Math.min(currentSegIndex, cutSegments.length - 1);
  const currentCutSeg = useMemo(() => cutSegments[currentSegIndexSafe], [currentSegIndexSafe, cutSegments]);
  const currentApparentCutSeg = useMemo(() => apparentCutSegments[currentSegIndexSafe], [apparentCutSegments, currentSegIndexSafe]);
  const areWeCutting = apparentCutSegments.length > 1
    || isCuttingStart(currentApparentCutSeg.start)
    || isCuttingEnd(currentApparentCutSeg.end, duration);

  const jumpSegStart = useCallback((index) => seekAbs(apparentCutSegments[index].start), [apparentCutSegments, seekAbs]);
  const jumpSegEnd = useCallback((index) => seekAbs(apparentCutSegments[index].end), [apparentCutSegments, seekAbs]);
  const jumpCutStart = useCallback(() => jumpSegStart(currentSegIndexSafe), [currentSegIndexSafe, jumpSegStart]);
  const jumpCutEnd = useCallback(() => jumpSegEnd(currentSegIndexSafe), [currentSegIndexSafe, jumpSegEnd]);

  const sortedCutSegments = useMemo(() => sortSegments(apparentCutSegments), [apparentCutSegments]);

  const inverseCutSegments = useMemo(() => {
    const inverted = !haveInvalidSegs && isDurationValid(duration) ? invertSegments(sortedCutSegments, duration) : undefined;
    return (inverted || []).map((seg) => ({ ...seg, segId: `${seg.start}-${seg.end}` }));
  }, [duration, haveInvalidSegs, sortedCutSegments]);

  const invertAllCutSegments = useCallback(() => {
    // don't reset segIndex (which represent colors) when inverting
    const newInverseCutSegments = inverseCutSegments.map((inverseSegment, segIndex) => createSegment({ ...inverseSegment, segIndex }));
    if (newInverseCutSegments.length < 1) {
      errorToast(i18n.t('Make sure you have no overlapping segments.'));
      return;
    }
    setCutSegments(newInverseCutSegments);
  }, [inverseCutSegments, setCutSegments]);

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

  const maxLabelLength = safeOutputFileName ? 100 : 500;

  const onLabelSegmentPress = useCallback(async (index) => {
    const { name } = cutSegments[index];
    const value = await labelSegmentDialog({ currentName: name, maxLength: maxLabelLength });
    if (value != null) updateSegAtIndex(index, { name: value });
  }, [cutSegments, updateSegAtIndex, maxLabelLength]);

  const onViewSegmentTagsPress = useCallback(async (index) => {
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
  }, [cutSegments, setCutSegments]);

  const updateSegOrders = useCallback((newOrders) => {
    const newSegments = sortBy(cutSegments, (seg) => newOrders.indexOf(seg.segId));
    const newCurrentSegIndex = newOrders.indexOf(currentCutSeg.segId);
    setCutSegments(newSegments);
    if (newCurrentSegIndex >= 0 && newCurrentSegIndex < newSegments.length) setCurrentSegIndex(newCurrentSegIndex);
  }, [cutSegments, setCutSegments, currentCutSeg]);

  const reorderSegsByStartTime = useCallback(() => {
    setCutSegments(sortBy(cutSegments, getSegApparentStart));
  }, [cutSegments, setCutSegments]);

  const getFrameCount = useCallback((sec) => {
    if (detectedFps == null) return undefined;
    return Math.floor(sec * detectedFps);
  }, [detectedFps]);

  const formatTimecode = useCallback(({ seconds, shorten }) => {
    if (timecodeFormat === 'frameCount') {
      const frameCount = getFrameCount(seconds);
      return frameCount != null ? frameCount : '';
    }
    if (timecodeFormat === 'timecodeWithFramesFraction') {
      return formatDuration({ seconds, fps: detectedFps, shorten });
    }
    return formatDuration({ seconds, shorten });
  }, [detectedFps, timecodeFormat, getFrameCount]);

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
        createSegmentAndIncrementCount({ start: suggestedStart }),
      ];

      setCutSegments(cutSegmentsNew);
      setCurrentSegIndex(cutSegmentsNew.length - 1);
    } catch (err) {
      console.error(err);
    }
  }, [currentCutSeg.start, currentCutSeg.end, cutSegments, createSegmentAndIncrementCount, setCutSegments]);

  const setCutStart = useCallback(() => {
    if (!filePath) return;

    // https://github.com/mifi/lossless-cut/issues/168
    // If current time is after the end of the current segment in the timeline,
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
        handleError(err);
      }
    }
  }, [setCutTime, currentCutSeg, addCutSegment, filePath]);

  const setCutEnd = useCallback(() => {
    if (!filePath) return;

    try {
      const endTime = currentTimeRef.current;

      /* if (keyframeCut) {
        const keyframeAlignedCutTo = getSafeCutTime(endTime, false);
        if (keyframeAlignedCutTo != null) endTime = keyframeAlignedCutTo;
      } */
      setCutTime('end', endTime);
    } catch (err) {
      handleError(err);
    }
  }, [setCutTime, filePath]);

  const outputDir = getOutDir(customOutDir, filePath);

  const changeOutDir = useCallback(async () => {
    const newOutDir = await askForOutDir(outputDir);
    if (newOutDir) setCustomOutDir(newOutDir);
  }, [outputDir, setCustomOutDir]);

  const clearOutDir = useCallback(() => {
    setCustomOutDir();
  }, [setCustomOutDir]);

  const usingPreviewFile = !!previewFilePath;
  const effectiveFilePath = previewFilePath || filePath;
  const fileUri = effectiveFilePath ? filePathToUrl(effectiveFilePath) : '';

  const projectSuffix = 'proj.llc';
  const oldProjectSuffix = 'llc-edl.csv';
  // New LLC format is stored along with input file https://github.com/mifi/lossless-cut/issues/905
  const getEdlFilePath = useCallback((fp) => getOutPath({ filePath: fp, nameSuffix: projectSuffix }), []);
  // Old versions of LosslessCut used CSV files and stored them in customOutDir:
  const getEdlFilePathOld = useCallback((fp) => getOutPath({ customOutDir, filePath: fp, nameSuffix: oldProjectSuffix }), [customOutDir]);
  const edlFilePath = useMemo(() => getEdlFilePath(filePath), [getEdlFilePath, filePath]);

  const currentSaveOperation = useMemo(() => {
    if (!edlFilePath) return undefined;
    return { cutSegments, edlFilePath, filePath };
  }, [cutSegments, edlFilePath, filePath]);

  const [debouncedSaveOperation] = useDebounce(currentSaveOperation, isDev ? 2000 : 500);

  const lastSaveOperation = useRef();
  useEffect(() => {
    async function save() {
      // NOTE: Could lose a save if user closes too fast, but not a big issue I think
      if (!autoSaveProjectFile || !debouncedSaveOperation) return;

      const { cutSegments: saveOperationCutSegments, edlFilePath: saveOperationEdlFilePath, filePath: saveOperationFilePath } = debouncedSaveOperation;

      try {
        // Initial state? Don't save (same as createInitialCutSegments but without counting)
        if (isEqual(getCleanCutSegments(saveOperationCutSegments), getCleanCutSegments([createSegment()]))) return;

        if (lastSaveOperation.current && lastSaveOperation.current.edlFilePath === saveOperationEdlFilePath && isEqual(getCleanCutSegments(lastSaveOperation.current.cutSegments), getCleanCutSegments(saveOperationCutSegments))) {
          console.log('Segments unchanged, skipping save');
          return;
        }

        await saveLlcProject({ savePath: saveOperationEdlFilePath, filePath: saveOperationFilePath, cutSegments: saveOperationCutSegments });
        lastSaveOperation.current = debouncedSaveOperation;
      } catch (err) {
        errorToast(i18n.t('Unable to save project file'));
        console.error('Failed to save CSV', err);
      }
    }
    save();
  }, [debouncedSaveOperation, autoSaveProjectFile]);

  function onPlayingChange(val) {
    setPlaying(val);
    if (!val) {
      setCommandedTime(videoRef.current.currentTime);
    }
  }

  const onStopPlaying = useCallback(() => onPlayingChange(false), []);
  const onSartPlaying = useCallback(() => onPlayingChange(true), []);
  const onDurationChange = useCallback((e) => {
    // Some files report duration infinity first, then proper duration later
    // Sometimes after seeking to end of file, duration might change
    const { duration: durationNew } = e.target;
    console.log('onDurationChange', durationNew);
    if (isDurationValid(durationNew)) setDuration(durationNew);
  }, []);

  const onTimeUpdate = useCallback((e) => {
    const { currentTime } = e.target;
    if (playerTime === currentTime) return;
    setPlayerTime(currentTime);
  }, [playerTime]);

  const increaseRotation = useCallback(() => {
    setRotation((r) => (r + 90) % 450);
    setHideCanvasPreview(false);
    // Matroska is known not to work, so we warn user. See https://github.com/mifi/lossless-cut/discussions/661
    const supportsRotation = !['matroska', 'webm'].includes(fileFormat);
    if (!supportsRotation && !hideAllNotifications) toast.fire({ text: i18n.t('Lossless rotation might not work with this file format. You may try changing to MP4') });
  }, [hideAllNotifications, fileFormat]);

  const ensureOutDirAccessible = useCallback(async (outFilePath) => {
    let newCustomOutDir = customOutDir;

    // Reset if doesn't exist anymore
    const customOutDirExists = await dirExists(customOutDir);
    if (!customOutDirExists) {
      setCustomOutDir(undefined);
      newCustomOutDir = undefined;
    }

    const effectiveOutDirPath = getOutDir(newCustomOutDir, outFilePath);
    const hasDirWriteAccess = await checkDirWriteAccess(effectiveOutDirPath);
    if (!hasDirWriteAccess) {
      if (isMasBuild) {
        const newOutDir = await askForOutDir(effectiveOutDirPath);
        // If user canceled open dialog, refuse to continue, because we will get permission denied error from MAS sandbox
        if (!newOutDir) return { cancel: true };
        setCustomOutDir(newOutDir);
        newCustomOutDir = newOutDir;
      } else {
        errorToast(i18n.t('You have no write access to the directory of this file, please select a custom working dir'));
        setCustomOutDir(undefined);
        return { cancel: true };
      }
    }

    return { cancel: false, newCustomOutDir };
  }, [customOutDir, setCustomOutDir]);

  const mergeFiles = useCallback(async ({ paths, allStreams }) => {
    if (workingRef.current) return;
    try {
      setConcatDialogVisible(false);
      setWorking(i18n.t('Merging'));

      const firstPath = paths[0];
      const { newCustomOutDir, cancel } = await ensureOutDirAccessible(firstPath);
      if (cancel) return;

      const ext = extname(firstPath);
      const outPath = getOutPath({ customOutDir: newCustomOutDir, filePath: firstPath, nameSuffix: `merged${ext}` });
      const outDir = getOutDir(customOutDir, firstPath);

      let chaptersFromSegments;
      if (segmentsToChapters) {
        const chapterNames = paths.map((path) => parsePath(path).name);
        chaptersFromSegments = await createChaptersFromSegments({ segmentPaths: paths, chapterNames });
      }

      // console.log('merge', paths);
      await ffmpegMergeFiles({ paths, outPath, outDir, allStreams, ffmpegExperimental, onProgress: setCutProgress, preserveMovData, movFastStart, preserveMetadataOnMerge, chapters: chaptersFromSegments });
      openDirToast({ icon: 'success', dirPath: outDir, text: i18n.t('Files merged!') });
    } catch (err) {
      if (isOutOfSpaceError(err)) {
        showDiskFull();
        return;
      }
      errorToast(i18n.t('Failed to merge files. Make sure they are all of the exact same codecs'));
      console.error('Failed to merge files', err);
    } finally {
      setWorking();
      setCutProgress();
    }
  }, [setWorking, ensureOutDirAccessible, customOutDir, segmentsToChapters, ffmpegMergeFiles, ffmpegExperimental, preserveMovData, movFastStart, preserveMetadataOnMerge]);

  const toggleCaptureFormat = useCallback(() => setCaptureFormat(f => (f === 'png' ? 'jpeg' : 'png')), [setCaptureFormat]);

  const toggleKeyframeCut = useCallback((showMessage) => setKeyframeCut((val) => {
    const newVal = !val;
    if (showMessage && !hideAllNotifications) {
      if (newVal) toast.fire({ title: i18n.t('Keyframe cut enabled'), text: i18n.t('Will now cut at the nearest keyframe before the desired start cutpoint. This is recommended for most files.') });
      else toast.fire({ title: i18n.t('Keyframe cut disabled'), text: i18n.t('Will now cut at the exact position, but may leave an empty portion at the beginning of the file. You may have to set the cutpoint a few frames before the next keyframe to achieve a precise cut'), timer: 7000 });
    }
    return newVal;
  }), [hideAllNotifications, setKeyframeCut]);

  const togglePreserveMovData = useCallback(() => setPreserveMovData((val) => !val), [setPreserveMovData]);

  const toggleMovFastStart = useCallback(() => setMovFastStart((val) => !val), [setMovFastStart]);

  const toggleSimpleMode = useCallback(() => setSimpleMode((v) => {
    if (!hideAllNotifications) toast.fire({ text: v ? i18n.t('Advanced view has been enabled. You will now also see non-essential buttons and functions') : i18n.t('Advanced view disabled. You will now see only the most essential buttons and functions') });
    return !v;
  }), [hideAllNotifications, setSimpleMode]);

  const isCopyingStreamId = useCallback((path, streamId) => (
    !!(copyStreamIdsByFile[path] || {})[streamId]
  ), [copyStreamIdsByFile]);

  const copyAnyAudioTrack = useMemo(() => mainStreams.some(stream => isCopyingStreamId(filePath, stream.index) && stream.codec_type === 'audio'), [filePath, isCopyingStreamId, mainStreams]);

  const subtitleStreams = useMemo(() => mainStreams.filter((stream) => stream.codec_type === 'subtitle'), [mainStreams]);
  const activeSubtitle = useMemo(() => subtitlesByStreamId[activeSubtitleStreamIndex], [activeSubtitleStreamIndex, subtitlesByStreamId]);

  const onActiveSubtitleChange = useCallback(async (index) => {
    if (index == null) {
      setActiveSubtitleStreamIndex();
      return;
    }
    if (subtitlesByStreamId[index]) { // Already loaded
      setActiveSubtitleStreamIndex(index);
      return;
    }
    const subtitleStream = index != null && subtitleStreams.find((s) => s.index === index);
    if (!subtitleStream || workingRef.current) return;
    try {
      setWorking(i18n.t('Loading subtitle'));
      const url = await extractSubtitleTrack(filePath, index);
      setSubtitlesByStreamId((old) => ({ ...old, [index]: { url, lang: subtitleStream.tags && subtitleStream.tags.language } }));
      setActiveSubtitleStreamIndex(index);
    } catch (err) {
      handleError(`Failed to extract subtitles for stream ${index}`, err.message);
    } finally {
      setWorking();
    }
  }, [setWorking, subtitleStreams, subtitlesByStreamId, filePath]);

  // Streams that are not copy enabled by default
  const extraStreams = useMemo(() => mainStreams
    .filter((stream) => !defaultProcessedCodecTypes.includes(stream.codec_type)), [mainStreams]);

  // Extra streams that the user has not selected for copy
  const nonCopiedExtraStreams = useMemo(() => extraStreams
    .filter((stream) => !isCopyingStreamId(filePath, stream.index)), [extraStreams, filePath, isCopyingStreamId]);

  const exportExtraStreams = autoExportExtraStreams && nonCopiedExtraStreams.length > 0;

  const copyFileStreams = useMemo(() => Object.entries(copyStreamIdsByFile).map(([path, streamIdsMap]) => ({
    path,
    streamIds: Object.keys(streamIdsMap).filter(index => streamIdsMap[index]),
  })), [copyStreamIdsByFile]);

  const numStreamsToCopy = copyFileStreams
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
  }, [copyAnyAudioTrack, filePath, mainStreams, setCopyStreamIdsForPath]);

  const removeCutSegment = useCallback((index) => {
    if (cutSegments.length === 1 && cutSegments[0].start == null && cutSegments[0].end == null) return; // Initial segment

    if (cutSegments.length <= 1) {
      clearSegments();
      return;
    }

    const cutSegmentsNew = [...cutSegments];
    cutSegmentsNew.splice(index, 1);

    setCutSegments(cutSegmentsNew);
  }, [clearSegments, cutSegments, setCutSegments]);

  const thumnailsRef = useRef([]);
  const thumnailsRenderingPromiseRef = useRef();

  function addThumbnail(thumbnail) {
    // console.log('Rendered thumbnail', thumbnail.url);
    setThumbnails(v => [...v, thumbnail]);
  }

  const [, cancelRenderThumbnails] = useDebounceOld(() => {
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

    if (isDurationValid(zoomedDuration)) renderThumbnails();
  }, 500, [zoomedDuration, filePath, zoomWindowStartTime, thumbnailsEnabled]);

  // Cleanup removed thumbnails
  useEffect(() => {
    thumnailsRef.current.forEach((thumbnail) => {
      if (!thumbnails.some(t => t.url === thumbnail.url)) URL.revokeObjectURL(thumbnail.url);
    });
    thumnailsRef.current = thumbnails;
  }, [thumbnails]);

  // Cleanup removed subtitles
  const subtitlesByStreamIdRef = useRef({});
  useEffect(() => {
    Object.values(thumnailsRef.current).forEach(({ url }) => {
      if (!Object.values(subtitlesByStreamId).some(t => t.url === url)) URL.revokeObjectURL(url);
    });
    subtitlesByStreamIdRef.current = subtitlesByStreamId;
  }, [subtitlesByStreamId]);

  const hasAudio = !!mainAudioStream;
  const hasVideo = !!mainVideoStream;
  const shouldShowKeyframes = keyframesEnabled && !!mainVideoStream && calcShouldShowKeyframes(zoomedDuration);
  const shouldShowWaveform = calcShouldShowWaveform(zoomedDuration);

  const { neighbouringKeyFrames, findNearestKeyFrameTime } = useKeyframes({ keyframesEnabled, filePath, commandedTime, mainVideoStream, detectedFps, ffmpegExtractWindow });
  const { waveforms } = useWaveform({ filePath, commandedTime, zoomedDuration, waveformEnabled, mainAudioStream, shouldShowWaveform, ffmpegExtractWindow });

  const resetState = useCallback(() => {
    const video = videoRef.current;
    setCommandedTime(0);
    video.currentTime = 0;
    video.playbackRate = 1;

    batchedUpdates(() => {
      // setWorking();
      setFileNameTitle();
      setPreviewFilePath();
      setUsingDummyVideo(false);
      setPlaying(false);
      setDuration();
      cutSegmentsHistory.go(0);
      clearSegments(); // TODO this will cause two history items
      setCutStartTimeManual();
      setCutEndTimeManual();
      setFileFormat();
      setFileFormatData();
      setChapters();
      setDetectedFileFormat();
      setRotation(360);
      setCutProgress();
      setStartTimeOffset(0);
      setFilePath(''); // Setting video src="" prevents memory leak in chromium
      setExternalStreamFiles([]);
      setCustomTagsByFile({});
      setCustomTagsByStreamId({});
      setDispositionByStreamId({});
      setDetectedFps();
      setMainStreams([]);
      setMainVideoStream();
      setMainAudioStream();
      setCopyStreamIdsByFile({});
      setStreamsSelectorShown(false);
      setZoom(1);
      setThumbnails([]);
      setShortestFlag(false);
      setZoomWindowStartTime(0);
      setDisabledSegmentIds({});
      setSubtitlesByStreamId({});
      setActiveSubtitleStreamIndex();
      setHideCanvasPreview(false);
      setExportConfirmVisible(false);

      cancelRenderThumbnails();
    });
  }, [cutSegmentsHistory, clearSegments, cancelRenderThumbnails]);


  const showUnsupportedFileMessage = useCallback(() => {
    if (!hideAllNotifications) toast.fire({ timer: 13000, text: i18n.t('File not natively supported. Preview may have no audio or low quality. The final export will however be lossless with audio. You may convert it from the menu for a better preview with audio.') });
  }, [hideAllNotifications]);

  const showPreviewFileLoadedMessage = useCallback((fileName) => {
    if (!hideAllNotifications) toast.fire({ icon: 'info', text: i18n.t('Loaded existing preview file: {{ fileName }}', { fileName }) });
  }, [hideAllNotifications]);

  const html5ify = useCallback(async ({ customOutDir: cod, filePath: fp, speed, hasAudio: ha, hasVideo: hv }) => {
    const path = getHtml5ifiedPath(cod, fp, speed);

    let audio;
    if (ha) {
      if (speed === 'slowest') audio = 'hq';
      else if (['slow-audio', 'fast-audio', 'fastest-audio'].includes(speed)) audio = 'lq';
      else if (['fast-audio-remux', 'fastest-audio-remux'].includes(speed)) audio = 'copy';
    }

    let video;
    if (hv) {
      if (speed === 'slowest') video = 'hq';
      else if (['slow-audio', 'slow'].includes(speed)) video = 'lq';
      else video = 'copy';
    }

    try {
      await ffmpegHtml5ify({ filePath: fp, outPath: path, video, audio, onProgress: setCutProgress });
    } finally {
      setCutProgress();
    }
    return path;
  }, [ffmpegHtml5ify]);

  const html5ifyAndLoad = useCallback(async (cod, fp, speed, hv, ha) => {
    const usesDummyVideo = ['fastest-audio', 'fastest-audio-remux', 'fastest'].includes(speed);
    console.log('html5ifyAndLoad', { speed, hasVideo: hv, hasAudio: ha, usesDummyVideo });

    async function doHtml5ify() {
      if (speed == null) return undefined;
      if (speed === 'fastest') {
        const path = getOutPath({ customOutDir: cod, filePath: fp, nameSuffix: `${html5ifiedPrefix}${html5dummySuffix}.mkv` });
        try {
          setCutProgress(0);
          await html5ifyDummy({ filePath: fp, outPath: path, onProgress: setCutProgress });
        } finally {
          setCutProgress();
        }
        return path;
      }

      const shouldIncludeVideo = !usesDummyVideo && hv;
      const path = await html5ify({ customOutDir: cod, filePath: fp, speed, hasAudio: ha, hasVideo: shouldIncludeVideo });
      return path;
    }

    const path = await doHtml5ify();
    if (!path) return;

    setPreviewFilePath(path);
    setUsingDummyVideo(usesDummyVideo);
    showUnsupportedFileMessage();
  }, [html5ify, html5ifyDummy, showUnsupportedFileMessage]);

  const getConvertToSupportedFormat = useCallback((fallback) => rememberConvertToSupportedFormat || fallback, [rememberConvertToSupportedFormat]);

  const html5ifyAndLoadWithPreferences = useCallback(async (cod, fp, speed, hv, ha) => {
    if (!enableAutoHtml5ify) return;
    setWorking(i18n.t('Converting to supported format'));
    await html5ifyAndLoad(cod, fp, getConvertToSupportedFormat(speed), hv, ha);
  }, [enableAutoHtml5ify, setWorking, html5ifyAndLoad, getConvertToSupportedFormat]);

  const showPlaybackFailedMessage = () => errorToast(i18n.t('Unable to playback this file. Try to convert to supported format from the menu'));

  const togglePlay = useCallback((resetPlaybackRate) => {
    if (!filePath) return;

    const video = videoRef.current;
    if (playing) {
      video.pause();
      return;
    }

    if (resetPlaybackRate) video.playbackRate = 1;

    video.play().catch((err) => {
      showPlaybackFailedMessage();
      console.error(err);
    });
  }, [playing, filePath]);

  const closeFileWithConfirm = useCallback(() => {
    if (!isFileOpened || workingRef.current) return;

    // eslint-disable-next-line no-alert
    if (askBeforeClose && !window.confirm(i18n.t('Are you sure you want to close the current file?'))) return;

    resetState();
  }, [askBeforeClose, resetState, isFileOpened]);

  const closeBatch = useCallback(() => {
    // eslint-disable-next-line no-alert
    if (askBeforeClose && !window.confirm(i18n.t('Are you sure you want to close the loaded batch of files?'))) return;
    setBatchFiles([]);
  }, [askBeforeClose]);

  const removeBatchFile = useCallback((path) => setBatchFiles((existingBatch) => existingBatch.filter((existingFile) => existingFile.path !== path)), []);

  const cleanupFiles = useCallback(async () => {
    if (!isFileOpened) return;

    let trashResponse = cleanupChoices;
    if (!cleanupChoices.dontShowAgain) {
      trashResponse = await cleanupFilesDialog(cleanupChoices);
      console.log('trashResponse', trashResponse);
      if (!trashResponse) return; // Cancelled
      setCleanupChoices(trashResponse); // Store for next time
    }

    if (workingRef.current) return;

    // Because we will reset state before deleting files
    const savedPaths = { previewFilePath, filePath, edlFilePath };

    resetState();

    removeBatchFile(savedPaths.filePath);

    if (!trashResponse.tmpFiles && !trashResponse.projectFile && !trashResponse.sourceFile) return;

    try {
      setWorking(i18n.t('Cleaning up'));
      console.log('trashing', trashResponse);
      await deleteFiles({ toDelete: trashResponse, paths: savedPaths });
    } catch (err) {
      errorToast(i18n.t('Unable to delete file: {{message}}', { message: err.message }));
      console.error(err);
    } finally {
      setWorking();
    }
  }, [previewFilePath, filePath, edlFilePath, cleanupChoices, isFileOpened, resetState, removeBatchFile, setWorking]);

  const outSegments = useMemo(() => (invertCutSegments ? inverseCutSegments : apparentCutSegments),
    [invertCutSegments, inverseCutSegments, apparentCutSegments]);

  // For invertCutSegments we do not support filtering
  const enabledOutSegmentsRaw = useMemo(() => (invertCutSegments ? outSegments : outSegments.filter((s) => !disabledSegmentIds[s.segId])), [outSegments, invertCutSegments, disabledSegmentIds]);
  // If user has selected none to export, it makes no sense, so export all instead
  const enabledOutSegments = enabledOutSegmentsRaw.length > 0 ? enabledOutSegmentsRaw : outSegments;

  const onExportSingleSegmentClick = useCallback((activeSeg) => setDisabledSegmentIds(Object.fromEntries(cutSegments.filter((s) => s.segId !== activeSeg.segId).map((s) => [s.segId, true]))), [cutSegments]);
  const onExportSegmentEnabledToggle = useCallback((toggleSeg) => setDisabledSegmentIds((existing) => ({ ...existing, [toggleSeg.segId]: !existing[toggleSeg.segId] })), []);
  const onExportSegmentDisableAll = useCallback(() => setDisabledSegmentIds(Object.fromEntries(cutSegments.map((s) => [s.segId, true]))), [cutSegments]);
  const onExportSegmentEnableAll = useCallback(() => setDisabledSegmentIds({}), []);

  const filenamifyOrNot = useCallback((name) => (safeOutputFileName ? filenamify(name) : name).substr(0, maxLabelLength), [safeOutputFileName, maxLabelLength]);

  const generateOutSegFileNames = useCallback(({ segments = enabledOutSegments, template }) => (
    segments.map((segment, i) => {
      const { start, end, name = '' } = segment;
      const cutFromStr = formatDuration({ seconds: start, fileNameFriendly: true });
      const cutToStr = formatDuration({ seconds: end, fileNameFriendly: true });
      const segNum = i + 1;

      // https://github.com/mifi/lossless-cut/issues/583
      let segSuffix = '';
      if (name) segSuffix = `-${filenamifyOrNot(name)}`;
      else if (segments.length > 1) segSuffix = `-seg${segNum}`;

      const ext = getOutFileExtension({ isCustomFormatSelected, outFormat: fileFormat, filePath });

      const { name: fileNameWithoutExt } = parsePath(filePath);

      // Fields that did not come from the source file's name must be sanitized, because they may contain characters that are not supported by the target operating/file system
      const tagsSanitized = Object.fromEntries(Object.entries(getSegmentTags(segment)).map(([tag, value]) => [tag, filenamifyOrNot(value)]));
      const nameSanitized = filenamifyOrNot(name);

      const generated = generateSegFileName({ template, segSuffix, inputFileNameWithoutExt: fileNameWithoutExt, ext, segNum, segLabel: nameSanitized, cutFrom: cutFromStr, cutTo: cutToStr, tags: tagsSanitized });
      return safeOutputFileName ? generated.substr(0, 200) : generated; // If sanitation is enabled, make sure filename is not too long
    })
  ), [enabledOutSegments, filenamifyOrNot, isCustomFormatSelected, fileFormat, filePath, safeOutputFileName]);

  // TODO improve user feedback
  const isOutSegFileNamesValid = useCallback((fileNames) => fileNames.every((fileName) => {
    if (!filePath) return false;

    const invalidChars = [pathSep];

    // Colon is invalid on windows https://github.com/mifi/lossless-cut/issues/631 and on MacOS, but not Linux https://github.com/mifi/lossless-cut/issues/830
    if (isMac || isWindows) invalidChars.push(':');

    const outPath = pathNormalize(pathJoin(outputDir, fileName));
    const sameAsInputPath = outPath === pathNormalize(filePath);
    const windowsMaxPathLength = 259;
    const shouldCheckPathLength = isWindows || isDev;
    return (
      fileName.length > 0
      && !invalidChars.some((c) => fileName.includes(c))
      && !sameAsInputPath
      && (!shouldCheckPathLength || outPath.length < windowsMaxPathLength)
    );
  }), [outputDir, filePath]);

  const openSendReportDialogWithState = useCallback(async (err) => {
    const state = {
      filePath,
      fileFormat,
      externalStreamFiles,
      mainStreams,
      copyStreamIdsByFile,
      cutSegments: cutSegments.map(s => ({ start: s.start, end: s.end })),
      fileFormatData,
      rotation,
      shortestFlag,
    };

    openSendReportDialog(err, state);
  }, [copyStreamIdsByFile, cutSegments, externalStreamFiles, fileFormat, fileFormatData, filePath, mainStreams, rotation, shortestFlag]);

  const handleCutFailed = useCallback(async (err) => {
    const sendErrorReport = await showCutFailedDialog({ detectedFileFormat });
    if (sendErrorReport) openSendReportDialogWithState(err);
  }, [openSendReportDialogWithState, detectedFileFormat]);

  const closeExportConfirm = useCallback(() => setExportConfirmVisible(false), []);

  const onExportConfirm = useCallback(async () => {
    if (numStreamsToCopy === 0) {
      errorToast(i18n.t('No tracks selected for export'));
      return;
    }

    setStreamsSelectorShown(false);
    setExportConfirmVisible(false);

    if (workingRef.current) return;
    try {
      setWorking(i18n.t('Exporting'));

      console.log('outSegTemplateOrDefault', outSegTemplateOrDefault);

      let outSegFileNames = generateOutSegFileNames({ segments: enabledOutSegments, template: outSegTemplateOrDefault });
      if (!isOutSegFileNamesValid(outSegFileNames) || hasDuplicates(outSegFileNames)) {
        console.error('Output segments file name invalid, using default instead', outSegFileNames);
        outSegFileNames = generateOutSegFileNames({ segments: enabledOutSegments, template: defaultOutSegTemplate });
      }

      // throw (() => { const err = new Error('test'); err.code = 'ENOENT'; return err; })();
      const outFiles = await cutMultiple({
        outputDir,
        outFormat: fileFormat,
        videoDuration: duration,
        rotation: isRotationSet ? effectiveRotation : undefined,
        copyFileStreams,
        keyframeCut,
        segments: enabledOutSegments,
        segmentsFileNames: outSegFileNames,
        onProgress: setCutProgress,
        appendFfmpegCommandLog,
        shortestFlag,
        ffmpegExperimental,
        preserveMovData,
        movFastStart,
        avoidNegativeTs,
        customTagsByFile,
        customTagsByStreamId,
        dispositionByStreamId,
      });

      if (outFiles.length > 1 && autoMerge) {
        setCutProgress(0);
        setWorking(i18n.t('Merging'));

        const chapterNames = segmentsToChapters && !invertCutSegments ? enabledOutSegments.map((s) => s.name) : undefined;

        await autoMergeSegments({
          customOutDir,
          outFormat: fileFormat,
          isCustomFormatSelected,
          segmentPaths: outFiles,
          ffmpegExperimental,
          preserveMovData,
          movFastStart,
          onProgress: setCutProgress,
          chapterNames,
          autoDeleteMergedSegments,
          preserveMetadataOnMerge,
        });
      }

      const msgs = [i18n.t('Done! Note: cutpoints may be inaccurate. Make sure you test the output files in your desired player/editor before you delete the source. If output does not look right, see the HELP page.')];

      // https://github.com/mifi/lossless-cut/issues/329
      if (isIphoneHevc(fileFormatData, mainStreams)) msgs.push(i18n.t('There is a known issue with cutting iPhone HEVC videos. The output file may not work in all players.'));

      if (exportExtraStreams && enabledOutSegments.length > 1) {
        try {
          await extractStreams({ filePath, customOutDir, streams: nonCopiedExtraStreams });
          msgs.push(i18n.t('Unprocessable streams were exported as separate files.'));
        } catch (err) {
          console.error('Extra stream export failed', err);
        }
      }

      if (!hideAllNotifications) openDirToast({ dirPath: outputDir, text: msgs.join(' '), timer: 15000 });
    } catch (err) {
      console.error('stdout:', err.stdout);
      console.error('stderr:', err.stderr);

      if (err.exitCode === 1 || err.code === 'ENOENT') {
        if (isOutOfSpaceError(err)) {
          showDiskFull();
          return;
        }
        handleCutFailed(err);
        return;
      }

      handleError(err);
    } finally {
      setWorking();
      setCutProgress();
    }
  }, [numStreamsToCopy, enabledOutSegments, outSegTemplateOrDefault, generateOutSegFileNames, customOutDir, filePath, fileFormat, duration, isRotationSet, effectiveRotation, copyFileStreams, keyframeCut, shortestFlag, ffmpegExperimental, preserveMovData, movFastStart, avoidNegativeTs, customTagsByFile, customTagsByStreamId, dispositionByStreamId, autoMerge, exportExtraStreams, fileFormatData, mainStreams, hideAllNotifications, outputDir, segmentsToChapters, invertCutSegments, isCustomFormatSelected, autoDeleteMergedSegments, preserveMetadataOnMerge, nonCopiedExtraStreams, handleCutFailed, isOutSegFileNamesValid, cutMultiple, autoMergeSegments, setWorking]);

  const onExportPress = useCallback(async () => {
    if (!filePath || workingRef.current) return;

    if (haveInvalidSegs) {
      errorToast(i18n.t('Start time must be before end time'));
      return;
    }

    if (enabledOutSegments.length < 1) {
      errorToast(i18n.t('No segments to export'));
      return;
    }

    if (exportConfirmEnabled) setExportConfirmVisible(true);
    else await onExportConfirm();
  }, [filePath, haveInvalidSegs, enabledOutSegments, exportConfirmEnabled, onExportConfirm]);

  const capture = useCallback(async () => {
    if (!filePath) return;

    try {
      const currentTime = currentTimeRef.current;
      const video = videoRef.current;
      const outPath = previewFilePath
        ? await captureFrameFfmpeg({ customOutDir, filePath, currentTime, captureFormat, enableTransferTimestamps })
        : await captureFrameFromTag({ customOutDir, filePath, currentTime, captureFormat, video, enableTransferTimestamps });

      if (!hideAllNotifications) openDirToast({ dirPath: outputDir, text: `${i18n.t('Screenshot captured to:')} ${outPath}` });
    } catch (err) {
      console.error(err);
      errorToast(i18n.t('Failed to capture frame'));
    }
  }, [filePath, captureFormat, customOutDir, previewFilePath, outputDir, enableTransferTimestamps, hideAllNotifications]);

  const changePlaybackRate = useCallback((dir, rateMultiplier) => {
    if (canvasPlayerEnabled) {
      toast.fire({ title: i18n.t('Unable to change playback rate right now'), timer: 1000 });
      return;
    }

    const video = videoRef.current;
    if (!playing) {
      video.play();
    } else {
      const newRate = adjustRate(video.playbackRate, dir, rateMultiplier);
      toast.fire({ title: `${i18n.t('Playback rate:')} ${Math.round(newRate * 100)}%`, timer: 1000 });
      video.playbackRate = newRate;
    }
  }, [playing, canvasPlayerEnabled]);

  const firstSegmentAtCursorIndex = useMemo(() => {
    const segmentsAtCursorIndexes = findSegmentsAtCursor(apparentCutSegments, commandedTime);
    return segmentsAtCursorIndexes[0];
  }, [apparentCutSegments, commandedTime]);

  const segmentAtCursorRef = useRef();

  const segmentAtCursor = useMemo(() => {
    const segment = cutSegments[firstSegmentAtCursorIndex];
    segmentAtCursorRef.current = segment;
    return segment;
  }, [cutSegments, firstSegmentAtCursorIndex]);

  const splitCurrentSegment = useCallback(() => {
    const segmentAtCursor2 = segmentAtCursorRef.current;
    if (!segmentAtCursor2) {
      errorToast(i18n.t('No segment to split. Please move cursor over the segment you want to split'));
      return;
    }

    const getNewName = (oldName, suffix) => oldName && `${segmentAtCursor2.name} ${suffix}`;

    const firstPart = createSegmentAndIncrementCount({ name: getNewName(segmentAtCursor2.name, '1'), start: segmentAtCursor2.start, end: currentTimeRef.current });
    const secondPart = createSegmentAndIncrementCount({ name: getNewName(segmentAtCursor2.name, '2'), start: currentTimeRef.current, end: segmentAtCursor2.end });

    const newSegments = [...cutSegments];
    newSegments.splice(firstSegmentAtCursorIndex, 1, firstPart, secondPart);
    setCutSegments(newSegments);
  }, [createSegmentAndIncrementCount, cutSegments, firstSegmentAtCursorIndex, setCutSegments]);

  const loadCutSegments = useCallback((edl) => {
    const validEdl = edl.filter((row) => (
      (row.start === undefined || row.end === undefined || row.start < row.end)
      && (row.start === undefined || row.start >= 0)
      // TODO: Cannot do this because duration is not yet set when loading a file
      // && (row.start === undefined || (row.start >= 0 && row.start < duration))
      // && (row.end === undefined || row.end < duration)
    ));

    if (validEdl.length === 0) throw new Error(i18n.t('No valid segments found'));

    clearSegCounter();
    setCutSegments(validEdl.map(createSegmentAndIncrementCount));
  }, [clearSegCounter, createSegmentAndIncrementCount, setCutSegments]);

  const loadEdlFile = useCallback(async (path, type) => {
    console.log('Loading EDL file', type, path);
    loadCutSegments(await readEdlFile({ type, path }));
  }, [loadCutSegments]);

  const loadMedia = useCallback(async ({ filePath: fp, customOutDir: cod, projectPath }) => {
    console.log('loadMedia', fp, cod, projectPath);

    resetState();

    console.log('state reset');

    setWorking(i18n.t('Loading file'));

    async function checkAndSetExistingHtml5FriendlyFile() {
      const res = await findExistingHtml5FriendlyFile(fp, cod);
      if (!res) return false;
      console.log('Found existing supported file', res.path);
      setUsingDummyVideo(res.usingDummyVideo);
      setPreviewFilePath(res.path);
      showPreviewFileLoadedMessage(basename(res.path));
      return true;
    }

    try {
      const { fileFormat: ff, formatData: fd, chapters: ch, streams } = await readFileMeta(fp);
      // console.log('file meta read', ff);

      if (!ff) throw new Error('Unable to determine file format');

      const timecode = autoLoadTimecode ? getTimecodeFromStreams(streams) : undefined;

      const videoStreams = getVideoStreams(streams);
      const audioStreams = getAudioStreams(streams);

      const videoStream = videoStreams[0];
      const audioStream = audioStreams[0];

      const haveVideoStream = !!videoStream;
      const haveAudioStream = !!audioStream;

      const detectedFpsNew = haveVideoStream ? getStreamFps(videoStream) : undefined;

      const shouldCopyStreamByDefault = (stream) => {
        if (!defaultProcessedCodecTypes.includes(stream.codec_type)) return false;
        // Don't enable thumbnail stream by default if we have a main video stream
        // It's been known to cause issues: https://github.com/mifi/lossless-cut/issues/308
        if (haveVideoStream && isStreamThumbnail(stream)) return false;
        return true;
      };

      const copyStreamIdsForPathNew = fromPairs(streams.map((stream) => [
        stream.index, shouldCopyStreamByDefault(stream),
      ]));

      if (timecode) setStartTimeOffset(timecode);
      if (detectedFpsNew != null) setDetectedFps(detectedFpsNew);

      if (isAudioDefinitelyNotSupported(streams)) {
        toast.fire({ icon: 'info', text: i18n.t('The audio track is not supported. You can convert to a supported format from the menu') });
      }

      const validDuration = isDurationValid(parseFloat(fd.duration));
      const hasLoadedExistingHtml5FriendlyFile = await checkAndSetExistingHtml5FriendlyFile();

      // 'fastest' works with almost all video files
      if (!hasLoadedExistingHtml5FriendlyFile && !doesPlayerSupportFile(streams) && validDuration) {
        await html5ifyAndLoadWithPreferences(cod, fp, 'fastest', haveVideoStream, haveAudioStream);
      }

      try {
        const openedFileEdlPath = getEdlFilePath(fp);
        const openedFileEdlPathOld = getEdlFilePathOld(fp);

        if (projectPath) {
          await loadEdlFile(projectPath, 'llc');
        } else if (await exists(openedFileEdlPath)) {
          await loadEdlFile(openedFileEdlPath, 'llc');
        } else if (await exists(openedFileEdlPathOld)) {
          await loadEdlFile(openedFileEdlPathOld, 'csv');
        } else {
          const edl = await tryMapChaptersToEdl(ch);
          if (edl.length > 0 && enableAskForImportChapters && (await askForImportChapters())) {
            console.log('Convert chapters to segments', edl);
            loadCutSegments(edl);
          }
        }
      } catch (err) {
        console.error('EDL load failed, but continuing', err);
        errorToast(`${i18n.t('Failed to load segments')} (${err.message})`);
      }

      // throw new Error('test');

      if (!validDuration) toast.fire({ icon: 'warning', timer: 10000, text: i18n.t('This file does not have a valid duration. This may cause issues. You can try to fix the file\'s duration from the File menu') });

      batchedUpdates(() => {
        setMainStreams(streams);
        setMainVideoStream(videoStream);
        setMainAudioStream(audioStream);
        setCopyStreamIdsForPath(fp, () => copyStreamIdsForPathNew);
        setFileNameTitle(fp);
        setFileFormat(outFormatLocked || ff);
        setDetectedFileFormat(ff);
        setFileFormatData(fd);
        setChapters(ch);

        // This needs to be last, because it triggers <video> to load the video
        // If not, onVideoError might be triggered before setWorking() has been cleared.
        // https://github.com/mifi/lossless-cut/issues/515
        setFilePath(fp);
      });
    } catch (err) {
      resetState();
      throw err;
    }
  }, [resetState, html5ifyAndLoadWithPreferences, loadEdlFile, getEdlFilePath, getEdlFilePathOld, loadCutSegments, enableAskForImportChapters, autoLoadTimecode, outFormatLocked, showPreviewFileLoadedMessage, setWorking, setCopyStreamIdsForPath]);

  const toggleHelp = useCallback(() => setHelpVisible(val => !val), []);
  const toggleSettings = useCallback(() => setSettingsVisible(val => !val), []);

  const jumpSeg = useCallback((val) => setCurrentSegIndex((old) => Math.max(Math.min(old + val, cutSegments.length - 1), 0)), [cutSegments.length]);

  const seekClosestKeyframe = useCallback((direction) => {
    const time = findNearestKeyFrameTime({ time: currentTimeRef.current, direction });
    if (time == null) return;
    seekAbs(time);
  }, [findNearestKeyFrameTime, seekAbs]);

  const seekAccelerationRef = useRef(1);

  useEffect(() => {
    if (concatDialogVisible) return () => {};

    function onKeyPress() {
      if (exportConfirmVisible) onExportConfirm();
      else onExportPress();
    }

    const mousetrap = new Mousetrap();
    mousetrap.bind('e', onKeyPress);
    return () => mousetrap.reset();
  }, [exportConfirmVisible, onExportConfirm, onExportPress, concatDialogVisible]);

  useEffect(() => {
    function onEscPress() {
      closeExportConfirm();
      setHelpVisible(false);
      setSettingsVisible(false);
    }

    const mousetrap = new Mousetrap();
    mousetrap.bind('h', toggleHelp);
    mousetrap.bind('escape', onEscPress);
    return () => mousetrap.reset();
  }, [closeExportConfirm, toggleHelp]);

  useEffect(() => {
    document.ondragover = dragPreventer;
    document.ondragend = dragPreventer;

    electron.ipcRenderer.send('renderer-ready');
  }, []);

  useEffect(() => {
    electron.ipcRenderer.send('setAskBeforeClose', askBeforeClose && isFileOpened);
  }, [askBeforeClose, isFileOpened]);

  const extractSingleStream = useCallback(async (index) => {
    if (!filePath) return;

    if (workingRef.current) return;
    try {
      setWorking(i18n.t('Extracting track'));
      // setStreamsSelectorShown(false);
      await extractStreams({ customOutDir, filePath, streams: mainStreams.filter((s) => s.index === index) });
      openDirToast({ dirPath: outputDir, text: i18n.t('Track has been extracted') });
    } catch (err) {
      errorToast(i18n.t('Failed to extract track'));
      console.error('Failed to extract track', err);
    } finally {
      setWorking();
    }
  }, [customOutDir, filePath, mainStreams, outputDir, setWorking]);

  const extractAllStreams = useCallback(async () => {
    if (!filePath) return;

    if (!(await confirmExtractAllStreamsDialog())) return;

    if (workingRef.current) return;
    try {
      setWorking(i18n.t('Extracting all streams'));
      setStreamsSelectorShown(false);
      await extractStreams({ customOutDir, filePath, streams: mainStreams });
      openDirToast({ dirPath: outputDir, text: i18n.t('All streams have been extracted as separate files') });
    } catch (err) {
      errorToast(i18n.t('Failed to extract all streams'));
      console.error('Failed to extract all streams', err);
    } finally {
      setWorking();
    }
  }, [customOutDir, filePath, mainStreams, outputDir, setWorking]);

  const addStreamSourceFile = useCallback(async (path) => {
    if (externalStreamFiles[path]) return;
    const { streams } = await getAllStreams(path);
    const formatData = await getFormatData(path);
    // console.log('streams', streams);
    setExternalStreamFiles(old => ({ ...old, [path]: { streams, formatData } }));
    setCopyStreamIdsForPath(path, () => fromPairs(streams.map(({ index }) => [index, true])));
  }, [externalStreamFiles, setCopyStreamIdsForPath]);

  const userOpenSingleFile = useCallback(async ({ path: pathIn, isLlcProject }) => {
    let path = pathIn;
    let projectPath;

    // Open .llc AND media referenced within
    if (isLlcProject) {
      console.log('Loading LLC project', path);
      const project = await loadLlcProject(path);
      const { mediaFileName } = project;
      console.log({ mediaFileName });
      if (!mediaFileName) return;
      projectPath = path;
      path = pathJoin(dirname(path), mediaFileName);
    }
    // Because Apple is being nazi about the ability to open "copy protected DVD files"
    const disallowVob = isMasBuild;
    if (disallowVob && /\.vob$/i.test(path)) {
      toast.fire({ icon: 'error', text: 'Unfortunately .vob files are not supported in the App Store version of LosslessCut due to Apple restrictions' });
      return;
    }

    if (!(await pathExists(path))) {
      errorToast(i18n.t('The media you tried to open does not exist'));
      return;
    }

    if (!(await havePermissionToReadFile(path))) {
      errorToast(i18n.t('You do not have permission to access this file'));
      return;
    }

    const { newCustomOutDir, cancel } = await ensureOutDirAccessible(path);
    if (cancel) return;

    await loadMedia({ filePath: path, customOutDir: newCustomOutDir, projectPath });
  }, [ensureOutDirAccessible, loadMedia]);

  const checkFileOpened = useCallback(() => {
    if (isFileOpened) return true;
    toast.fire({ icon: 'info', title: i18n.t('You need to open a media file first') });
    return false;
  }, [isFileOpened]);

  const batchOpenSingleFile = useCallback(async (path) => {
    if (workingRef.current) return;
    if (filePath === path) return;
    try {
      setWorking(i18n.t('Loading file'));
      await userOpenSingleFile({ path });
    } catch (err) {
      handleError(err);
    } finally {
      setWorking();
    }
  }, [userOpenSingleFile, setWorking, filePath]);

  const batchFilePaths = useMemo(() => batchFiles.map((f) => f.path), [batchFiles]);

  const batchFileJump = useCallback((direction) => {
    const pathIndex = batchFiles.findIndex(({ path }) => path === filePath);
    if (pathIndex === -1) return;
    const nextFile = batchFiles[pathIndex + direction];
    if (!nextFile) return;
    batchOpenSingleFile(nextFile.path);
  }, [filePath, batchFiles, batchOpenSingleFile]);

  const batchLoadPaths = useCallback((newPaths, append) => {
    setBatchFiles((existingFiles) => {
      const mapPathsToFiles = (paths) => paths.map((path) => ({ path, name: basename(path) }));
      if (append) {
        const newUniquePaths = newPaths.filter((newPath) => !existingFiles.some(({ path: existingPath }) => newPath === existingPath));
        return [...existingFiles, ...mapPathsToFiles(newUniquePaths)];
      }
      return mapPathsToFiles(newPaths);
    });
  }, []);

  const userOpenFiles = useCallback(async (filePaths) => {
    if (!filePaths || filePaths.length < 1) return;

    console.log('userOpenFiles');
    console.log(filePaths.join('\n'));

    if (filePaths.length > 1) {
      if (alwaysConcatMultipleFiles) {
        batchLoadPaths(filePaths);
        setConcatDialogVisible(true);
      } else {
        batchLoadPaths(filePaths, true);
      }
      return;
    }


    // filePaths.length is now 1
    const firstFilePath = filePaths[0];

    const filePathLowerCase = firstFilePath.toLowerCase();

    if (workingRef.current) return;
    try {
      setWorking(i18n.t('Loading file'));

      // Import CSV project for existing video
      const edlFormats = { csv: 'csv', pbf: 'pbf', edl: 'mplayer', cue: 'cue', xml: 'xmeml' };
      const matchingExt = Object.keys(edlFormats).find((ext) => filePathLowerCase.endsWith(`.${ext}`));
      if (matchingExt) {
        if (!checkFileOpened()) return;
        await loadEdlFile(firstFilePath, edlFormats[matchingExt]);
        return;
      }

      const isLlcProject = filePathLowerCase.endsWith('.llc');

      // If file is already opened, need to ask the user what to do
      if (isFileOpened) {
        const inputOptions = { open: i18n.t('Open the file instead of the current one') };
        if (isLlcProject) inputOptions.project = i18n.t('Load segments from the new file, but keep the current media');
        else inputOptions.tracks = i18n.t('Include all tracks from the new file');

        const openFileResponse = enableAskForFileOpenAction ? await askForFileOpenAction(inputOptions) : 'open';

        if (openFileResponse === 'open') {
          await userOpenSingleFile({ path: firstFilePath, isLlcProject });
          return;
        }
        if (openFileResponse === 'project') {
          await loadEdlFile(firstFilePath, 'llc');
          return;
        }
        if (openFileResponse === 'tracks') {
          await addStreamSourceFile(firstFilePath);
          setStreamsSelectorShown(true);
          return;
        }
        // Dialog canceled:
        return;
      }

      await userOpenSingleFile({ path: firstFilePath, isLlcProject });
    } catch (err) {
      console.error('userOpenFiles', err);
      if (err.code === 'LLC_FFPROBE_UNSUPPORTED_FILE') {
        errorToast(i18n.t('Unsupported file'));
      } else {
        handleError(i18n.t('Failed to open file'), err);
      }
    } finally {
      setWorking();
    }
  }, [batchLoadPaths, alwaysConcatMultipleFiles, setWorking, isFileOpened, userOpenSingleFile, checkFileOpened, loadEdlFile, enableAskForFileOpenAction, addStreamSourceFile]);

  const userHtml5ifyCurrentFile = useCallback(async () => {
    if (!filePath) return;

    async function getHtml5ifySpeed() {
      const allHtml5ifyOptions = ['fastest', 'fastest-audio', 'fastest-audio-remux', 'fast-audio-remux', 'fast-audio', 'fast', 'slow', 'slow-audio', 'slowest'];
      let relevantOptions = [];
      if (hasAudio && hasVideo) relevantOptions = [...allHtml5ifyOptions];
      else if (hasAudio) relevantOptions = [...relevantOptions, 'fast-audio-remux', 'slow-audio', 'slowest'];
      else if (hasVideo) relevantOptions = [...relevantOptions, 'fastest', 'fast', 'slow', 'slowest'];
      const { selectedOption, remember } = await askForHtml5ifySpeed({ allowedOptions: allHtml5ifyOptions.filter((option) => relevantOptions.includes(option)), showRemember: true, initialOption: rememberConvertToSupportedFormat });
      if (!selectedOption) return undefined;

      console.log('Choice', { speed: selectedOption, remember });

      setRememberConvertToSupportedFormat(remember ? selectedOption : undefined);

      return selectedOption;
    }

    const speed = await getHtml5ifySpeed();
    if (!speed) return;

    if (workingRef.current) return;
    try {
      setWorking(i18n.t('Converting to supported format'));
      await html5ifyAndLoad(customOutDir, filePath, speed, hasVideo, hasAudio);
    } catch (err) {
      errorToast(i18n.t('Failed to convert file. Try a different conversion'));
      console.error('Failed to html5ify file', err);
    } finally {
      setWorking();
    }
  }, [customOutDir, filePath, html5ifyAndLoad, hasVideo, hasAudio, rememberConvertToSupportedFormat, setWorking]);

  const goToTimecode = useCallback(async () => {
    if (!filePath) return;
    const timeCode = await promptTimeOffset({
      initialValue: formatDuration({ seconds: commandedTimeRef.current }),
      title: i18n.t('Seek to timecode'),
    });

    if (timeCode === undefined) return;

    seekAbs(timeCode);
  }, [filePath, seekAbs]);


  // TODO split up?
  useEffect(() => {
    if (exportConfirmVisible || concatDialogVisible) return () => {};

    const togglePlayNoReset = () => togglePlay();
    const togglePlayReset = () => togglePlay(true);
    const reducePlaybackRate = () => changePlaybackRate(-1);
    const reducePlaybackRateMore = () => changePlaybackRate(-1, 2.0);
    const increasePlaybackRate = () => changePlaybackRate(1);
    const increasePlaybackRateMore = () => changePlaybackRate(1, 2.0);
    function seekBackwards() {
      seekRel(keyboardNormalSeekSpeed * seekAccelerationRef.current * -1);
      seekAccelerationRef.current *= keyboardSeekAccFactor;
    }
    function seekForwards() {
      seekRel(keyboardNormalSeekSpeed * seekAccelerationRef.current);
      seekAccelerationRef.current *= keyboardSeekAccFactor;
    }
    const seekReset = () => {
      seekAccelerationRef.current = 1;
    };
    const seekBackwardsPercent = () => { seekRelPercent(-0.01); return false; };
    const seekForwardsPercent = () => { seekRelPercent(0.01); return false; };
    const seekBackwardsKeyframe = () => seekClosestKeyframe(-1);
    const seekForwardsKeyframe = () => seekClosestKeyframe(1);
    const seekBackwardsShort = () => shortStep(-1);
    const seekForwardsShort = () => shortStep(1);
    const jumpPrevSegment = () => jumpSeg(-1);
    const jumpNextSegment = () => jumpSeg(1);
    const zoomIn = () => { zoomRel(1); return false; };
    const zoomOut = () => { zoomRel(-1); return false; };
    const batchPreviousFile = () => batchFileJump(-1);
    const batchNextFile = () => batchFileJump(1);

    // mousetrap seems to be the only lib properly handling layouts that require shift to be pressed to get a particular key #520
    // Also document.addEventListener needs custom handling of modifier keys or C will be triggered by CTRL+C, etc
    const mousetrap = new Mousetrap();
    // mousetrap.bind(':', () => console.log('test'));
    mousetrap.bind('plus', () => addCutSegment());
    mousetrap.bind('space', () => togglePlayReset());
    mousetrap.bind('k', () => togglePlayNoReset());
    mousetrap.bind('j', () => reducePlaybackRate());
    mousetrap.bind('shift+j', () => reducePlaybackRateMore());
    mousetrap.bind('l', () => increasePlaybackRate());
    mousetrap.bind('shift+l', () => increasePlaybackRateMore());
    mousetrap.bind('z', () => toggleComfortZoom());
    mousetrap.bind(',', () => seekBackwardsShort());
    mousetrap.bind('.', () => seekForwardsShort());
    mousetrap.bind('c', () => capture());
    mousetrap.bind('i', () => setCutStart());
    mousetrap.bind('o', () => setCutEnd());
    mousetrap.bind('backspace', () => removeCutSegment(currentSegIndexSafe));
    mousetrap.bind('d', () => cleanupFiles());
    mousetrap.bind('b', () => splitCurrentSegment());
    mousetrap.bind('r', () => increaseRotation());
    mousetrap.bind('g', () => goToTimecode());

    mousetrap.bind('left', () => seekBackwards());
    mousetrap.bind('left', () => seekReset(), 'keyup');
    mousetrap.bind(['ctrl+left', 'command+left'], () => seekBackwardsPercent());
    mousetrap.bind('alt+left', () => seekBackwardsKeyframe());
    mousetrap.bind('shift+left', () => jumpCutStart());

    mousetrap.bind('right', () => seekForwards());
    mousetrap.bind('right', () => seekReset(), 'keyup');
    mousetrap.bind(['ctrl+right', 'command+right'], () => seekForwardsPercent());
    mousetrap.bind('alt+right', () => seekForwardsKeyframe());
    mousetrap.bind('shift+right', () => jumpCutEnd());

    mousetrap.bind('up', () => jumpPrevSegment());
    mousetrap.bind(['ctrl+up', 'command+up'], () => zoomIn());
    mousetrap.bind(['shift+up'], () => batchPreviousFile());

    mousetrap.bind('down', () => jumpNextSegment());
    mousetrap.bind(['ctrl+down', 'command+down'], () => zoomOut());
    mousetrap.bind(['shift+down'], () => batchNextFile());

    // https://github.com/mifi/lossless-cut/issues/610
    Mousetrap.bind(['ctrl+z', 'command+z'], (e) => {
      e.preventDefault();
      cutSegmentsHistory.back();
    });
    Mousetrap.bind(['ctrl+shift+z', 'command+shift+z'], (e) => {
      e.preventDefault();
      cutSegmentsHistory.forward();
    });

    mousetrap.bind(['enter'], () => {
      onLabelSegmentPress(currentSegIndexSafe);
      return false;
    });

    return () => mousetrap.reset();
  }, [
    addCutSegment, capture, changePlaybackRate, togglePlay, removeCutSegment,
    setCutEnd, setCutStart, seekRel, seekRelPercent, shortStep, cleanupFiles, jumpSeg,
    seekClosestKeyframe, zoomRel, toggleComfortZoom, splitCurrentSegment, exportConfirmVisible, concatDialogVisible,
    increaseRotation, jumpCutStart, jumpCutEnd, cutSegmentsHistory, keyboardSeekAccFactor,
    keyboardNormalSeekSpeed, onLabelSegmentPress, currentSegIndexSafe, batchFileJump, goToTimecode,
  ]);

  const onVideoError = useCallback(async () => {
    const { error } = videoRef.current;
    if (!error) return;
    if (!fileUri) return; // Probably MEDIA_ELEMENT_ERROR: Empty src attribute

    console.error('onVideoError', error.message, error.code);

    try {
      const PIPELINE_ERROR_DECODE = 3; // This usually happens when the user presses play or seeks, but the video is not actually playable. To reproduce: "RX100VII PCM audio timecode.MP4" or see https://github.com/mifi/lossless-cut/issues/804
      const MEDIA_ERR_SRC_NOT_SUPPORTED = 4; // Test: issue-668-3.20.1.m2ts - NOTE: DEMUXER_ERROR_COULD_NOT_OPEN is also 4
      if (!([MEDIA_ERR_SRC_NOT_SUPPORTED, PIPELINE_ERROR_DECODE].includes(error.code) && !usingPreviewFile && filePath)) return;

      if (workingRef.current) return;
      try {
        setWorking(i18n.t('Converting to supported format'));

        console.log('Trying to create preview');

        if (!isDurationValid(await getDuration(filePath))) throw new Error('Invalid duration');

        if (hasVideo) {
          // "fastest" is the most likely type not to fail for video (but it is muted).
          await html5ifyAndLoadWithPreferences(customOutDir, filePath, 'fastest', hasVideo, hasAudio);
        } else if (hasAudio) {
          // For audio do a fast re-encode
          await html5ifyAndLoadWithPreferences(customOutDir, filePath, 'fastest-audio', hasVideo, hasAudio);
        }
      } catch (err) {
        console.error(err);
        showPlaybackFailedMessage();
      } finally {
        setWorking();
      }
    } catch (err) {
      handleError(err);
    }
  }, [fileUri, usingPreviewFile, hasVideo, hasAudio, html5ifyAndLoadWithPreferences, customOutDir, filePath, setWorking]);

  useEffect(() => {
    async function showOpenAndMergeDialog() {
      const files = await showMergeFilesOpenDialog(outputDir);
      if (files) {
        batchLoadPaths(files);
        setConcatDialogVisible(true);
      }
    }

    async function setStartOffset() {
      const newStartTimeOffset = await promptTimeOffset({
        initialValue: startTimeOffset !== undefined ? formatDuration({ seconds: startTimeOffset }) : undefined,
        title: i18n.t('Set custom start time offset'),
        text: i18n.t('Instead of video apparently starting at 0, you can offset by a specified value. This only applies to the preview inside LosslessCut and does not modify the file in any way. (Useful for viewing/cutting videos according to timecodes)'),
      });

      if (newStartTimeOffset === undefined) return;

      setStartTimeOffset(newStartTimeOffset);
    }

    async function exportEdlFile2(e, type) {
      if (!checkFileOpened()) return;
      try {
        await exportEdlFile({ type, cutSegments, filePath, getFrameCount });
      } catch (err) {
        errorToast(i18n.t('Failed to export project'));
        console.error('Failed to export project', type, err);
      }
    }

    async function exportEdlYouTube() {
      if (!checkFileOpened()) return;

      await openYouTubeChaptersDialog(formatYouTube(apparentCutSegments));
    }

    async function importEdlFile(e, type) {
      if (!checkFileOpened()) return;

      try {
        const edl = await readEdl(type);
        if (edl.length > 0) loadCutSegments(edl);
      } catch (err) {
        handleError(err);
      }
    }

    async function batchConvertFriendlyFormat() {
      const title = i18n.t('Select files to batch convert to supported format');
      const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'], title, message: title });
      if (canceled || filePaths.length < 1) return;

      const failedFiles = [];
      let i = 0;

      const { selectedOption: speed } = await askForHtml5ifySpeed({ allowedOptions: ['fastest-audio', 'fastest-audio-remux', 'fast-audio-remux', 'fast-audio', 'fast', 'slow', 'slow-audio', 'slowest'] });
      if (!speed) return;

      if (workingRef.current) return;
      try {
        setWorking(i18n.t('Batch converting to supported format'));
        setCutProgress(0);

        // eslint-disable-next-line no-restricted-syntax
        for (const path of filePaths) {
          try {
            // eslint-disable-next-line no-await-in-loop
            const { newCustomOutDir, cancel } = await ensureOutDirAccessible(path);
            if (cancel) {
              toast.fire({ title: i18n.t('Aborted') });
              return;
            }

            // eslint-disable-next-line no-await-in-loop
            await html5ify({ customOutDir: newCustomOutDir, filePath: path, speed, hasAudio: true, hasVideo: true });
          } catch (err2) {
            console.error('Failed to html5ify', path, err2);
            failedFiles.push(path);
          }

          i += 1;
          setCutProgress(i / filePaths.length);
        }

        if (failedFiles.length > 0) toast.fire({ title: `${i18n.t('Failed to convert files:')} ${failedFiles.join(' ')}`, timer: null, showConfirmButton: true });
      } catch (err) {
        errorToast(i18n.t('Failed to batch convert to supported format'));
        console.error('Failed to html5ify', err);
      } finally {
        setWorking();
        setCutProgress();
      }
    }

    async function createNumSegments2() {
      if (!checkFileOpened() || !isDurationValid(duration)) return;
      const segments = await createNumSegments(duration);
      if (segments) loadCutSegments(segments);
    }

    async function createFixedDurationSegments2() {
      if (!checkFileOpened() || !isDurationValid(duration)) return;
      const segments = await createFixedDurationSegments(duration);
      if (segments) loadCutSegments(segments);
    }

    async function fixInvalidDuration2() {
      if (!checkFileOpened() || workingRef.current) return;
      try {
        setWorking(i18n.t('Fixing file duration'));
        const path = await fixInvalidDuration({ fileFormat, customOutDir });
        toast.fire({ icon: 'info', text: i18n.t('Duration has been fixed') });
        await loadMedia({ filePath: path, customOutDir });
      } catch (err) {
        errorToast(i18n.t('Failed to fix file duration'));
        console.error('Failed to fix file duration', err);
      } finally {
        setWorking();
      }
    }

    const fileOpened = (event, filePaths) => { userOpenFiles(filePaths.map(resolvePathIfNeeded)); };
    const showStreamsSelector = () => setStreamsSelectorShown(true);
    const openSendReportDialog2 = () => { openSendReportDialogWithState(); };
    const closeFile2 = () => { closeFileWithConfirm(); };
    const closeBatch2 = () => { closeBatch(); };

    electron.ipcRenderer.on('file-opened', fileOpened);
    electron.ipcRenderer.on('close-file', closeFile2);
    electron.ipcRenderer.on('close-batch-files', closeBatch2);
    electron.ipcRenderer.on('html5ify', userHtml5ifyCurrentFile);
    electron.ipcRenderer.on('show-merge-dialog', showOpenAndMergeDialog);
    electron.ipcRenderer.on('set-start-offset', setStartOffset);
    electron.ipcRenderer.on('extract-all-streams', extractAllStreams);
    electron.ipcRenderer.on('showStreamsSelector', showStreamsSelector);
    electron.ipcRenderer.on('importEdlFile', importEdlFile);
    electron.ipcRenderer.on('exportEdlFile', exportEdlFile2);
    electron.ipcRenderer.on('exportEdlYouTube', exportEdlYouTube);
    electron.ipcRenderer.on('openHelp', toggleHelp);
    electron.ipcRenderer.on('openSettings', toggleSettings);
    electron.ipcRenderer.on('openAbout', openAbout);
    electron.ipcRenderer.on('batchConvertFriendlyFormat', batchConvertFriendlyFormat);
    electron.ipcRenderer.on('openSendReportDialog', openSendReportDialog2);
    electron.ipcRenderer.on('clearSegments', clearSegments);
    electron.ipcRenderer.on('createNumSegments', createNumSegments2);
    electron.ipcRenderer.on('createFixedDurationSegments', createFixedDurationSegments2);
    electron.ipcRenderer.on('invertAllCutSegments', invertAllCutSegments);
    electron.ipcRenderer.on('fixInvalidDuration', fixInvalidDuration2);
    electron.ipcRenderer.on('reorderSegsByStartTime', reorderSegsByStartTime);

    return () => {
      electron.ipcRenderer.removeListener('file-opened', fileOpened);
      electron.ipcRenderer.removeListener('close-file', closeFile2);
      electron.ipcRenderer.removeListener('close-batch-files', closeBatch2);
      electron.ipcRenderer.removeListener('html5ify', userHtml5ifyCurrentFile);
      electron.ipcRenderer.removeListener('show-merge-dialog', showOpenAndMergeDialog);
      electron.ipcRenderer.removeListener('set-start-offset', setStartOffset);
      electron.ipcRenderer.removeListener('extract-all-streams', extractAllStreams);
      electron.ipcRenderer.removeListener('showStreamsSelector', showStreamsSelector);
      electron.ipcRenderer.removeListener('importEdlFile', importEdlFile);
      electron.ipcRenderer.removeListener('exportEdlFile', exportEdlFile2);
      electron.ipcRenderer.removeListener('exportEdlYouTube', exportEdlYouTube);
      electron.ipcRenderer.removeListener('openHelp', toggleHelp);
      electron.ipcRenderer.removeListener('openSettings', toggleSettings);
      electron.ipcRenderer.removeListener('openAbout', openAbout);
      electron.ipcRenderer.removeListener('batchConvertFriendlyFormat', batchConvertFriendlyFormat);
      electron.ipcRenderer.removeListener('openSendReportDialog', openSendReportDialog2);
      electron.ipcRenderer.removeListener('clearSegments', clearSegments);
      electron.ipcRenderer.removeListener('createNumSegments', createNumSegments2);
      electron.ipcRenderer.removeListener('createFixedDurationSegments', createFixedDurationSegments2);
      electron.ipcRenderer.removeListener('invertAllCutSegments', invertAllCutSegments);
      electron.ipcRenderer.removeListener('fixInvalidDuration', fixInvalidDuration2);
      electron.ipcRenderer.removeListener('reorderSegsByStartTime', reorderSegsByStartTime);
    };
  }, [
    outputDir, filePath, customOutDir, startTimeOffset, userHtml5ifyCurrentFile, batchLoadPaths,
    extractAllStreams, userOpenFiles, openSendReportDialogWithState, setWorking,
    loadEdlFile, cutSegments, apparentCutSegments, edlFilePath, toggleHelp, toggleSettings, ensureOutDirAccessible, html5ifyAndLoad, html5ify,
    loadCutSegments, duration, checkFileOpened, loadMedia, fileFormat, reorderSegsByStartTime, closeFileWithConfirm, closeBatch, clearSegments, clearSegCounter, fixInvalidDuration, invertAllCutSegments, getFrameCount,
  ]);

  const showAddStreamSourceDialog = useCallback(async () => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'] });
      if (canceled || filePaths.length < 1) return;
      await addStreamSourceFile(filePaths[0]);
    } catch (err) {
      handleError(err);
    }
  }, [addStreamSourceFile]);

  useEffect(() => {
    async function onDrop(ev) {
      ev.preventDefault();
      const { files } = ev.dataTransfer;
      const filePaths = Array.from(files).map(f => f.path);

      focusWindow();

      await userOpenFiles(filePaths);
    }
    document.body.addEventListener('drop', onDrop);
    return () => document.body.removeEventListener('drop', onDrop);
  }, [userOpenFiles]);


  const commonFormatsMap = useMemo(() => fromPairs(commonFormats.map(format => [format, allOutFormats[format]])
    .filter(([f]) => f !== detectedFileFormat)), [detectedFileFormat]);

  const otherFormatsMap = useMemo(() => fromPairs(Object.entries(allOutFormats)
    .filter(([f]) => ![...commonFormats, detectedFileFormat].includes(f))), [detectedFileFormat]);

  function renderFormatOptions(map) {
    return Object.entries(map).map(([f, name]) => (
      <option key={f} value={f}>{f} - {name}</option>
    ));
  }

  const renderOutFmt = useCallback((style) => (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <Select style={style} value={fileFormat || ''} title={i18n.t('Output format')} onChange={withBlur(e => onOutputFormatUserChange(e.target.value))}>
      <option key="disabled1" value="" disabled>{i18n.t('Format')}</option>

      {detectedFileFormat && (
        <option key={detectedFileFormat} value={detectedFileFormat}>
          {detectedFileFormat} - {allOutFormats[detectedFileFormat]} {i18n.t('(detected)')}
        </option>
      )}

      <option key="disabled2" value="" disabled>--- {i18n.t('Common formats:')} ---</option>
      {renderFormatOptions(commonFormatsMap)}

      <option key="disabled3" value="" disabled>--- {i18n.t('All formats:')} ---</option>
      {renderFormatOptions(otherFormatsMap)}
    </Select>
  ), [commonFormatsMap, detectedFileFormat, fileFormat, otherFormatsMap, onOutputFormatUserChange]);

  const renderCaptureFormatButton = useCallback((props) => (
    <Button
      title={i18n.t('Capture frame format')}
      onClick={withBlur(toggleCaptureFormat)}
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...props}
    >
      {captureFormat}
    </Button>
  ), [captureFormat, toggleCaptureFormat]);

  const AutoExportToggler = useCallback(() => (
    <Button intent={autoExportExtraStreams === 'extract' ? 'success' : 'danger'} iconBefore={autoExportExtraStreams === 'extract' ? ForkIcon : DisableIcon} onClick={() => setAutoExportExtraStreams(autoExportExtraStreams === 'extract' ? 'discard' : 'extract')}>
      {autoExportExtraStreams === 'extract' ? i18n.t('Extract') : i18n.t('Discard')}
    </Button>
  ), [autoExportExtraStreams, setAutoExportExtraStreams]);

  const onTunerRequested = useCallback((type) => {
    setSettingsVisible(false);
    setTunerVisible(type);
  }, []);

  const renderSettings = useCallback(() => (
    <Settings
      changeOutDir={changeOutDir}
      customOutDir={customOutDir}
      keyframeCut={keyframeCut}
      setKeyframeCut={setKeyframeCut}
      invertCutSegments={invertCutSegments}
      setInvertCutSegments={setInvertCutSegments}
      autoSaveProjectFile={autoSaveProjectFile}
      setAutoSaveProjectFile={setAutoSaveProjectFile}
      timecodeFormat={timecodeFormat}
      setTimecodeFormat={setTimecodeFormat}
      askBeforeClose={askBeforeClose}
      setAskBeforeClose={setAskBeforeClose}
      enableAskForImportChapters={enableAskForImportChapters}
      setEnableAskForImportChapters={setEnableAskForImportChapters}
      enableAskForFileOpenAction={enableAskForFileOpenAction}
      setEnableAskForFileOpenAction={setEnableAskForFileOpenAction}
      ffmpegExperimental={ffmpegExperimental}
      setFfmpegExperimental={setFfmpegExperimental}
      invertTimelineScroll={invertTimelineScroll}
      setInvertTimelineScroll={setInvertTimelineScroll}
      language={language}
      setLanguage={setLanguage}
      hideNotifications={hideNotifications}
      setHideNotifications={setHideNotifications}
      autoLoadTimecode={autoLoadTimecode}
      setAutoLoadTimecode={setAutoLoadTimecode}
      enableTransferTimestamps={enableTransferTimestamps}
      setEnableTransferTimestamps={setEnableTransferTimestamps}
      enableAutoHtml5ify={enableAutoHtml5ify}
      setEnableAutoHtml5ify={setEnableAutoHtml5ify}
      AutoExportToggler={AutoExportToggler}
      renderCaptureFormatButton={renderCaptureFormatButton}
      onTunerRequested={onTunerRequested}
    />
  ), [changeOutDir, customOutDir, keyframeCut, setKeyframeCut, invertCutSegments, setInvertCutSegments, autoSaveProjectFile, setAutoSaveProjectFile, timecodeFormat, setTimecodeFormat, askBeforeClose, setAskBeforeClose, enableAskForImportChapters, setEnableAskForImportChapters, enableAskForFileOpenAction, setEnableAskForFileOpenAction, ffmpegExperimental, setFfmpegExperimental, invertTimelineScroll, setInvertTimelineScroll, language, setLanguage, hideNotifications, setHideNotifications, autoLoadTimecode, setAutoLoadTimecode, AutoExportToggler, renderCaptureFormatButton, onTunerRequested, enableTransferTimestamps, setEnableTransferTimestamps, enableAutoHtml5ify, setEnableAutoHtml5ify]);

  useEffect(() => {
    if (!isStoreBuild) loadMifiLink().then(setMifiLink);
  }, []);

  useEffect(() => {
    runStartupCheck().catch((err) => handleError('LosslessCut is installation is broken', err));
  }, []);

  useEffect(() => {
    // Testing:
    // if (isDev) loadMedia({ filePath: '/Users/mifi/Downloads/inp.MOV', customOutDir });
  }, []);

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

  const rightBarWidth = showRightBar && isFileOpened ? 200 : 0;
  const leftBarWidth = batchFiles.length > 0 ? 200 : 0;

  const bottomBarHeight = 96 + ((hasAudio && waveformEnabled) || (hasVideo && thumbnailsEnabled) ? timelineHeight : 0);

  const thumbnailsSorted = useMemo(() => sortBy(thumbnails, thumbnail => thumbnail.time), [thumbnails]);

  let timelineMode;
  if (thumbnailsEnabled) timelineMode = 'thumbnails';
  if (waveformEnabled) timelineMode = 'waveform';

  const { t } = useTranslation();

  function renderTuner(type) {
    // NOTE default values are duplicated in public/configStore.js
    const types = {
      wheelSensitivity: {
        title: t('Timeline trackpad/wheel sensitivity'),
        value: wheelSensitivity,
        setValue: setWheelSensitivity,
        default: 0.2,
      },
      keyboardNormalSeekSpeed: {
        title: t('Timeline keyboard seek speed'),
        value: keyboardNormalSeekSpeed,
        setValue: setKeyboardNormalSeekSpeed,
        min: 0,
        max: 100,
        default: 1,
      },
      keyboardSeekAccFactor: {
        title: t('Timeline keyboard seek acceleration'),
        value: keyboardSeekAccFactor,
        setValue: setKeyboardSeekAccFactor,
        min: 1,
        max: 2,
        default: 1.03,
      },
    };
    const { title, value, setValue, min, max, default: defaultValue } = types[type];

    const resetToDefault = () => setValue(defaultValue);

    return <ValueTuner title={title} style={{ bottom: bottomBarHeight }} value={value} setValue={setValue} onFinished={() => setTunerVisible()} max={max} min={min} resetToDefault={resetToDefault} />;
  }

  function renderSubtitles() {
    if (!activeSubtitle) return null;
    return <track default kind="subtitles" label={activeSubtitle.lang} srcLang="en" src={activeSubtitle.url} />;
  }

  // throw new Error('Test error boundary');

  return (
    <ThemeProvider value={theme}>
      <div>
        <div className="no-user-select" style={{ background: controlsBackground, height: topBarHeight, display: 'flex', alignItems: 'center', padding: '0 5px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <TopMenu
            filePath={filePath}
            height={topBarHeight}
            copyAnyAudioTrack={copyAnyAudioTrack}
            toggleStripAudio={toggleStripAudio}
            customOutDir={customOutDir}
            changeOutDir={changeOutDir}
            clearOutDir={clearOutDir}
            isCustomFormatSelected={isCustomFormatSelected}
            renderOutFmt={renderOutFmt}
            toggleHelp={toggleHelp}
            toggleSettings={toggleSettings}
            numStreamsToCopy={numStreamsToCopy}
            numStreamsTotal={numStreamsTotal}
            setStreamsSelectorShown={setStreamsSelectorShown}
            enabledOutSegments={enabledOutSegments}
            autoMerge={autoMerge}
            setAutoMerge={setAutoMerge}
            autoDeleteMergedSegments={autoDeleteMergedSegments}
            setAutoDeleteMergedSegments={setAutoDeleteMergedSegments}
            outFormatLocked={outFormatLocked}
            onOutFormatLockedClick={onOutFormatLockedClick}
            simpleMode={simpleMode}
          />
        </div>

        {!isFileOpened && <NoFileLoaded top={topBarHeight} bottom={bottomBarHeight} left={leftBarWidth} mifiLink={mifiLink} toggleHelp={toggleHelp} currentCutSeg={currentCutSeg} simpleMode={simpleMode} toggleSimpleMode={toggleSimpleMode} />}

        <AnimatePresence>
          {working && (
            <div style={{
              position: 'absolute', zIndex: 1, bottom: bottomBarHeight, top: topBarHeight, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center',
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
                    loop
                    animationData={loadingLottie}
                    play
                    style={{ width: '170%', height: '130%', marginLeft: '-35%', marginTop: '-29%', pointerEvents: 'none' }}
                  />
                </div>

                <div style={{ marginTop: 10, width: 150 }}>
                  {working}...
                </div>

                {(cutProgress != null) && (
                  <div style={{ marginTop: 10 }}>
                    {`${(cutProgress * 100).toFixed(1)} %`}
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <div className="no-user-select" style={{ position: 'absolute', top: topBarHeight, left: leftBarWidth, right: rightBarWidth, bottom: bottomBarHeight, visibility: !isFileOpened ? 'hidden' : undefined }} onWheel={onTimelineWheel}>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            muted={playbackVolume === 0}
            ref={videoRef}
            style={videoStyle}
            src={fileUri}
            onPlay={onSartPlaying}
            onPause={onStopPlaying}
            onDurationChange={onDurationChange}
            onTimeUpdate={onTimeUpdate}
            onError={onVideoError}
          >
            {renderSubtitles()}
          </video>

          {canvasPlayerEnabled && <Canvas rotate={effectiveRotation} filePath={filePath} width={mainVideoStream.width} height={mainVideoStream.height} streamIndex={mainVideoStream.index} playerTime={playerTime} commandedTime={commandedTime} playing={playing} />}
        </div>

        {isRotationSet && !hideCanvasPreview && (
          <div style={{
            position: 'absolute', top: topBarHeight, marginTop: '1em', marginRight: '1em', right: rightBarWidth, left: leftBarWidth, color: 'white',
          }}
          >
            {t('Rotation preview')}
            {!canvasPlayerRequired && <FaWindowClose role="button" style={{ cursor: 'pointer', verticalAlign: 'middle', padding: 10 }} onClick={() => setHideCanvasPreview(true)} />}
          </div>
        )}

        <AnimatePresence>
          {batchFiles.length > 0 && (
            <motion.div
              style={{ position: 'absolute', width: leftBarWidth, left: 0, bottom: bottomBarHeight, top: topBarHeight, background: timelineBackground, color: 'rgba(255,255,255,0.7)', display: 'flex', flexDirection: 'column' }}
              initial={{ x: -leftBarWidth }}
              animate={{ x: 0 }}
              exit={{ x: -leftBarWidth }}
            >
              <div style={{ background: controlsBackground, fontSize: 14, paddingBottom: 7, paddingTop: 3, paddingLeft: 10, paddingRight: 5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {t('Batch file list')}

                <div style={{ flexGrow: 1 }} />

                {batchFiles.length > 1 && <MergeColumnsIcon role="button" title={t('Merge/concatenate files')} color="white" style={{ marginRight: 10, cursor: 'pointer' }} onClick={() => setConcatDialogVisible(true)} />}

                <FaTimes size={18} role="button" style={{ cursor: 'pointer', color: 'white' }} onClick={() => closeBatch()} title={t('Close batch')} />
              </div>

              <div style={{ overflowX: 'hidden', overflowY: 'auto' }}>
                {batchFiles.map(({ path, name }) => (
                  <BatchFile key={path} path={path} name={name} filePath={filePath} onOpen={batchOpenSingleFile} onDelete={removeBatchFile} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isFileOpened && (
          <>
            <div
              className="no-user-select"
              style={{
                position: 'absolute', right: rightBarWidth, bottom: bottomBarHeight, marginBottom: 10, color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center',
              }}
            >
              <VolumeControl playbackVolume={playbackVolume} setPlaybackVolume={setPlaybackVolume} usingDummyVideo={usingDummyVideo} />

              {subtitleStreams.length > 0 && <SubtitleControl subtitleStreams={subtitleStreams} activeSubtitleStreamIndex={activeSubtitleStreamIndex} onActiveSubtitleChange={onActiveSubtitleChange} />}

              {!showRightBar && (
                <FaAngleLeft
                  title={t('Show sidebar')}
                  size={30}
                  role="button"
                  style={{ marginRight: 10 }}
                  onClick={toggleRightBar}
                />
              )}
            </div>

            <AnimatePresence>
              {showRightBar && (
                <motion.div
                  style={{ position: 'absolute', width: rightBarWidth, right: 0, bottom: bottomBarHeight, top: topBarHeight, background: controlsBackground, color: 'rgba(255,255,255,0.7)', display: 'flex', flexDirection: 'column' }}
                  initial={{ x: rightBarWidth }}
                  animate={{ x: 0 }}
                  exit={{ x: rightBarWidth }}
                >
                  <SegmentList
                    simpleMode={simpleMode}
                    currentSegIndex={currentSegIndexSafe}
                    outSegments={outSegments}
                    cutSegments={apparentCutSegments}
                    getFrameCount={getFrameCount}
                    formatTimecode={formatTimecode}
                    invertCutSegments={invertCutSegments}
                    onSegClick={setCurrentSegIndex}
                    updateSegOrder={updateSegOrder}
                    updateSegOrders={updateSegOrders}
                    onLabelSegmentPress={onLabelSegmentPress}
                    currentCutSeg={currentCutSeg}
                    segmentAtCursor={segmentAtCursor}
                    addCutSegment={addCutSegment}
                    removeCutSegment={removeCutSegment}
                    toggleSideBar={toggleRightBar}
                    splitCurrentSegment={splitCurrentSegment}
                    enabledOutSegmentsRaw={enabledOutSegmentsRaw}
                    enabledOutSegments={enabledOutSegments}
                    onExportSingleSegmentClick={onExportSingleSegmentClick}
                    onExportSegmentEnabledToggle={onExportSegmentEnabledToggle}
                    onExportSegmentDisableAll={onExportSegmentDisableAll}
                    onExportSegmentEnableAll={onExportSegmentEnableAll}
                    jumpSegStart={jumpSegStart}
                    jumpSegEnd={jumpSegEnd}
                    onViewSegmentTagsPress={onViewSegmentTagsPress}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        <motion.div
          className="no-user-select"
          style={{ background: controlsBackground, position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
          animate={{ height: bottomBarHeight }}
        >
          <Timeline
            shouldShowKeyframes={shouldShowKeyframes}
            waveforms={waveforms}
            shouldShowWaveform={shouldShowWaveform}
            waveformEnabled={waveformEnabled}
            thumbnailsEnabled={thumbnailsEnabled}
            neighbouringKeyFrames={neighbouringKeyFrames}
            thumbnails={thumbnailsSorted}
            getCurrentTime={getCurrentTime}
            commandedTimeRef={commandedTimeRef}
            startTimeOffset={startTimeOffset}
            playerTime={playerTime}
            commandedTime={commandedTime}
            zoom={zoom}
            seekAbs={seekAbs}
            durationSafe={durationSafe}
            apparentCutSegments={apparentCutSegments}
            setCurrentSegIndex={setCurrentSegIndex}
            currentSegIndexSafe={currentSegIndexSafe}
            invertCutSegments={invertCutSegments}
            inverseCutSegments={inverseCutSegments}
            formatTimecode={formatTimecode}
            timelineHeight={timelineHeight}
            onZoomWindowStartTimeChange={setZoomWindowStartTime}
            playing={playing}
            isFileOpened={isFileOpened}
            onWheel={onTimelineWheel}
            goToTimecode={goToTimecode}
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
            togglePlay={togglePlay}
            setTimelineMode={setTimelineMode}
            timelineMode={timelineMode}
            hasAudio={hasAudio}
            hasVideo={hasVideo}
            keyframesEnabled={keyframesEnabled}
            toggleKeyframesEnabled={toggleKeyframesEnabled}
            simpleMode={simpleMode}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', height: 36 }}>
            <BottomLeftMenu
              zoom={zoom}
              setZoom={setZoom}
              invertCutSegments={invertCutSegments}
              setInvertCutSegments={setInvertCutSegments}
              toggleComfortZoom={toggleComfortZoom}
              simpleMode={simpleMode}
              toggleSimpleMode={toggleSimpleMode}
            />

            <BottomRightMenu
              hasVideo={hasVideo}
              isRotationSet={isRotationSet}
              rotation={rotation}
              areWeCutting={areWeCutting}
              autoMerge={autoMerge}
              increaseRotation={increaseRotation}
              cleanupFiles={cleanupFiles}
              renderCaptureFormatButton={renderCaptureFormatButton}
              capture={capture}
              onExportPress={onExportPress}
              enabledOutSegments={enabledOutSegments}
              exportConfirmEnabled={exportConfirmEnabled}
              toggleExportConfirmEnabled={toggleExportConfirmEnabled}
              simpleMode={simpleMode}
            />
          </div>
        </motion.div>

        <SideSheet
          width={700}
          containerProps={{ style: { maxWidth: '100%' } }}
          position={Position.LEFT}
          isShown={streamsSelectorShown}
          onCloseComplete={() => setStreamsSelectorShown(false)}
        >
          <StreamsSelector
            mainFilePath={filePath}
            mainFileFormatData={fileFormatData}
            mainFileChapters={chapters}
            externalFiles={externalStreamFiles}
            setExternalFiles={setExternalStreamFiles}
            showAddStreamSourceDialog={showAddStreamSourceDialog}
            streams={mainStreams}
            isCopyingStreamId={isCopyingStreamId}
            toggleCopyStreamId={toggleCopyStreamId}
            setCopyStreamIdsForPath={setCopyStreamIdsForPath}
            onExtractAllStreamsPress={extractAllStreams}
            onExtractStreamPress={extractSingleStream}
            areWeCutting={areWeCutting}
            shortestFlag={shortestFlag}
            setShortestFlag={setShortestFlag}
            nonCopiedExtraStreams={nonCopiedExtraStreams}
            AutoExportToggler={AutoExportToggler}
            customTagsByFile={customTagsByFile}
            setCustomTagsByFile={setCustomTagsByFile}
            customTagsByStreamId={customTagsByStreamId}
            setCustomTagsByStreamId={setCustomTagsByStreamId}
            dispositionByStreamId={dispositionByStreamId}
            setDispositionByStreamId={setDispositionByStreamId}
          />
        </SideSheet>

        <ExportConfirm filePath={filePath} autoMerge={autoMerge} setAutoMerge={setAutoMerge} areWeCutting={areWeCutting} enabledOutSegments={enabledOutSegments} visible={exportConfirmVisible} onClosePress={closeExportConfirm} onExportConfirm={onExportConfirm} keyframeCut={keyframeCut} toggleKeyframeCut={toggleKeyframeCut} renderOutFmt={renderOutFmt} preserveMovData={preserveMovData} togglePreserveMovData={togglePreserveMovData} movFastStart={movFastStart} toggleMovFastStart={toggleMovFastStart} avoidNegativeTs={avoidNegativeTs} setAvoidNegativeTs={setAvoidNegativeTs} changeOutDir={changeOutDir} outputDir={outputDir} numStreamsTotal={numStreamsTotal} numStreamsToCopy={numStreamsToCopy} setStreamsSelectorShown={setStreamsSelectorShown} exportConfirmEnabled={exportConfirmEnabled} toggleExportConfirmEnabled={toggleExportConfirmEnabled} segmentsToChapters={segmentsToChapters} toggleSegmentsToChapters={toggleSegmentsToChapters} outFormat={fileFormat} preserveMetadataOnMerge={preserveMetadataOnMerge} togglePreserveMetadataOnMerge={togglePreserveMetadataOnMerge} setOutSegTemplate={setOutSegTemplate} outSegTemplate={outSegTemplateOrDefault} generateOutSegFileNames={generateOutSegFileNames} currentSegIndexSafe={currentSegIndexSafe} isOutSegFileNamesValid={isOutSegFileNamesValid} autoDeleteMergedSegments={autoDeleteMergedSegments} setAutoDeleteMergedSegments={setAutoDeleteMergedSegments} safeOutputFileName={safeOutputFileName} toggleSafeOutputFileName={toggleSafeOutputFileName} />

        <HelpSheet
          visible={helpVisible}
          onTogglePress={toggleHelp}
          ffmpegCommandLog={ffmpegCommandLog}
          currentCutSeg={currentCutSeg}
        />

        <SettingsSheet
          visible={settingsVisible}
          onTogglePress={toggleSettings}
          renderSettings={renderSettings}
        />

        <ConcatDialog isShown={batchFiles.length > 0 && concatDialogVisible} onHide={() => setConcatDialogVisible(false)} initialPaths={batchFilePaths} onConcat={mergeFiles} segmentsToChapters={segmentsToChapters} setSegmentsToChapters={setSegmentsToChapters} setAlwaysConcatMultipleFiles={setAlwaysConcatMultipleFiles} alwaysConcatMultipleFiles={alwaysConcatMultipleFiles} preserveMetadataOnMerge={preserveMetadataOnMerge} setPreserveMetadataOnMerge={setPreserveMetadataOnMerge} preserveMovData={preserveMovData} setPreserveMovData={setPreserveMovData} />

        {tunerVisible && renderTuner(tunerVisible)}
      </div>
    </ThemeProvider>
  );
});

export default App;
