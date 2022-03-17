import React, { memo, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { unstable_batchedUpdates as batchedUpdates } from 'react-dom';
import { FaAngleLeft, FaWindowClose } from 'react-icons/fa';
import { MdRotate90DegreesCcw } from 'react-icons/md';
import { AnimatePresence, motion } from 'framer-motion';
import { Table, SideSheet, Position, ThemeProvider } from 'evergreen-ui';
import { useStateWithHistory } from 'react-use/lib/useStateWithHistory';
import useDebounceOld from 'react-use/lib/useDebounce'; // Want to phase out this
import { useDebounce } from 'use-debounce';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';
import JSON5 from 'json5';

import fromPairs from 'lodash/fromPairs';
import sortBy from 'lodash/sortBy';
import flatMap from 'lodash/flatMap';
import isEqual from 'lodash/isEqual';

import theme from './theme';
import useTimelineScroll from './hooks/useTimelineScroll';
import useUserSettingsRoot from './hooks/useUserSettingsRoot';
import useFfmpegOperations from './hooks/useFfmpegOperations';
import useKeyframes from './hooks/useKeyframes';
import useWaveform from './hooks/useWaveform';
import useKeyboard from './hooks/useKeyboard';
import useFileFormatState from './hooks/useFileFormatState';

import UserSettingsContext from './contexts/UserSettingsContext';

import NoFileLoaded from './NoFileLoaded';
import Canvas from './Canvas';
import TopMenu from './TopMenu';
import Sheet from './Sheet';
import HelpSheet from './HelpSheet';
import StreamsSelector from './StreamsSelector';
import SegmentList from './SegmentList';
import Settings from './Settings';
import Timeline from './Timeline';
import BottomBar from './BottomBar';
import ExportConfirm from './ExportConfirm';
import ValueTuners from './components/ValueTuners';
import VolumeControl from './components/VolumeControl';
import SubtitleControl from './components/SubtitleControl';
import BatchFilesList from './components/BatchFilesList';
import ConcatDialog from './components/ConcatDialog';
import KeyboardShortcuts from './components/KeyboardShortcuts';
import Loading from './components/Loading';
import OutputFormatSelect from './components/OutputFormatSelect';

import { loadMifiLink } from './mifi';
import { controlsBackground } from './colors';
import { captureFrameFromTag, captureFramesFfmpeg } from './capture-frame';
import {
  getStreamFps, isCuttingStart, isCuttingEnd,
  readFileMeta, getSmarterOutFormat, renderThumbnails as ffmpegRenderThumbnails,
  extractStreams, runStartupCheck, setCustomFfPath as ffmpegSetCustomFfPath,
  isIphoneHevc, tryMapChaptersToEdl,
  getDuration, getTimecodeFromStreams, createChaptersFromSegments, extractSubtitleTrack,
} from './ffmpeg';
import { shouldCopyStreamByDefault, getAudioStreams, getRealVideoStreams, defaultProcessedCodecTypes, isAudioDefinitelyNotSupported, doesPlayerSupportFile } from './util/streams';
import { exportEdlFile, readEdlFile, saveLlcProject, loadLlcProject, askForEdlImport } from './edlStore';
import { formatYouTube, getFrameCountRaw } from './edlFormats';
import {
  getOutPath, toast, errorToast, handleError, setFileNameTitle, getOutDir, getFileDir,
  checkDirWriteAccess, dirExists, openDirToast, isMasBuild, isStoreBuild, dragPreventer,
  isDurationValid, filenamify, getOutFileExtension, generateSegFileName, defaultOutSegTemplate,
  havePermissionToReadFile, resolvePathIfNeeded, getPathReadAccessError, html5ifiedPrefix, html5dummySuffix, findExistingHtml5FriendlyFile,
  deleteFiles, isOutOfSpaceError, shuffleArray,
} from './util';
import { formatDuration } from './util/duration';
import { adjustRate } from './util/rate-calculator';
import { askForOutDir, askForInputDir, askForImportChapters, createNumSegments as createNumSegmentsDialog, createFixedDurationSegments as createFixedDurationSegmentsDialog, promptTimeOffset, askForHtml5ifySpeed, askForFileOpenAction, confirmExtractAllStreamsDialog, showCleanupFilesDialog, showDiskFull, showCutFailedDialog, labelSegmentDialog, openYouTubeChaptersDialog, openAbout, showEditableJsonDialog, askForShiftSegments, selectSegmentsByLabelDialog, confirmExtractFramesAsImages } from './dialogs';
import { openSendReportDialog } from './reporting';
import { fallbackLng } from './i18n';
import { createSegment, getCleanCutSegments, getSegApparentStart, findSegmentsAtCursor, sortSegments, invertSegments, getSegmentTags, convertSegmentsToChapters, hasAnySegmentOverlap } from './segments';
import { getOutSegError as getOutSegErrorRaw } from './util/outputNameTemplate';


const isDev = window.require('electron-is-dev');
const electron = window.require('electron'); // eslint-disable-line
const { exists } = window.require('fs-extra');
const filePathToUrl = window.require('file-url');
const { parse: parsePath, join: pathJoin, basename, dirname } = window.require('path');

const { dialog } = electron.remote;

const { focusWindow } = electron.remote.require('./electron');


const ffmpegExtractWindow = 60;
const calcShouldShowWaveform = (zoomedDuration) => (zoomedDuration != null && zoomedDuration < ffmpegExtractWindow * 8);
const calcShouldShowKeyframes = (zoomedDuration) => (zoomedDuration != null && zoomedDuration < ffmpegExtractWindow * 8);


const zoomMax = 2 ** 14;

const rightBarWidth = 200;
const leftBarWidth = 240;


const videoStyle = { width: '100%', height: '100%', objectFit: 'contain' };
const bottomMotionStyle = { background: controlsBackground };


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
  const [rotation, setRotation] = useState(360);
  const [cutProgress, setCutProgress] = useState();
  const [startTimeOffset, setStartTimeOffset] = useState(0);
  const [filePath, setFilePath] = useState('');
  const [externalFilesMeta, setExternalFilesMeta] = useState({});
  const [customTagsByFile, setCustomTagsByFile] = useState({});
  const [customTagsByStreamId, setCustomTagsByStreamId] = useState({});
  const [dispositionByStreamId, setDispositionByStreamId] = useState({});
  const [detectedFps, setDetectedFps] = useState();
  const [mainFileMeta, setMainFileMeta] = useState({ streams: [], formatData: {} });
  const [mainVideoStream, setMainVideoStream] = useState();
  const [mainAudioStream, setMainAudioStream] = useState();
  const [copyStreamIdsByFile, setCopyStreamIdsByFile] = useState({});
  const [streamsSelectorShown, setStreamsSelectorShown] = useState(false);
  const [concatDialogVisible, setConcatDialogVisible] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [thumbnails, setThumbnails] = useState([]);
  const [shortestFlag, setShortestFlag] = useState(false);
  const [zoomWindowStartTime, setZoomWindowStartTime] = useState(0);
  const [deselectedSegmentIds, setDeselectedSegmentIds] = useState({});
  const [subtitlesByStreamId, setSubtitlesByStreamId] = useState({});
  const [activeSubtitleStreamIndex, setActiveSubtitleStreamIndex] = useState();
  const [hideCanvasPreview, setHideCanvasPreview] = useState(false);
  const [exportConfirmVisible, setExportConfirmVisible] = useState(false);

  const { fileFormat, setFileFormat, detectedFileFormat, setDetectedFileFormat, isCustomFormatSelected } = useFileFormatState();

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
  const [keyboardShortcutsVisible, setKeyboardShortcutsVisible] = useState(false);
  const [mifiLink, setMifiLink] = useState();
  const [alwaysConcatMultipleFiles, setAlwaysConcatMultipleFiles] = useState(false);

  // Batch state / concat files
  const [batchFiles, setBatchFiles] = useState([]);
  const [selectedBatchFiles, setSelectedBatchFiles] = useState([]);

  // Segment related state
  const segCounterRef = useRef(0);
  const clearSegCounter = useCallback(() => {
    segCounterRef.current = 0;
  }, []);

  const createIndexedSegment = useCallback(({ segment, incrementCount } = {}) => {
    if (incrementCount) segCounterRef.current += 1;
    const ret = createSegment({ segColorIndex: segCounterRef.current, ...segment });
    return ret;
  }, []);

  const createInitialCutSegments = useCallback(() => [createIndexedSegment()], [createIndexedSegment]);

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

  const shuffleSegments = useCallback(() => setCutSegments((oldSegments) => shuffleArray(oldSegments)), [setCutSegments]);

  // Store "working" in a ref so we can avoid race conditions
  const workingRef = useRef(working);
  const setWorking = useCallback((val) => {
    workingRef.current = val;
    setWorkingState(val);
  }, []);

  const durationSafe = isDurationValid(duration) ? duration : 1;
  const zoomedDuration = isDurationValid(duration) ? duration / zoom : undefined;

  const {
    captureFormat, setCaptureFormat, customOutDir, setCustomOutDir, keyframeCut, setKeyframeCut, preserveMovData, setPreserveMovData, movFastStart, setMovFastStart, avoidNegativeTs, setAvoidNegativeTs, autoMerge, setAutoMerge, timecodeFormat, setTimecodeFormat, invertCutSegments, setInvertCutSegments, autoExportExtraStreams, setAutoExportExtraStreams, askBeforeClose, setAskBeforeClose, enableAskForImportChapters, setEnableAskForImportChapters, enableAskForFileOpenAction, setEnableAskForFileOpenAction, playbackVolume, setPlaybackVolume, autoSaveProjectFile, setAutoSaveProjectFile, wheelSensitivity, setWheelSensitivity, invertTimelineScroll, setInvertTimelineScroll, language, setLanguage, ffmpegExperimental, setFfmpegExperimental, hideNotifications, setHideNotifications, autoLoadTimecode, setAutoLoadTimecode, autoDeleteMergedSegments, setAutoDeleteMergedSegments, exportConfirmEnabled, setExportConfirmEnabled, segmentsToChapters, setSegmentsToChapters, preserveMetadataOnMerge, setPreserveMetadataOnMerge, simpleMode, setSimpleMode, outSegTemplate, setOutSegTemplate, keyboardSeekAccFactor, setKeyboardSeekAccFactor, keyboardNormalSeekSpeed, setKeyboardNormalSeekSpeed, enableTransferTimestamps, setEnableTransferTimestamps, outFormatLocked, setOutFormatLocked, safeOutputFileName, setSafeOutputFileName, enableAutoHtml5ify, setEnableAutoHtml5ify, segmentsToChaptersOnly, setSegmentsToChaptersOnly, keyBindings, setKeyBindings, resetKeyBindings, enableSmartCut, setEnableSmartCut, customFfPath, setCustomFfPath, storeProjectInWorkingDir, setStoreProjectInWorkingDir,
  } = useUserSettingsRoot();

  useEffect(() => {
    ffmpegSetCustomFfPath(customFfPath);
  }, [customFfPath]);

  const {
    concatFiles, html5ifyDummy, cutMultiple, autoConcatCutSegments, html5ify, fixInvalidDuration,
  } = useFfmpegOperations({ filePath, enableTransferTimestamps });

  const outSegTemplateOrDefault = outSegTemplate || defaultOutSegTemplate;

  useEffect(() => {
    const l = language || fallbackLng;
    i18n.changeLanguage(l).catch(console.error);
    electron.ipcRenderer.send('setLanguage', l);
  }, [language]);

  const videoRef = useRef();

  const isFileOpened = !!filePath;

  const onOutputFormatUserChange = useCallback((newFormat) => {
    setFileFormat(newFormat);
    if (outFormatLocked) {
      setOutFormatLocked(newFormat === detectedFileFormat ? undefined : newFormat);
    }
  }, [detectedFileFormat, outFormatLocked, setFileFormat, setOutFormatLocked]);

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

  const setCopyStreamIdsForPath = useCallback((path, cb) => {
    setCopyStreamIdsByFile((old) => {
      const oldIds = old[path] || {};
      return ({ ...old, [path]: cb(oldIds) });
    });
  }, []);

  const toggleSegmentsList = useCallback(() => setShowRightBar(v => !v), []);

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
    let outVal = val;
    if (outVal < 0) outVal = 0;
    if (outVal > video.duration) outVal = video.duration;

    video.currentTime = outVal;
    setCommandedTime(outVal);
  }, []);

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

  const shortStep = useCallback((direction) => {
    // If we don't know fps, just assume 30 (for example if audio file)
    const fps = detectedFps || 30;

    // try to align with frame
    const currentTimeNearestFrameNumber = getFrameCountRaw(fps, videoRef.current.currentTime);
    const nextFrame = currentTimeNearestFrameNumber + direction;
    seekAbs(nextFrame / fps);
  }, [seekAbs, detectedFps]);

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
  const timelineToggleComfortZoom = useCallback(() => {
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

  const haveInvalidSegs = useMemo(() => apparentCutSegments.some((cutSegment) => cutSegment.start >= cutSegment.end), [apparentCutSegments]);

  const currentSegIndexSafe = Math.min(currentSegIndex, cutSegments.length - 1);
  const currentCutSeg = useMemo(() => cutSegments[currentSegIndexSafe], [currentSegIndexSafe, cutSegments]);
  const currentApparentCutSeg = useMemo(() => apparentCutSegments[currentSegIndexSafe], [apparentCutSegments, currentSegIndexSafe]);

  const jumpSegStart = useCallback((index) => seekAbs(apparentCutSegments[index].start), [apparentCutSegments, seekAbs]);
  const jumpSegEnd = useCallback((index) => seekAbs(apparentCutSegments[index].end), [apparentCutSegments, seekAbs]);
  const jumpCutStart = useCallback(() => jumpSegStart(currentSegIndexSafe), [currentSegIndexSafe, jumpSegStart]);
  const jumpCutEnd = useCallback(() => jumpSegEnd(currentSegIndexSafe), [currentSegIndexSafe, jumpSegEnd]);
  const jumpTimelineStart = useCallback(() => seekAbs(0), [seekAbs]);
  const jumpTimelineEnd = useCallback(() => seekAbs(durationSafe), [durationSafe, seekAbs]);

  const inverseCutSegments = useMemo(() => {
    const inverted = !haveInvalidSegs && isDurationValid(duration) ? invertSegments(sortSegments(apparentCutSegments), true, true, duration) : undefined;
    return (inverted || []).map((seg) => ({ ...seg, segId: `${seg.start}-${seg.end}` }));
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

  const shiftAllSegmentTimes = useCallback(async () => {
    const shiftValue = await askForShiftSegments();
    if (shiftValue == null) return;
    const clampValue = (val) => Math.min(Math.max(val + shiftValue, 0), duration);
    const newSegments = apparentCutSegments.map((segment) => ({ ...segment, start: clampValue(segment.start + shiftValue), end: clampValue(segment.end + shiftValue) })).filter((segment) => segment.end > segment.start);
    if (newSegments.length < 1) setCutSegments(createInitialCutSegments());
    else setCutSegments(newSegments);
  }, [apparentCutSegments, createInitialCutSegments, duration, setCutSegments]);

  const maxLabelLength = safeOutputFileName ? 100 : 500;

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

  const getFrameCount = useCallback((sec) => getFrameCountRaw(detectedFps, sec), [detectedFps]);

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

  const getCurrentTime = useCallback(() => (playing ? videoRef.current.currentTime : commandedTimeRef.current), [playing]);

  // const getSafeCutTime = useCallback((cutTime, next) => ffmpeg.getSafeCutTime(neighbouringFrames, cutTime, next), [neighbouringFrames]);

  const addSegment = useCallback(() => {
    try {
      // Cannot add if prev seg is not finished
      if (currentCutSeg.start === undefined && currentCutSeg.end === undefined) return;

      const suggestedStart = getCurrentTime();
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
  }, [currentCutSeg.start, currentCutSeg.end, getCurrentTime, duration, cutSegments, createIndexedSegment, setCutSegments]);

  const setCutStart = useCallback(() => {
    if (!filePath) return;

    const currentTime = getCurrentTime();
    // https://github.com/mifi/lossless-cut/issues/168
    // If current time is after the end of the current segment in the timeline,
    // add a new segment that starts at playerTime
    if (currentCutSeg.end != null && currentTime >= currentCutSeg.end) {
      addSegment();
    } else {
      try {
        const startTime = currentTime;
        /* if (keyframeCut) {
          const keyframeAlignedCutTo = getSafeCutTime(startTime, true);
          if (keyframeAlignedCutTo != null) startTime = keyframeAlignedCutTo;
        } */
        setCutTime('start', startTime);
      } catch (err) {
        handleError(err);
      }
    }
  }, [filePath, getCurrentTime, currentCutSeg.end, addSegment, setCutTime]);

  const setCutEnd = useCallback(() => {
    if (!filePath) return;

    try {
      const endTime = getCurrentTime();

      /* if (keyframeCut) {
        const keyframeAlignedCutTo = getSafeCutTime(endTime, false);
        if (keyframeAlignedCutTo != null) endTime = keyframeAlignedCutTo;
      } */
      setCutTime('end', endTime);
    } catch (err) {
      handleError(err);
    }
  }, [filePath, getCurrentTime, setCutTime]);

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
  // New LLC format can be stored along with input file or in working dir (customOutDir)
  const getEdlFilePath = useCallback((fp, storeProjectInWorkingDir2 = false) => getOutPath({ customOutDir: storeProjectInWorkingDir2 ? customOutDir : undefined, filePath: fp, nameSuffix: projectSuffix }), [customOutDir]);
  // Old versions of LosslessCut used CSV files and stored them in customOutDir:
  const getEdlFilePathOld = useCallback((fp) => getOutPath({ customOutDir, filePath: fp, nameSuffix: oldProjectSuffix }), [customOutDir]);
  const projectFileSavePath = useMemo(() => getEdlFilePath(filePath, storeProjectInWorkingDir), [getEdlFilePath, filePath, storeProjectInWorkingDir]);

  const currentSaveOperation = useMemo(() => {
    if (!projectFileSavePath) return undefined;
    return { cutSegments, projectFileSavePath, filePath };
  }, [cutSegments, filePath, projectFileSavePath]);

  const [debouncedSaveOperation] = useDebounce(currentSaveOperation, isDev ? 2000 : 500);

  const lastSaveOperation = useRef();
  useEffect(() => {
    async function save() {
      // NOTE: Could lose a save if user closes too fast, but not a big issue I think
      if (!autoSaveProjectFile || !debouncedSaveOperation) return;

      try {
        // Initial state? Don't save (same as createInitialCutSegments but without counting)
        if (isEqual(getCleanCutSegments(debouncedSaveOperation.cutSegments), getCleanCutSegments([createSegment()]))) return;

        if (lastSaveOperation.current && lastSaveOperation.current.projectFileSavePath === debouncedSaveOperation.projectFileSavePath && isEqual(getCleanCutSegments(lastSaveOperation.current.cutSegments), getCleanCutSegments(debouncedSaveOperation.cutSegments))) {
          console.log('Segments unchanged, skipping save');
          return;
        }

        await saveLlcProject({ savePath: debouncedSaveOperation.projectFileSavePath, filePath: debouncedSaveOperation.filePath, cutSegments: debouncedSaveOperation.cutSegments });
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

  const ensureAccessibleDirectories = useCallback(async ({ inputPath, checkInputDir }) => {
    // MacOS App Store sandbox doesn't allow writing anywhere, and we set the flag com.apple.security.files.user-selected.read-write
    // With this flag, we can show the user an open-dialog for a directory, and once the user has opened that directory, we can write files there until the app is restarted.
    // NOTE: when MAS (dev) build, Application Support will instead be here:
    // ~/Library/Containers/no.mifi.losslesscut-mac/Data/Library/Application Support
    // To start from scratch: rm -rf ~/Library/Containers/no.mifi.losslesscut-mac
    // const simulateMasBuild = isDev; // can be used for testing this logic without having to build mas-dev
    const simulateMasBuild = false;

    const masMode = isMasBuild || simulateMasBuild;

    if (checkInputDir) {
      // Check input dir, if we need to write project file here
      const inputFileDir = getFileDir(inputPath);
      let simulateMasPermissionError = simulateMasBuild;
      for (;;) {
        // eslint-disable-next-line no-await-in-loop
        if (await checkDirWriteAccess(inputFileDir) && !simulateMasPermissionError) break;
        if (!masMode) {
          // fail right away
          errorToast(i18n.t('You have no write access to the directory of this file'));
          return { cancel: true };
        }

        // We are now mas, so we need to try to force the user to allow access to the dir, so we can write the project file later
        // eslint-disable-next-line no-await-in-loop
        const userSelectedDir = await askForInputDir(inputFileDir);
        simulateMasPermissionError = false; // assume user chose the right dir
        if (userSelectedDir == null) return { cancel: true }; // allow user to cancel
      }
    }

    let newCustomOutDir = customOutDir;

    // Reset if doesn't exist anymore
    const customOutDirExists = await dirExists(customOutDir);
    if (!customOutDirExists) {
      setCustomOutDir(undefined);
      newCustomOutDir = undefined;
    }

    const effectiveOutDirPath = getOutDir(newCustomOutDir, inputPath);
    const hasDirWriteAccess = await checkDirWriteAccess(effectiveOutDirPath);
    if (!hasDirWriteAccess || simulateMasBuild) {
      if (masMode) {
        const newOutDir = await askForOutDir(effectiveOutDirPath);
        // If user canceled open dialog, refuse to continue, because we will get permission denied error from MAS sandbox
        if (!newOutDir) return { cancel: true };
        setCustomOutDir(newOutDir);
        newCustomOutDir = newOutDir;
      } else {
        errorToast(i18n.t('You have no write access to the directory of this file, please select a custom working dir'));
        setCustomOutDir(undefined);
        newCustomOutDir = undefined;
        return { cancel: true };
      }
    }

    return { cancel: false, newCustomOutDir };
  }, [customOutDir, setCustomOutDir]);

  const concatCurrentBatch = useCallback(() => {
    if (batchFiles.length < 2) {
      errorToast(i18n.t('Please open at least 2 files to merge, then try again'));
      return;
    }

    setConcatDialogVisible(true);
  }, [batchFiles]);

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
    const newValue = !v;
    if (newValue) setInvertCutSegments(false);
    return newValue;
  }), [hideAllNotifications, setInvertCutSegments, setSimpleMode]);

  const effectiveExportMode = useMemo(() => {
    if (segmentsToChaptersOnly) return 'sesgments_to_chapters';
    if (autoMerge && autoDeleteMergedSegments) return 'merge';
    if (autoMerge) return 'merge+separate';
    return 'separate';
  }, [autoDeleteMergedSegments, autoMerge, segmentsToChaptersOnly]);

  const userSettingsContext = useMemo(() => ({
    captureFormat, setCaptureFormat, toggleCaptureFormat, customOutDir, setCustomOutDir, changeOutDir, keyframeCut, setKeyframeCut, toggleKeyframeCut, preserveMovData, setPreserveMovData, togglePreserveMovData, movFastStart, setMovFastStart, toggleMovFastStart, avoidNegativeTs, setAvoidNegativeTs, autoMerge, setAutoMerge, timecodeFormat, setTimecodeFormat, invertCutSegments, setInvertCutSegments, autoExportExtraStreams, setAutoExportExtraStreams, askBeforeClose, setAskBeforeClose, enableAskForImportChapters, setEnableAskForImportChapters, enableAskForFileOpenAction, setEnableAskForFileOpenAction, playbackVolume, setPlaybackVolume, autoSaveProjectFile, setAutoSaveProjectFile, wheelSensitivity, setWheelSensitivity, invertTimelineScroll, setInvertTimelineScroll, language, setLanguage, ffmpegExperimental, setFfmpegExperimental, hideNotifications, setHideNotifications, autoLoadTimecode, setAutoLoadTimecode, autoDeleteMergedSegments, setAutoDeleteMergedSegments, exportConfirmEnabled, setExportConfirmEnabled, toggleExportConfirmEnabled, segmentsToChapters, setSegmentsToChapters, toggleSegmentsToChapters, preserveMetadataOnMerge, setPreserveMetadataOnMerge, togglePreserveMetadataOnMerge, simpleMode, setSimpleMode, toggleSimpleMode, outSegTemplate, setOutSegTemplate, keyboardSeekAccFactor, setKeyboardSeekAccFactor, keyboardNormalSeekSpeed, setKeyboardNormalSeekSpeed, enableTransferTimestamps, setEnableTransferTimestamps, outFormatLocked, setOutFormatLocked, safeOutputFileName, setSafeOutputFileName, toggleSafeOutputFileName, enableAutoHtml5ify, setEnableAutoHtml5ify, segmentsToChaptersOnly, setSegmentsToChaptersOnly, keyBindings, setKeyBindings, resetKeyBindings, enableSmartCut, setEnableSmartCut, customFfPath, setCustomFfPath, storeProjectInWorkingDir, setStoreProjectInWorkingDir, effectiveExportMode,
  }), [askBeforeClose, autoDeleteMergedSegments, autoExportExtraStreams, autoLoadTimecode, autoMerge, autoSaveProjectFile, avoidNegativeTs, captureFormat, changeOutDir, customFfPath, customOutDir, effectiveExportMode, enableAskForFileOpenAction, enableAskForImportChapters, enableAutoHtml5ify, enableSmartCut, enableTransferTimestamps, exportConfirmEnabled, ffmpegExperimental, hideNotifications, invertCutSegments, invertTimelineScroll, keyBindings, keyboardNormalSeekSpeed, keyboardSeekAccFactor, keyframeCut, language, movFastStart, outFormatLocked, outSegTemplate, playbackVolume, preserveMetadataOnMerge, preserveMovData, resetKeyBindings, safeOutputFileName, segmentsToChapters, segmentsToChaptersOnly, setAskBeforeClose, setAutoDeleteMergedSegments, setAutoExportExtraStreams, setAutoLoadTimecode, setAutoMerge, setAutoSaveProjectFile, setAvoidNegativeTs, setCaptureFormat, setCustomFfPath, setCustomOutDir, setEnableAskForFileOpenAction, setEnableAskForImportChapters, setEnableAutoHtml5ify, setEnableSmartCut, setEnableTransferTimestamps, setExportConfirmEnabled, setFfmpegExperimental, setHideNotifications, setInvertCutSegments, setInvertTimelineScroll, setKeyBindings, setKeyboardNormalSeekSpeed, setKeyboardSeekAccFactor, setKeyframeCut, setLanguage, setMovFastStart, setOutFormatLocked, setOutSegTemplate, setPlaybackVolume, setPreserveMetadataOnMerge, setPreserveMovData, setSafeOutputFileName, setSegmentsToChapters, setSegmentsToChaptersOnly, setSimpleMode, setStoreProjectInWorkingDir, setTimecodeFormat, setWheelSensitivity, simpleMode, storeProjectInWorkingDir, timecodeFormat, toggleCaptureFormat, toggleExportConfirmEnabled, toggleKeyframeCut, toggleMovFastStart, togglePreserveMetadataOnMerge, togglePreserveMovData, toggleSafeOutputFileName, toggleSegmentsToChapters, toggleSimpleMode, wheelSensitivity]);

  const isCopyingStreamId = useCallback((path, streamId) => (
    !!(copyStreamIdsByFile[path] || {})[streamId]
  ), [copyStreamIdsByFile]);

  const mainStreams = useMemo(() => mainFileMeta.streams, [mainFileMeta.streams]);
  const mainFileFormatData = useMemo(() => mainFileMeta.formatData, [mainFileMeta.formatData]);
  const mainFileChapters = useMemo(() => mainFileMeta.chapters, [mainFileMeta.chapters]);

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
    streamIds: Object.keys(streamIdsMap).filter(index => streamIdsMap[index]).map((streamIdStr) => parseInt(streamIdStr, 10)),
  })), [copyStreamIdsByFile]);

  const numStreamsToCopy = copyFileStreams
    .reduce((acc, { streamIds }) => acc + streamIds.length, 0);

  const allFilesMeta = useMemo(() => ({
    ...externalFilesMeta,
    [filePath]: mainFileMeta,
  }), [externalFilesMeta, filePath, mainFileMeta]);

  const numStreamsTotal = flatMap(Object.values(allFilesMeta), ({ streams }) => streams).length;

  const toggleStripAudio = useCallback(() => {
    setCopyStreamIdsForPath(filePath, (old) => {
      const newCopyStreamIds = { ...old };
      mainStreams.forEach((stream) => {
        if (stream.codec_type === 'audio') newCopyStreamIds[stream.index] = !copyAnyAudioTrack;
      });
      return newCopyStreamIds;
    });
  }, [copyAnyAudioTrack, filePath, mainStreams, setCopyStreamIdsForPath]);

  const removeSegments = useCallback((removeSegmentIds) => {
    if (cutSegments.length === 1 && cutSegments[0].start == null && cutSegments[0].end == null) return; // We are at initial segment, nothing more we can do (it cannot be removed)
    setCutSegments((existing) => {
      const newSegments = existing.filter((seg) => !removeSegmentIds.includes(seg.segId));
      if (newSegments.length === 0) {
        clearSegments(); // when removing the last segments, we start over
        return existing;
      }
      return newSegments;
    });
  }, [clearSegments, cutSegments, setCutSegments]);

  const removeCutSegment = useCallback((index) => {
    removeSegments([cutSegments[index].segId]);
  }, [cutSegments, removeSegments]);

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
      setDetectedFileFormat();
      setRotation(360);
      setCutProgress();
      setStartTimeOffset(0);
      setFilePath(''); // Setting video src="" prevents memory leak in chromium
      setExternalFilesMeta({});
      setCustomTagsByFile({});
      setCustomTagsByStreamId({});
      setDispositionByStreamId({});
      setDetectedFps();
      setMainFileMeta({ streams: [], formatData: [] });
      setMainVideoStream();
      setMainAudioStream();
      setCopyStreamIdsByFile({});
      setStreamsSelectorShown(false);
      setZoom(1);
      setThumbnails([]);
      setShortestFlag(false);
      setZoomWindowStartTime(0);
      setDeselectedSegmentIds({});
      setSubtitlesByStreamId({});
      setActiveSubtitleStreamIndex();
      setHideCanvasPreview(false);
      setExportConfirmVisible(false);

      cancelRenderThumbnails();
    });
  }, [cutSegmentsHistory, clearSegments, setFileFormat, setDetectedFileFormat, cancelRenderThumbnails]);


  const showUnsupportedFileMessage = useCallback(() => {
    if (!hideAllNotifications) toast.fire({ timer: 13000, text: i18n.t('File not natively supported. Preview may have no audio or low quality. The final export will however be lossless with audio. You may convert it from the menu for a better preview with audio.') });
  }, [hideAllNotifications]);

  const showPreviewFileLoadedMessage = useCallback((fileName) => {
    if (!hideAllNotifications) toast.fire({ icon: 'info', text: i18n.t('Loaded existing preview file: {{ fileName }}', { fileName }) });
  }, [hideAllNotifications]);

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

      try {
        const shouldIncludeVideo = !usesDummyVideo && hv;
        return await html5ify({ customOutDir: cod, filePath: fp, speed, hasAudio: ha, hasVideo: shouldIncludeVideo, onProgress: setCutProgress });
      } finally {
        setCutProgress();
      }
    }

    const path = await doHtml5ify();
    if (!path) return;

    setPreviewFilePath(path);
    setUsingDummyVideo(usesDummyVideo);
    showUnsupportedFileMessage();
  }, [html5ify, html5ifyDummy, showUnsupportedFileMessage]);

  const convertFormatBatch = useCallback(async () => {
    if (batchFiles.length < 1) return;
    const filePaths = batchFiles.map((f) => f.path);

    const failedFiles = [];
    let i = 0;
    const setTotalProgress = (fileProgress = 0) => setCutProgress((i + fileProgress) / filePaths.length);

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
          const { newCustomOutDir, cancel } = await ensureAccessibleDirectories({ inputPath: path });
          if (cancel) return;

          // eslint-disable-next-line no-await-in-loop
          await html5ify({ customOutDir: newCustomOutDir, filePath: path, speed, hasAudio: true, hasVideo: true, onProgress: setTotalProgress });
        } catch (err2) {
          console.error('Failed to html5ify', path, err2);
          failedFiles.push(path);
        }

        i += 1;
        setTotalProgress();
      }

      if (failedFiles.length > 0) toast.fire({ title: `${i18n.t('Failed to convert files:')} ${failedFiles.join(' ')}`, timer: null, showConfirmButton: true });
    } catch (err) {
      errorToast(i18n.t('Failed to batch convert to supported format'));
      console.error('Failed to html5ify', err);
    } finally {
      setWorking();
      setCutProgress();
    }
  }, [batchFiles, ensureAccessibleDirectories, html5ify, setWorking]);

  const getConvertToSupportedFormat = useCallback((fallback) => rememberConvertToSupportedFormat || fallback, [rememberConvertToSupportedFormat]);

  const html5ifyAndLoadWithPreferences = useCallback(async (cod, fp, speed, hv, ha) => {
    if (!enableAutoHtml5ify) return;
    setWorking(i18n.t('Converting to supported format'));
    await html5ifyAndLoad(cod, fp, getConvertToSupportedFormat(speed), hv, ha);
  }, [enableAutoHtml5ify, setWorking, html5ifyAndLoad, getConvertToSupportedFormat]);

  const showPlaybackFailedMessage = () => errorToast(i18n.t('Unable to playback this file. Try to convert to supported format from the menu'));

  const pause = useCallback(() => {
    if (!filePath || !playing) return;
    videoRef.current.pause();
  }, [filePath, playing]);

  const play = useCallback((resetPlaybackRate) => {
    if (!filePath || playing) return;

    const video = videoRef.current;
    if (resetPlaybackRate) video.playbackRate = 1;
    video.play().catch((err) => {
      showPlaybackFailedMessage();
      console.error(err);
    });
  }, [filePath, playing]);

  const togglePlay = useCallback((resetPlaybackRate) => {
    if (playing) {
      pause();
      return;
    }
    play(resetPlaybackRate);
  }, [playing, play, pause]);

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
    setSelectedBatchFiles([]);
  }, [askBeforeClose]);

  const batchRemoveFile = useCallback((path) => {
    setBatchFiles((existingBatch) => {
      const index = existingBatch.findIndex((existingFile) => existingFile.path === path);
      if (index < 0) return existingBatch;
      const newBatch = [...existingBatch];
      newBatch.splice(index, 1);
      const newItemAtIndex = newBatch[index];
      if (newItemAtIndex != null) setSelectedBatchFiles([newItemAtIndex.path]);
      else if (newBatch.length > 0) setSelectedBatchFiles([newBatch[0].path]);
      else setSelectedBatchFiles([]);
      return newBatch;
    });
  }, []);

  const userConcatFiles = useCallback(async ({ paths, includeAllStreams, streams, fileFormat: outFormat, isCustomFormatSelected: isCustomFormatSelected2, clearBatchFilesAfterConcat }) => {
    if (workingRef.current) return;
    try {
      setConcatDialogVisible(false);
      setWorking(i18n.t('Merging'));

      const firstPath = paths[0];
      const { newCustomOutDir, cancel } = await ensureAccessibleDirectories({ inputPath: firstPath });
      if (cancel) return;

      const ext = getOutFileExtension({ isCustomFormatSelected: isCustomFormatSelected2, outFormat, filePath: firstPath });
      const outPath = getOutPath({ customOutDir: newCustomOutDir, filePath: firstPath, nameSuffix: `merged${ext}` });
      const outDir = getOutDir(customOutDir, firstPath);

      let chaptersFromSegments;
      if (segmentsToChapters) {
        const chapterNames = paths.map((path) => parsePath(path).name);
        chaptersFromSegments = await createChaptersFromSegments({ segmentPaths: paths, chapterNames });
      }

      // console.log('merge', paths);
      const metadataFromPath = paths[0];
      await concatFiles({ paths, outPath, outDir, outFormat, metadataFromPath, includeAllStreams, streams, ffmpegExperimental, onProgress: setCutProgress, preserveMovData, movFastStart, preserveMetadataOnMerge, chapters: chaptersFromSegments, appendFfmpegCommandLog });
      if (clearBatchFilesAfterConcat) closeBatch();
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
  }, [setWorking, ensureAccessibleDirectories, customOutDir, segmentsToChapters, concatFiles, ffmpegExperimental, preserveMovData, movFastStart, preserveMetadataOnMerge, closeBatch]);

  const cleanupFilesDialog = useCallback(async () => {
    if (!isFileOpened) return;

    let trashResponse = cleanupChoices;
    if (!cleanupChoices.dontShowAgain) {
      trashResponse = await showCleanupFilesDialog(cleanupChoices);
      console.log('trashResponse', trashResponse);
      if (!trashResponse) return; // Cancelled
      setCleanupChoices(trashResponse); // Store for next time
    }

    if (workingRef.current) return;

    // Because we will reset state before deleting files
    const savedPaths = { previewFilePath, sourceFilePath: filePath, projectFilePath: projectFileSavePath };

    resetState();

    batchRemoveFile(savedPaths.sourceFilePath);

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
  }, [isFileOpened, cleanupChoices, previewFilePath, filePath, projectFileSavePath, resetState, batchRemoveFile, setWorking]);

  const nonFilteredSegments = useMemo(() => (
    invertCutSegments ? inverseCutSegments : apparentCutSegments
  ), [invertCutSegments, inverseCutSegments, apparentCutSegments]);

  const selectedSegmentsRaw = useMemo(() => {
    // For invertCutSegments we do not support filtering
    if (invertCutSegments) return inverseCutSegments;
    return apparentCutSegments.filter((s) => !deselectedSegmentIds[s.segId]);
  }, [invertCutSegments, inverseCutSegments, apparentCutSegments, deselectedSegmentIds]);

  // If user has selected none to export, it makes no sense, so export all instead
  const selectedSegments = selectedSegmentsRaw.length > 0 ? selectedSegmentsRaw : nonFilteredSegments;

  const selectOnlySegment = useCallback((seg) => setDeselectedSegmentIds(Object.fromEntries(cutSegments.filter((s) => s.segId !== seg.segId).map((s) => [s.segId, true]))), [cutSegments]);
  const toggleSegmentSelected = useCallback((seg) => setDeselectedSegmentIds((existing) => ({ ...existing, [seg.segId]: !existing[seg.segId] })), []);
  const deselectAllSegments = useCallback(() => setDeselectedSegmentIds(Object.fromEntries(cutSegments.map((s) => [s.segId, true]))), [cutSegments]);
  const selectAllSegments = useCallback(() => setDeselectedSegmentIds({}), []);

  const removeSelectedSegments = useCallback(() => removeSegments(selectedSegmentsRaw.map((seg) => seg.segId)), [removeSegments, selectedSegmentsRaw]);

  const selectOnlyCurrentSegment = useCallback(() => selectOnlySegment(currentCutSeg), [currentCutSeg, selectOnlySegment]);
  const toggleCurrentSegmentSelected = useCallback(() => toggleSegmentSelected(currentCutSeg), [currentCutSeg, toggleSegmentSelected]);

  const filenamifyOrNot = useCallback((name) => (safeOutputFileName ? filenamify(name) : name).substr(0, maxLabelLength), [safeOutputFileName, maxLabelLength]);

  const onLabelSegment = useCallback(async (index) => {
    const { name } = cutSegments[index];
    const value = await labelSegmentDialog({ currentName: name, maxLength: maxLabelLength });
    if (value != null) updateSegAtIndex(index, { name: value });
  }, [cutSegments, updateSegAtIndex, maxLabelLength]);

  const onLabelSelectedSegments = useCallback(async () => {
    if (selectedSegmentsRaw.length < 1) return;
    const { name } = selectedSegmentsRaw[0];
    const value = await labelSegmentDialog({ currentName: name, maxLength: maxLabelLength });
    setCutSegments((existingSegments) => existingSegments.map((existingSegment) => {
      if (selectedSegmentsRaw.some((seg) => seg.segId === existingSegment.segId)) return { ...existingSegment, name: value };
      return existingSegment;
    }));
  }, [maxLabelLength, selectedSegmentsRaw, setCutSegments]);

  const segmentsToExport = useMemo(() => {
    if (!segmentsToChaptersOnly) return selectedSegments;
    // segmentsToChaptersOnly is a special mode where all segments will be simply written out as chapters to one file: https://github.com/mifi/lossless-cut/issues/993#issuecomment-1037927595
    // Chapters export mode: Emulate a single segment with no cuts (full timeline)
    return [{ start: 0, end: getSegApparentEnd({}) }];
  }, [selectedSegments, getSegApparentEnd, segmentsToChaptersOnly]);

  const areWeCutting = useMemo(() => segmentsToExport.some(({ start, end }) => isCuttingStart(start) || isCuttingEnd(end, duration)), [duration, segmentsToExport]);

  const generateOutSegFileNames = useCallback(({ segments = segmentsToExport, template }) => (
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
      return safeOutputFileName ? generated.substring(0, 200) : generated; // If sanitation is enabled, make sure filename is not too long
    })
  ), [segmentsToExport, filenamifyOrNot, isCustomFormatSelected, fileFormat, filePath, safeOutputFileName]);

  const getOutSegError = useCallback((fileNames) => getOutSegErrorRaw({ fileNames, filePath, outputDir }), [outputDir, filePath]);

  const openSendReportDialogWithState = useCallback(async (err) => {
    const state = {
      filePath,
      fileFormat,
      setExternalFilesMeta,
      mainStreams,
      copyStreamIdsByFile,
      cutSegments: cutSegments.map(s => ({ start: s.start, end: s.end })),
      mainFileFormatData,
      rotation,
      shortestFlag,
      effectiveExportMode,
    };

    openSendReportDialog(err, state);
  }, [filePath, fileFormat, mainStreams, copyStreamIdsByFile, cutSegments, mainFileFormatData, rotation, shortestFlag, effectiveExportMode]);

  const handleCutFailed = useCallback(async (err) => {
    const sendErrorReport = await showCutFailedDialog({ detectedFileFormat });
    if (sendErrorReport) openSendReportDialogWithState(err);
  }, [openSendReportDialogWithState, detectedFileFormat]);

  const closeExportConfirm = useCallback(() => setExportConfirmVisible(false), []);

  const willMerge = segmentsToExport.length > 1 && autoMerge;

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

      // Special segments-to-chapters mode:
      let chaptersToAdd;
      if (segmentsToChaptersOnly) {
        const sortedSegments = sortSegments(selectedSegments);
        if (hasAnySegmentOverlap(sortedSegments)) {
          errorToast(i18n.t('Make sure you have no overlapping segments.'));
          return;
        }
        chaptersToAdd = convertSegmentsToChapters(sortedSegments);
      }

      console.log('outSegTemplateOrDefault', outSegTemplateOrDefault);

      let outSegFileNames = generateOutSegFileNames({ segments: segmentsToExport, template: outSegTemplateOrDefault });
      if (getOutSegError(outSegFileNames) != null) {
        console.error('Output segments file name invalid, using default instead', outSegFileNames);
        outSegFileNames = generateOutSegFileNames({ segments: segmentsToExport, template: defaultOutSegTemplate });
      }

      // throw (() => { const err = new Error('test'); err.code = 'ENOENT'; return err; })();
      const outFiles = await cutMultiple({
        outputDir,
        customOutDir,
        outFormat: fileFormat,
        videoDuration: duration,
        rotation: isRotationSet ? effectiveRotation : undefined,
        copyFileStreams,
        allFilesMeta,
        keyframeCut,
        segments: segmentsToExport,
        segmentsFileNames: outSegFileNames,
        onProgress: setCutProgress,
        appendFfmpegCommandLog,
        shortestFlag,
        ffmpegExperimental,
        preserveMovData,
        preserveMetadataOnMerge,
        movFastStart,
        avoidNegativeTs,
        customTagsByFile,
        customTagsByStreamId,
        dispositionByStreamId,
        chapters: chaptersToAdd,
        detectedFps,
        enableSmartCut,
      });

      if (willMerge) {
        setCutProgress(0);
        setWorking(i18n.t('Merging'));

        const chapterNames = segmentsToChapters && !invertCutSegments ? segmentsToExport.map((s) => s.name) : undefined;

        await autoConcatCutSegments({
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
          appendFfmpegCommandLog,
        });
      }

      const msgs = [i18n.t('Done! Note: cutpoints may be inaccurate. Make sure you test the output files in your desired player/editor before you delete the source. If output does not look right, see the HELP page.')];

      // https://github.com/mifi/lossless-cut/issues/329
      if (isIphoneHevc(mainFileFormatData, mainStreams)) msgs.push(i18n.t('There is a known issue with cutting iPhone HEVC videos. The output file may not work in all players.'));

      if (exportExtraStreams) {
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
  }, [numStreamsToCopy, setWorking, segmentsToChaptersOnly, selectedSegments, outSegTemplateOrDefault, generateOutSegFileNames, segmentsToExport, getOutSegError, cutMultiple, outputDir, customOutDir, fileFormat, duration, isRotationSet, effectiveRotation, copyFileStreams, allFilesMeta, keyframeCut, shortestFlag, ffmpegExperimental, preserveMovData, preserveMetadataOnMerge, movFastStart, avoidNegativeTs, customTagsByFile, customTagsByStreamId, dispositionByStreamId, detectedFps, enableSmartCut, willMerge, mainFileFormatData, mainStreams, exportExtraStreams, hideAllNotifications, segmentsToChapters, invertCutSegments, autoConcatCutSegments, isCustomFormatSelected, autoDeleteMergedSegments, filePath, nonCopiedExtraStreams, handleCutFailed]);

  const onExportPress = useCallback(async () => {
    if (!filePath || workingRef.current || segmentsToExport.length < 1) return;

    if (haveInvalidSegs) {
      errorToast(i18n.t('Start time must be before end time'));
      return;
    }

    if (exportConfirmEnabled) setExportConfirmVisible(true);
    else await onExportConfirm();
  }, [filePath, haveInvalidSegs, segmentsToExport, exportConfirmEnabled, onExportConfirm]);

  const captureSnapshot = useCallback(async () => {
    if (!filePath) return;

    try {
      const currentTime = getCurrentTime();
      const video = videoRef.current;
      const outPath = usingPreviewFile
        ? await captureFramesFfmpeg({ customOutDir, filePath, fromTime: currentTime, captureFormat, enableTransferTimestamps, numFrames: 1 })
        : await captureFrameFromTag({ customOutDir, filePath, currentTime, captureFormat, video, enableTransferTimestamps });

      if (!hideAllNotifications) openDirToast({ dirPath: outputDir, text: `${i18n.t('Screenshot captured to:')} ${outPath}` });
    } catch (err) {
      console.error(err);
      errorToast(i18n.t('Failed to capture frame'));
    }
  }, [filePath, getCurrentTime, usingPreviewFile, customOutDir, captureFormat, enableTransferTimestamps, hideAllNotifications, outputDir]);

  const extractSegmentFramesAsImages = useCallback(async (index) => {
    if (!filePath) return;
    const { start, end } = apparentCutSegments[index];
    const numFrames = getFrameCount(end - start);
    if (numFrames < 1) return;
    if (!(await confirmExtractFramesAsImages({ numFrames }))) return;

    try {
      setWorking(i18n.t('Extracting frames'));
      await captureFramesFfmpeg({ customOutDir, filePath, fromTime: start, captureFormat, enableTransferTimestamps, numFrames });
      if (!hideAllNotifications) openDirToast({ dirPath: outputDir, text: i18n.t('Frames extracted to: {{path}}', { path: outputDir }) });
    } catch (err) {
      handleError(err);
    } finally {
      setWorking();
    }
  }, [apparentCutSegments, captureFormat, customOutDir, enableTransferTimestamps, filePath, getFrameCount, hideAllNotifications, outputDir, setWorking]);

  const extractCurrentSegmentFramesAsImages = useCallback(() => extractSegmentFramesAsImages(currentSegIndexSafe), [currentSegIndexSafe, extractSegmentFramesAsImages]);

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

  const segmentAtCursor = useMemo(() => {
    const segmentsAtCursorIndexes = findSegmentsAtCursor(apparentCutSegments, commandedTime);
    const firstSegmentAtCursorIndex = segmentsAtCursorIndexes[0];

    return cutSegments[firstSegmentAtCursorIndex];
  }, [apparentCutSegments, commandedTime, cutSegments]);

  const splitCurrentSegment = useCallback(() => {
    const currentTime = getCurrentTime();
    const segmentsAtCursorIndexes = findSegmentsAtCursor(apparentCutSegments, currentTime);

    if (segmentsAtCursorIndexes.length === 0) {
      errorToast(i18n.t('No segment to split. Please move cursor over the segment you want to split'));
      return;
    }

    const firstSegmentAtCursorIndex = segmentsAtCursorIndexes[0];
    const segment = cutSegments[firstSegmentAtCursorIndex];

    const getNewName = (oldName, suffix) => oldName && `${segment.name} ${suffix}`;

    const firstPart = createIndexedSegment({ segment: { name: getNewName(segment.name, '1'), start: segment.start, end: currentTime }, incrementCount: false });
    const secondPart = createIndexedSegment({ segment: { name: getNewName(segment.name, '2'), start: currentTime, end: segment.end }, incrementCount: true });

    const newSegments = [...cutSegments];
    newSegments.splice(firstSegmentAtCursorIndex, 1, firstPart, secondPart);
    setCutSegments(newSegments);
  }, [apparentCutSegments, createIndexedSegment, cutSegments, getCurrentTime, setCutSegments]);

  const loadCutSegments = useCallback((edl, append = false) => {
    const validEdl = edl.filter((row) => (
      (row.start === undefined || row.end === undefined || row.start < row.end)
      && (row.start === undefined || row.start >= 0)
      // TODO: Cannot do this because duration is not yet set when loading a file
      // && (row.start === undefined || (row.start >= 0 && row.start < duration))
      // && (row.end === undefined || row.end < duration)
    ));

    if (validEdl.length === 0) throw new Error(i18n.t('No valid segments found'));

    if (!append) {
      clearSegCounter();
    }
    setCutSegments((existingSegments) => {
      const needToAppend = append && existingSegments.length > 1;
      const newSegments = validEdl.map((segment, i) => createIndexedSegment({ segment, incrementCount: needToAppend || i > 0 }));
      if (needToAppend) return [...existingSegments, ...newSegments];
      return newSegments;
    });
  }, [clearSegCounter, createIndexedSegment, setCutSegments]);

  const loadEdlFile = useCallback(async ({ path, type, append }) => {
    console.log('Loading EDL file', type, path, append);
    loadCutSegments(await readEdlFile({ type, path }), append);
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

    async function tryOpenProjectPath(path, type) {
      if (!(await exists(path))) return false;
      await loadEdlFile({ path, type });
      return true;
    }

    async function tryOpenProject({ chapters }) {
      try {
        if (projectPath) {
          await loadEdlFile({ path: projectPath, type: 'llc' });
          return;
        }

        // First try to open from source file dir, then from working dir, then finally old csv style project
        if (await tryOpenProjectPath(getEdlFilePath(fp, true), 'llc')) return;
        if (await tryOpenProjectPath(getEdlFilePath(fp, false), 'llc')) return;
        if (await tryOpenProjectPath(getEdlFilePathOld(fp), 'csv')) return;

        const edl = await tryMapChaptersToEdl(chapters);
        if (edl.length > 0 && enableAskForImportChapters && (await askForImportChapters())) {
          console.log('Convert chapters to segments', edl);
          loadCutSegments(edl);
        }
      } catch (err) {
        console.error('EDL load failed, but continuing', err);
        errorToast(`${i18n.t('Failed to load segments')} (${err.message})`);
      }
    }


    try {
      const fileMeta = await readFileMeta(fp);
      // console.log('file meta read', fileMeta);

      const fileFormatNew = await getSmarterOutFormat({ filePath: fp, fileMeta });

      // console.log(streams, fileMeta.format, fileFormat);

      if (!fileFormatNew) throw new Error('Unable to determine file format');

      const timecode = autoLoadTimecode ? getTimecodeFromStreams(fileMeta.streams) : undefined;

      const videoStreams = getRealVideoStreams(fileMeta.streams);
      const audioStreams = getAudioStreams(fileMeta.streams);

      const videoStream = videoStreams[0];
      const audioStream = audioStreams[0];

      const haveVideoStream = !!videoStream;
      const haveAudioStream = !!audioStream;

      const copyStreamIdsForPathNew = fromPairs(fileMeta.streams.map((stream) => [
        stream.index, shouldCopyStreamByDefault(stream),
      ]));

      if (timecode) setStartTimeOffset(timecode);

      setDetectedFps(haveVideoStream ? getStreamFps(videoStream) : undefined);

      if (isAudioDefinitelyNotSupported(fileMeta.streams)) {
        toast.fire({ icon: 'info', text: i18n.t('The audio track is not supported. You can convert to a supported format from the menu') });
      }

      const validDuration = isDurationValid(parseFloat(fileMeta.format.duration));
      const hasLoadedExistingHtml5FriendlyFile = await checkAndSetExistingHtml5FriendlyFile();

      // 'fastest' works with almost all video files
      if (!hasLoadedExistingHtml5FriendlyFile && !doesPlayerSupportFile(fileMeta.streams) && validDuration) {
        await html5ifyAndLoadWithPreferences(cod, fp, 'fastest', haveVideoStream, haveAudioStream);
      }

      await tryOpenProject({ chapters: fileMeta.chapters });

      // throw new Error('test');

      if (!validDuration) toast.fire({ icon: 'warning', timer: 10000, text: i18n.t('This file does not have a valid duration. This may cause issues. You can try to fix the file\'s duration from the File menu') });

      batchedUpdates(() => {
        setMainFileMeta({ streams: fileMeta.streams, formatData: fileMeta.format, chapters: fileMeta.chapters });
        setMainVideoStream(videoStream);
        setMainAudioStream(audioStream);
        setCopyStreamIdsForPath(fp, () => copyStreamIdsForPathNew);
        setFileNameTitle(fp);
        setFileFormat(outFormatLocked || fileFormatNew);
        setDetectedFileFormat(fileFormatNew);

        // This needs to be last, because it triggers <video> to load the video
        // If not, onVideoError might be triggered before setWorking() has been cleared.
        // https://github.com/mifi/lossless-cut/issues/515
        setFilePath(fp);
      });
    } catch (err) {
      resetState();
      throw err;
    }
  }, [resetState, setWorking, showPreviewFileLoadedMessage, autoLoadTimecode, html5ifyAndLoadWithPreferences, getEdlFilePath, getEdlFilePathOld, loadEdlFile, enableAskForImportChapters, loadCutSegments, setCopyStreamIdsForPath, setFileFormat, outFormatLocked, setDetectedFileFormat]);

  const toggleHelp = useCallback(() => setHelpVisible(val => !val), []);
  const toggleSettings = useCallback(() => setSettingsVisible(val => !val), []);

  const jumpSeg = useCallback((val) => setCurrentSegIndex((old) => Math.max(Math.min(old + val, cutSegments.length - 1), 0)), [cutSegments.length]);

  const seekClosestKeyframe = useCallback((direction) => {
    const time = findNearestKeyFrameTime({ time: getCurrentTime(), direction });
    if (time == null) return;
    seekAbs(time);
  }, [findNearestKeyFrameTime, getCurrentTime, seekAbs]);

  const seekAccelerationRef = useRef(1);

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

    const pathReadAccessErrorCode = await getPathReadAccessError(path);
    if (pathReadAccessErrorCode != null) {
      let errorMessage;
      if (pathReadAccessErrorCode === 'ENOENT') errorMessage = i18n.t('The media you tried to open does not exist');
      else if (['EACCES', 'EPERM'].includes(pathReadAccessErrorCode)) errorMessage = i18n.t('You do not have permission to access this file');
      else errorMessage = i18n.t('Could not open media due to error {{errorCode}}', { errorCode: pathReadAccessErrorCode });
      errorToast(errorMessage);
      return;
    }

    // Not sure why this one is needed, but I think sometimes fs.access doesn't fail but it fails when actually trying to read
    if (!(await havePermissionToReadFile(path))) {
      errorToast(i18n.t('You do not have permission to access this file'));
      return;
    }

    // checkInputDir: true because we may be be writing project file here (if storeProjectInWorkingDir is true)
    const { newCustomOutDir, cancel } = await ensureAccessibleDirectories({ inputPath: path, checkInputDir: !storeProjectInWorkingDir });
    if (cancel) return;

    await loadMedia({ filePath: path, customOutDir: newCustomOutDir, projectPath });
  }, [ensureAccessibleDirectories, loadMedia, storeProjectInWorkingDir]);

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

  const batchFileJump = useCallback((direction) => {
    if (batchFiles.length === 0) return;
    if (selectedBatchFiles.length === 0) {
      setSelectedBatchFiles([batchFiles[0].path]);
      return;
    }
    const selectedFilePath = selectedBatchFiles[direction > 0 ? selectedBatchFiles.length - 1 : 0];
    const pathIndex = batchFiles.findIndex(({ path }) => path === selectedFilePath);
    if (pathIndex === -1) return;
    const nextFile = batchFiles[pathIndex + direction];
    if (!nextFile) return;
    setSelectedBatchFiles([nextFile.path]);
  }, [batchFiles, selectedBatchFiles]);

  const batchOpenSelectedFile = useCallback(() => {
    if (selectedBatchFiles.length === 0) return;
    batchOpenSingleFile(selectedBatchFiles[0]);
  }, [batchOpenSingleFile, selectedBatchFiles]);

  const onBatchFileSelect = useCallback((path) => {
    if (selectedBatchFiles.includes(path)) batchOpenSingleFile(path);
    else setSelectedBatchFiles([path]);
  }, [batchOpenSingleFile, selectedBatchFiles]);

  const goToTimecode = useCallback(async () => {
    if (!filePath) return;
    const timeCode = await promptTimeOffset({
      initialValue: formatDuration({ seconds: commandedTimeRef.current }),
      title: i18n.t('Seek to timecode'),
    });

    if (timeCode === undefined) return;

    seekAbs(timeCode);
  }, [filePath, seekAbs]);

  const toggleStreamsSelector = useCallback(() => setStreamsSelectorShown((v) => !v), []);

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

  const checkFileOpened = useCallback(() => {
    if (isFileOpened) return true;
    toast.fire({ icon: 'info', title: i18n.t('You need to open a media file first') });
    return false;
  }, [isFileOpened]);

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

  const askSetStartTimeOffset = useCallback(async () => {
    const newStartTimeOffset = await promptTimeOffset({
      initialValue: startTimeOffset !== undefined ? formatDuration({ seconds: startTimeOffset }) : undefined,
      title: i18n.t('Set custom start time offset'),
      text: i18n.t('Instead of video apparently starting at 0, you can offset by a specified value. This only applies to the preview inside LosslessCut and does not modify the file in any way. (Useful for viewing/cutting videos according to timecodes)'),
    });

    if (newStartTimeOffset === undefined) return;

    setStartTimeOffset(newStartTimeOffset);
  }, [startTimeOffset]);

  const toggleKeyboardShortcuts = useCallback(() => setKeyboardShortcutsVisible((v) => !v), []);

  const tryFixInvalidDuration = useCallback(async () => {
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
  }, [checkFileOpened, customOutDir, fileFormat, fixInvalidDuration, loadMedia, setWorking]);

  const onKeyPress = useCallback(({ action, keyup }) => {
    function seekReset() {
      seekAccelerationRef.current = 1;
    }

    // NOTE: Do not change these keys because users have bound keys by these names
    // For actions, see also KeyboardShortcuts.jsx
    const mainActions = {
      togglePlayNoResetSpeed: () => togglePlay(),
      togglePlayResetSpeed: () => togglePlay(true),
      play: () => play(),
      pause,
      reducePlaybackRate: () => changePlaybackRate(-1),
      reducePlaybackRateMore: () => changePlaybackRate(-1, 2.0),
      increasePlaybackRate: () => changePlaybackRate(1),
      increasePlaybackRateMore: () => changePlaybackRate(1, 2.0),
      timelineToggleComfortZoom,
      captureSnapshot,
      setCutStart,
      setCutEnd,
      cleanupFilesDialog,
      splitCurrentSegment,
      increaseRotation,
      goToTimecode,
      seekBackwards() {
        if (keyup) {
          seekReset();
          return;
        }
        seekRel(keyboardNormalSeekSpeed * seekAccelerationRef.current * -1);
        seekAccelerationRef.current *= keyboardSeekAccFactor;
      },
      seekForwards() {
        if (keyup) {
          seekReset();
          return;
        }
        seekRel(keyboardNormalSeekSpeed * seekAccelerationRef.current);
        seekAccelerationRef.current *= keyboardSeekAccFactor;
      },
      seekBackwardsPercent: () => { seekRelPercent(-0.01); return false; },
      seekForwardsPercent: () => { seekRelPercent(0.01); return false; },
      seekBackwardsKeyframe: () => seekClosestKeyframe(-1),
      seekForwardsKeyframe: () => seekClosestKeyframe(1),
      seekPreviousFrame: () => shortStep(-1),
      seekNextFrame: () => shortStep(1),
      jumpPrevSegment: () => jumpSeg(-1),
      jumpNextSegment: () => jumpSeg(1),
      jumpCutStart,
      jumpCutEnd,
      jumpTimelineStart,
      jumpTimelineEnd,
      timelineZoomIn: () => { zoomRel(1); return false; },
      timelineZoomOut: () => { zoomRel(-1); return false; },
      batchPreviousFile: () => batchFileJump(-1),
      batchNextFile: () => batchFileJump(1),
      batchOpenSelectedFile,
      closeBatch,
      removeCurrentSegment: () => removeCutSegment(currentSegIndexSafe),
      undo: () => cutSegmentsHistory.back(),
      redo: () => cutSegmentsHistory.forward(),
      labelCurrentSegment: () => { onLabelSegment(currentSegIndexSafe); return false; },
      addSegment,
      toggleHelp: () => { toggleHelp(); return false; },
      export: onExportPress,
      extractCurrentSegmentFramesAsImages,
      reorderSegsByStartTime,
      invertAllSegments,
      fillSegmentsGaps,
      createFixedDurationSegments,
      createNumSegments,
      shuffleSegments,
      clearSegments,
      toggleSegmentsList,
      toggleStreamsSelector,
      extractAllStreams,
      convertFormatCurrentFile: userHtml5ifyCurrentFile,
      convertFormatBatch,
      concatBatch: concatCurrentBatch,
      toggleKeyframeCutMode: () => toggleKeyframeCut(true),
      toggleCaptureFormat,
      toggleStripAudio,
      setStartTimeOffset: askSetStartTimeOffset,
      deselectAllSegments,
      selectAllSegments,
      selectOnlyCurrentSegment,
      toggleCurrentSegmentSelected,
      removeSelectedSegments,
      fixInvalidDuration: tryFixInvalidDuration,
      increaseVolume: () => setPlaybackVolume((val) => Math.min(1, val + 0.07)),
      decreaseVolume: () => setPlaybackVolume((val) => Math.max(0, val - 0.07)),
    };

    function tryMainActions() {
      const fn = mainActions[action];
      if (!fn) return { match: false };
      const bubble = fn();
      return { match: true, bubble };
    }

    if (isDev) console.log('key event', action);

    // always allow
    if (action === 'closeActiveScreen') {
      closeExportConfirm();
      setHelpVisible(false);
      setSettingsVisible(false);
      return false;
    }

    if (action === 'toggleKeyboardShortcuts') {
      toggleKeyboardShortcuts();
      return false;
    }

    if (concatDialogVisible || keyboardShortcutsVisible) {
      return true; // don't allow any further hotkeys
    }

    if (exportConfirmVisible) {
      if (action === 'export') {
        onExportConfirm();
        return false;
      }
      return true; // don't allow any other hotkeys because we are at export confirm
    }

    // allow main actions
    const { match, bubble } = tryMainActions();
    if (match) return bubble;

    return true; // bubble the event
  }, [addSegment, askSetStartTimeOffset, batchFileJump, batchOpenSelectedFile, captureSnapshot, changePlaybackRate, cleanupFilesDialog, clearSegments, closeBatch, closeExportConfirm, concatCurrentBatch, concatDialogVisible, convertFormatBatch, createFixedDurationSegments, createNumSegments, currentSegIndexSafe, cutSegmentsHistory, deselectAllSegments, exportConfirmVisible, extractAllStreams, extractCurrentSegmentFramesAsImages, fillSegmentsGaps, goToTimecode, increaseRotation, invertAllSegments, jumpCutEnd, jumpCutStart, jumpSeg, jumpTimelineEnd, jumpTimelineStart, keyboardNormalSeekSpeed, keyboardSeekAccFactor, keyboardShortcutsVisible, onExportConfirm, onExportPress, onLabelSegment, pause, play, removeCutSegment, removeSelectedSegments, reorderSegsByStartTime, seekClosestKeyframe, seekRel, seekRelPercent, selectAllSegments, selectOnlyCurrentSegment, setCutEnd, setCutStart, setPlaybackVolume, shortStep, shuffleSegments, splitCurrentSegment, timelineToggleComfortZoom, toggleCaptureFormat, toggleCurrentSegmentSelected, toggleHelp, toggleKeyboardShortcuts, toggleKeyframeCut, togglePlay, toggleSegmentsList, toggleStreamsSelector, toggleStripAudio, tryFixInvalidDuration, userHtml5ifyCurrentFile, zoomRel]);

  useKeyboard({ keyBindings, onKeyPress });

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

  const addStreamSourceFile = useCallback(async (path) => {
    if (allFilesMeta[path]) return;
    const fileMeta = await readFileMeta(path);
    // console.log('streams', fileMeta.streams);
    setExternalFilesMeta((old) => ({ ...old, [path]: { streams: fileMeta.streams, formatData: fileMeta.format, chapters: fileMeta.chapters } }));
    setCopyStreamIdsForPath(path, () => fromPairs(fileMeta.streams.map(({ index }) => [index, true])));
  }, [allFilesMeta, setCopyStreamIdsForPath]);

  const batchFilePaths = useMemo(() => batchFiles.map((f) => f.path), [batchFiles]);

  const batchLoadPaths = useCallback((newPaths, append) => {
    setBatchFiles((existingFiles) => {
      const mapPathsToFiles = (paths) => paths.map((path) => ({ path, name: basename(path) }));
      if (append) {
        const newUniquePaths = newPaths.filter((newPath) => !existingFiles.some(({ path: existingPath }) => newPath === existingPath));
        setSelectedBatchFiles([newUniquePaths[0]]);
        return [...existingFiles, ...mapPathsToFiles(newUniquePaths)];
      }
      setSelectedBatchFiles([newPaths[0]]);
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

      // Import segments for for already opened file
      const edlFormats = { csv: 'csv', pbf: 'pbf', edl: 'mplayer', cue: 'cue', xml: 'xmeml' };
      const matchingExt = Object.keys(edlFormats).find((ext) => filePathLowerCase.endsWith(`.${ext}`));
      if (matchingExt) {
        if (!checkFileOpened()) return;
        await loadEdlFile({ path: firstFilePath, type: edlFormats[matchingExt], append: true });
        return;
      }

      const isLlcProject = filePathLowerCase.endsWith('.llc');

      // Need to ask the user what to do if more than one option
      const inputOptions = {
        open: isFileOpened ? i18n.t('Open the file instead of the current one') : i18n.t('Open the file'),
      };
      if (isFileOpened) {
        if (isLlcProject) inputOptions.project = i18n.t('Load segments from the new file, but keep the current media');
        else inputOptions.tracks = i18n.t('Include all tracks from the new file');
      }
      if (batchFiles.length > 0) inputOptions.addToBatch = i18n.t('Add the file to the batch list');

      if (Object.keys(inputOptions).length > 1) {
        const openFileResponse = enableAskForFileOpenAction ? await askForFileOpenAction(inputOptions) : 'open';

        if (openFileResponse === 'open') {
          await userOpenSingleFile({ path: firstFilePath, isLlcProject });
          return;
        }
        if (openFileResponse === 'project') {
          await loadEdlFile({ path: firstFilePath, type: 'llc' });
          return;
        }
        if (openFileResponse === 'tracks') {
          await addStreamSourceFile(firstFilePath);
          setStreamsSelectorShown(true);
          return;
        }
        if (openFileResponse === 'addToBatch') {
          batchLoadPaths([firstFilePath], true);
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
  }, [alwaysConcatMultipleFiles, batchLoadPaths, setWorking, batchFiles.length, isFileOpened, userOpenSingleFile, checkFileOpened, loadEdlFile, enableAskForFileOpenAction, addStreamSourceFile]);

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
        const edl = await askForEdlImport({ type, fps: detectedFps });
        if (edl.length > 0) loadCutSegments(edl, true);
      } catch (err) {
        handleError(err);
      }
    }

    const action = {
      openFiles: (event, filePaths) => { userOpenFiles(filePaths.map(resolvePathIfNeeded)); },
      closeCurrentFile: () => { closeFileWithConfirm(); },
      closeBatchFiles: () => { closeBatch(); },
      html5ify: userHtml5ifyCurrentFile,
      askSetStartTimeOffset,
      extractAllStreams,
      showStreamsSelector: () => setStreamsSelectorShown(true),
      importEdlFile,
      exportEdlFile: exportEdlFile2,
      exportEdlYouTube,
      toggleHelp,
      toggleSettings,
      openAbout,
      openSendReportDialog: () => { openSendReportDialogWithState(); },
      clearSegments,
      shuffleSegments,
      createNumSegments,
      createFixedDurationSegments,
      invertAllSegments,
      fillSegmentsGaps,
      fixInvalidDuration: tryFixInvalidDuration,
      reorderSegsByStartTime,
      concatCurrentBatch,
      shiftAllSegmentTimes,
    };

    const entries = Object.entries(action);
    entries.forEach(([key, value]) => electron.ipcRenderer.on(key, value));
    return () => entries.forEach(([key, value]) => electron.ipcRenderer.removeListener(key, value));
  }, [apparentCutSegments, askSetStartTimeOffset, checkFileOpened, clearSegments, closeBatch, closeFileWithConfirm, concatCurrentBatch, createFixedDurationSegments, createNumSegments, customOutDir, cutSegments, detectedFps, extractAllStreams, fileFormat, filePath, fillSegmentsGaps, getFrameCount, invertAllSegments, loadCutSegments, loadMedia, openSendReportDialogWithState, reorderSegsByStartTime, setWorking, shiftAllSegmentTimes, shuffleSegments, toggleHelp, toggleSettings, tryFixInvalidDuration, userHtml5ifyCurrentFile, userOpenFiles]);

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

  const renderOutFmt = useCallback((style) => (
    <OutputFormatSelect style={style} detectedFileFormat={detectedFileFormat} fileFormat={fileFormat} onOutputFormatUserChange={onOutputFormatUserChange} />
  ), [detectedFileFormat, fileFormat, onOutputFormatUserChange]);

  const onTunerRequested = useCallback((type) => {
    setSettingsVisible(false);
    setTunerVisible(type);
  }, []);

  const onKeyboardShortcutsDialogRequested = useCallback(() => setKeyboardShortcutsVisible(true), []);

  useEffect(() => {
    if (!isStoreBuild) loadMifiLink().then(setMifiLink);
  }, []);

  const haveCustomFfPath = !!customFfPath;
  useEffect(() => {
    if (!haveCustomFfPath) runStartupCheck().catch((err) => handleError('LosslessCut is installation is broken', err));
  }, [haveCustomFfPath]);

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

  const showLeftBar = batchFiles.length > 0;

  const thumbnailsSorted = useMemo(() => sortBy(thumbnails, thumbnail => thumbnail.time), [thumbnails]);

  let timelineMode;
  if (thumbnailsEnabled) timelineMode = 'thumbnails';
  if (waveformEnabled) timelineMode = 'waveform';

  const { t } = useTranslation();

  function renderSubtitles() {
    if (!activeSubtitle) return null;
    return <track default kind="subtitles" label={activeSubtitle.lang} srcLang="en" src={activeSubtitle.url} />;
  }

  // throw new Error('Test error boundary');

  return (
    <UserSettingsContext.Provider value={userSettingsContext}>
      <ThemeProvider value={theme}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
          <TopMenu
            filePath={filePath}
            fileFormat={fileFormat}
            copyAnyAudioTrack={copyAnyAudioTrack}
            toggleStripAudio={toggleStripAudio}
            clearOutDir={clearOutDir}
            isCustomFormatSelected={isCustomFormatSelected}
            renderOutFmt={renderOutFmt}
            toggleHelp={toggleHelp}
            toggleSettings={toggleSettings}
            numStreamsToCopy={numStreamsToCopy}
            numStreamsTotal={numStreamsTotal}
            setStreamsSelectorShown={setStreamsSelectorShown}
            selectedSegments={selectedSegments}
          />

          <div style={{ flexGrow: 1, display: 'flex', overflowY: 'hidden' }}>
            <AnimatePresence>
              {showLeftBar && (
                <BatchFilesList
                  selectedBatchFiles={selectedBatchFiles}
                  filePath={filePath}
                  width={leftBarWidth}
                  batchFiles={batchFiles}
                  setBatchFiles={setBatchFiles}
                  onBatchFileSelect={onBatchFileSelect}
                  batchRemoveFile={batchRemoveFile}
                  closeBatch={closeBatch}
                  onMergeFilesClick={concatCurrentBatch}
                  onBatchConvertToSupportedFormatClick={convertFormatBatch}
                />
              )}
            </AnimatePresence>

            {/* Middle part: */}
            <div style={{ position: 'relative', flexGrow: 1, overflow: 'hidden' }}>
              {!isFileOpened && <NoFileLoaded mifiLink={mifiLink} toggleHelp={toggleHelp} currentCutSeg={currentCutSeg} />}

              <div className="no-user-select" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, visibility: !isFileOpened ? 'hidden' : undefined }} onWheel={onTimelineWheel}>
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
                <div style={{ position: 'absolute', top: 0, right: 0, left: 0, marginTop: '1em', marginLeft: '1em', color: 'white', display: 'flex', alignItems: 'center' }}>
                  <MdRotate90DegreesCcw size={26} style={{ marginRight: 5 }} />
                  {t('Rotation preview')}
                  {!canvasPlayerRequired && <FaWindowClose role="button" style={{ cursor: 'pointer', verticalAlign: 'middle', padding: 10 }} onClick={() => setHideCanvasPreview(true)} />}
                </div>
              )}

              {isFileOpened && (
                <div className="no-user-select" style={{ position: 'absolute', right: 0, bottom: 0, marginBottom: 10, color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center' }}>
                  <VolumeControl playbackVolume={playbackVolume} setPlaybackVolume={setPlaybackVolume} usingDummyVideo={usingDummyVideo} />

                  {subtitleStreams.length > 0 && <SubtitleControl subtitleStreams={subtitleStreams} activeSubtitleStreamIndex={activeSubtitleStreamIndex} onActiveSubtitleChange={onActiveSubtitleChange} />}

                  {!showRightBar && (
                    <FaAngleLeft
                      title={t('Show sidebar')}
                      size={30}
                      role="button"
                      style={{ marginRight: 10 }}
                      onClick={toggleSegmentsList}
                    />
                  )}
                </div>
              )}

              <AnimatePresence>
                {working && <Loading text={working} cutProgress={cutProgress} />}
              </AnimatePresence>

              {tunerVisible && <ValueTuners type={tunerVisible} onFinished={() => setTunerVisible()} />}
            </div>

            <AnimatePresence>
              {showRightBar && isFileOpened && (
                <SegmentList
                  width={rightBarWidth}
                  currentSegIndex={currentSegIndexSafe}
                  apparentCutSegments={apparentCutSegments}
                  inverseCutSegments={inverseCutSegments}
                  getFrameCount={getFrameCount}
                  formatTimecode={formatTimecode}
                  onSegClick={setCurrentSegIndex}
                  updateSegOrder={updateSegOrder}
                  updateSegOrders={updateSegOrders}
                  onLabelSegment={onLabelSegment}
                  currentCutSeg={currentCutSeg}
                  segmentAtCursor={segmentAtCursor}
                  addSegment={addSegment}
                  removeCutSegment={removeCutSegment}
                  onRemoveSelected={removeSelectedSegments}
                  toggleSegmentsList={toggleSegmentsList}
                  splitCurrentSegment={splitCurrentSegment}
                  selectedSegmentsRaw={selectedSegmentsRaw}
                  selectedSegments={selectedSegments}
                  onSelectSingleSegment={selectOnlySegment}
                  onToggleSegmentSelected={toggleSegmentSelected}
                  onDeselectAllSegments={deselectAllSegments}
                  onSelectAllSegments={selectAllSegments}
                  onExtractSegmentFramesAsImages={extractSegmentFramesAsImages}
                  jumpSegStart={jumpSegStart}
                  jumpSegEnd={jumpSegEnd}
                  onViewSegmentTags={onViewSegmentTags}
                  onSelectSegmentsByLabel={onSelectSegmentsByLabel}
                  onLabelSelectedSegments={onLabelSelectedSegments}
                />
              )}
            </AnimatePresence>
          </div>

          <motion.div className="no-user-select" style={bottomMotionStyle}>
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
              inverseCutSegments={inverseCutSegments}
              formatTimecode={formatTimecode}
              onZoomWindowStartTimeChange={setZoomWindowStartTime}
              playing={playing}
              isFileOpened={isFileOpened}
              onWheel={onTimelineWheel}
              goToTimecode={goToTimecode}
            />

            <BottomBar
              zoom={zoom}
              setZoom={setZoom}
              timelineToggleComfortZoom={timelineToggleComfortZoom}
              hasVideo={hasVideo}
              isRotationSet={isRotationSet}
              rotation={rotation}
              areWeCutting={areWeCutting}
              increaseRotation={increaseRotation}
              cleanupFilesDialog={cleanupFilesDialog}
              captureSnapshot={captureSnapshot}
              onExportPress={onExportPress}
              selectedSegments={selectedSegments}
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
              jumpCutEnd={jumpCutEnd}
              jumpCutStart={jumpCutStart}
              jumpTimelineStart={jumpTimelineStart}
              jumpTimelineEnd={jumpTimelineEnd}
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
              keyframesEnabled={keyframesEnabled}
              toggleKeyframesEnabled={toggleKeyframesEnabled}
              detectedFps={detectedFps}
            />
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
              mainFileFormatData={mainFileFormatData}
              mainFileChapters={mainFileChapters}
              allFilesMeta={allFilesMeta}
              externalFilesMeta={externalFilesMeta}
              setExternalFilesMeta={setExternalFilesMeta}
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
              customTagsByFile={customTagsByFile}
              setCustomTagsByFile={setCustomTagsByFile}
              customTagsByStreamId={customTagsByStreamId}
              setCustomTagsByStreamId={setCustomTagsByStreamId}
              dispositionByStreamId={dispositionByStreamId}
              setDispositionByStreamId={setDispositionByStreamId}
            />
          </SideSheet>

          <ExportConfirm filePath={filePath} areWeCutting={areWeCutting} nonFilteredSegments={nonFilteredSegments} selectedSegments={selectedSegments} willMerge={willMerge} visible={exportConfirmVisible} onClosePress={closeExportConfirm} onExportConfirm={onExportConfirm} renderOutFmt={renderOutFmt} outputDir={outputDir} numStreamsTotal={numStreamsTotal} numStreamsToCopy={numStreamsToCopy} setStreamsSelectorShown={setStreamsSelectorShown} outFormat={fileFormat} setOutSegTemplate={setOutSegTemplate} outSegTemplate={outSegTemplateOrDefault} generateOutSegFileNames={generateOutSegFileNames} currentSegIndexSafe={currentSegIndexSafe} getOutSegError={getOutSegError} />

          <HelpSheet
            visible={helpVisible}
            onTogglePress={toggleHelp}
            ffmpegCommandLog={ffmpegCommandLog}
            onKeyboardShortcutsDialogRequested={onKeyboardShortcutsDialogRequested}
          />

          <Sheet visible={settingsVisible} onClosePress={toggleSettings} style={{ background: 'white', color: 'black' }}>
            <Table style={{ marginTop: 40 }}>
              <Table.Head>
                <Table.TextHeaderCell>{t('Settings')}</Table.TextHeaderCell>
                <Table.TextHeaderCell>{t('Current setting')}</Table.TextHeaderCell>
              </Table.Head>
              <Table.Body>
                <Settings
                  onTunerRequested={onTunerRequested}
                  onKeyboardShortcutsDialogRequested={onKeyboardShortcutsDialogRequested}
                />
              </Table.Body>
            </Table>
          </Sheet>

          <ConcatDialog isShown={batchFiles.length > 0 && concatDialogVisible} onHide={() => setConcatDialogVisible(false)} initialPaths={batchFilePaths} onConcat={userConcatFiles} setAlwaysConcatMultipleFiles={setAlwaysConcatMultipleFiles} alwaysConcatMultipleFiles={alwaysConcatMultipleFiles} />

          <KeyboardShortcuts isShown={keyboardShortcutsVisible} onHide={() => setKeyboardShortcutsVisible(false)} keyBindings={keyBindings} setKeyBindings={setKeyBindings} currentCutSeg={currentCutSeg} resetKeyBindings={resetKeyBindings} />
        </div>
      </ThemeProvider>
    </UserSettingsContext.Provider>
  );
});

export default App;
