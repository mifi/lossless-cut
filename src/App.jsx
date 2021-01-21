import React, { memo, useEffect, useState, useCallback, useRef, Fragment, useMemo } from 'react';
import { FaVolumeMute, FaVolumeUp, FaAngleLeft, FaWindowClose } from 'react-icons/fa';
import { AnimatePresence, motion } from 'framer-motion';
import Swal from 'sweetalert2';
import Lottie from 'react-lottie';
import { SideSheet, Button, Position, SegmentedControl, Select } from 'evergreen-ui';
import { useStateWithHistory } from 'react-use/lib/useStateWithHistory';
import useDebounceOld from 'react-use/lib/useDebounce'; // Want to phase out this
import { useDebounce } from 'use-debounce';
import filePathToUrl from 'file-url';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';
import withReactContent from 'sweetalert2-react-content';
import Mousetrap from 'mousetrap';

import fromPairs from 'lodash/fromPairs';
import clamp from 'lodash/clamp';
import sortBy from 'lodash/sortBy';
import flatMap from 'lodash/flatMap';
import isEqual from 'lodash/isEqual';

import useTimelineScroll from './hooks/useTimelineScroll';
import NoFileLoaded from './NoFileLoaded';
import Canvas from './Canvas';
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
import ExportConfirm from './ExportConfirm';
import { loadMifiLink } from './mifi';
import { primaryColor, controlsBackground, waveformColor } from './colors';
import { showMergeDialog, showOpenAndMergeDialog } from './merge/merge';
import allOutFormats from './outFormats';
import { captureFrameFromTag, captureFrameFfmpeg } from './capture-frame';
import {
  defaultProcessedCodecTypes, getStreamFps, isCuttingStart, isCuttingEnd,
  getDefaultOutFormat, getFormatData, mergeFiles as ffmpegMergeFiles, renderThumbnails as ffmpegRenderThumbnails,
  readFrames, renderWaveformPng, html5ifyDummy, cutMultiple, extractStreams, autoMergeSegments, getAllStreams,
  findNearestKeyFrameTime as ffmpegFindNearestKeyFrameTime, html5ify as ffmpegHtml5ify, isStreamThumbnail, isAudioSupported, isIphoneHevc, tryReadChaptersToEdl,
  fixInvalidDuration, getDuration, getTimecodeFromStreams, createChaptersFromSegments,
} from './ffmpeg';
import { saveCsv, saveTsv, loadCsv, loadXmeml, loadCue, loadPbf, saveCsvHuman } from './edlStore';
import {
  getOutPath, formatDuration, toast, errorToast, showFfmpegFail, setFileNameTitle, getOutDir, withBlur,
  checkDirWriteAccess, dirExists, openDirToast, isMasBuild, isStoreBuild, dragPreventer, doesPlayerSupportFile,
  isDurationValid, isWindows,
} from './util';
import { askForOutDir, askForImportChapters, createNumSegments, createFixedDurationSegments, promptTimeOffset, askForHtml5ifySpeed, askForYouTubeInput, askForFileOpenAction, confirmExtractAllStreamsDialog, cleanupFilesDialog, showDiskFull } from './dialogs';
import { openSendReportDialog } from './reporting';
import { fallbackLng } from './i18n';
import { createSegment, createInitialCutSegments, getCleanCutSegments, getSegApparentStart, findSegmentsAtCursor } from './segments';


import loadingLottie from './7077-magic-flow.json';


const isDev = window.require('electron-is-dev');
const electron = window.require('electron'); // eslint-disable-line
const trash = window.require('trash');
const { unlink, exists } = window.require('fs-extra');
const { extname, parse: parsePath } = window.require('path');

const { dialog, app } = electron.remote;

const configStore = electron.remote.require('./configStore');
const { focusWindow } = electron.remote.require('./electron');

const ReactSwal = withReactContent(Swal);


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
  const [waveform, setWaveform] = useState();
  const [html5FriendlyPath, setHtml5FriendlyPath] = useState();
  const [working, setWorking] = useState();
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
  const [filePath, setFilePath] = useState('');
  const [externalStreamFiles, setExternalStreamFiles] = useState([]);
  const [customTagsByFile, setCustomTagsByFile] = useState({});
  const [customTagsByStreamId, setCustomTagsByStreamId] = useState({});
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
  const [hideCanvasPreview, setHideCanvasPreview] = useState(false);

  // Segment related state
  const [currentSegIndex, setCurrentSegIndex] = useState(0);
  const [cutStartTimeManual, setCutStartTimeManual] = useState();
  const [cutEndTimeManual, setCutEndTimeManual] = useState();
  const [cutSegments, setCutSegments, cutSegmentsHistory] = useStateWithHistory(
    createInitialCutSegments(),
    100,
  );


  const durationSafe = isDurationValid(duration) ? duration : 1;
  const zoomedDuration = isDurationValid(duration) ? duration / zoom : undefined;

  const isCustomFormatSelected = fileFormat !== detectedFileFormat;

  const firstUpdateRef = useRef(true);

  function safeSetConfig(key, value) {
    // Prevent flood-saving all config when mounting
    if (firstUpdateRef.current) return;

    // console.log(key);
    try {
      configStore.set(key, value);
    } catch (err) {
      console.error('Failed to set config', key, err);
      errorToast(i18n.t('Unable to save your preferences. Try to disable any anti-virus'));
    }
  }

  // Preferences
  const [captureFormat, setCaptureFormat] = useState(configStore.get('captureFormat'));
  useEffect(() => safeSetConfig('captureFormat', captureFormat), [captureFormat]);
  const [customOutDir, setCustomOutDir] = useState(configStore.get('customOutDir'));
  useEffect(() => safeSetConfig('customOutDir', customOutDir), [customOutDir]);
  const [keyframeCut, setKeyframeCut] = useState(configStore.get('keyframeCut'));
  useEffect(() => safeSetConfig('keyframeCut', keyframeCut), [keyframeCut]);
  const [preserveMovData, setPreserveMovData] = useState(configStore.get('preserveMovData'));
  useEffect(() => safeSetConfig('preserveMovData', preserveMovData), [preserveMovData]);
  const [movFastStart, setMovFastStart] = useState(configStore.get('movFastStart'));
  useEffect(() => safeSetConfig('movFastStart', movFastStart), [movFastStart]);
  const [avoidNegativeTs, setAvoidNegativeTs] = useState(configStore.get('avoidNegativeTs'));
  useEffect(() => safeSetConfig('avoidNegativeTs', avoidNegativeTs), [avoidNegativeTs]);
  const [autoMerge, setAutoMerge] = useState(configStore.get('autoMerge'));
  useEffect(() => safeSetConfig('autoMerge', autoMerge), [autoMerge]);
  const [timecodeShowFrames, setTimecodeShowFrames] = useState(configStore.get('timecodeShowFrames'));
  useEffect(() => safeSetConfig('timecodeShowFrames', timecodeShowFrames), [timecodeShowFrames]);
  const [invertCutSegments, setInvertCutSegments] = useState(configStore.get('invertCutSegments'));
  useEffect(() => safeSetConfig('invertCutSegments', invertCutSegments), [invertCutSegments]);
  const [autoExportExtraStreams, setAutoExportExtraStreams] = useState(configStore.get('autoExportExtraStreams'));
  useEffect(() => safeSetConfig('autoExportExtraStreams', autoExportExtraStreams), [autoExportExtraStreams]);
  const [askBeforeClose, setAskBeforeClose] = useState(configStore.get('askBeforeClose'));
  useEffect(() => safeSetConfig('askBeforeClose', askBeforeClose), [askBeforeClose]);
  const [enableAskForImportChapters, setEnableAskForImportChapters] = useState(configStore.get('enableAskForImportChapters'));
  useEffect(() => safeSetConfig('enableAskForImportChapters', enableAskForImportChapters), [enableAskForImportChapters]);
  const [enableAskForFileOpenAction, setEnableAskForFileOpenAction] = useState(configStore.get('enableAskForFileOpenAction'));
  useEffect(() => safeSetConfig('enableAskForFileOpenAction', enableAskForFileOpenAction), [enableAskForFileOpenAction]);
  const [muted, setMuted] = useState(configStore.get('muted'));
  useEffect(() => safeSetConfig('muted', muted), [muted]);
  const [autoSaveProjectFile, setAutoSaveProjectFile] = useState(configStore.get('autoSaveProjectFile'));
  useEffect(() => safeSetConfig('autoSaveProjectFile', autoSaveProjectFile), [autoSaveProjectFile]);
  const [wheelSensitivity, setWheelSensitivity] = useState(configStore.get('wheelSensitivity'));
  useEffect(() => safeSetConfig('wheelSensitivity', wheelSensitivity), [wheelSensitivity]);
  const [invertTimelineScroll, setInvertTimelineScroll] = useState(configStore.get('invertTimelineScroll'));
  useEffect(() => safeSetConfig('invertTimelineScroll', invertTimelineScroll), [invertTimelineScroll]);
  const [language, setLanguage] = useState(configStore.get('language'));
  useEffect(() => safeSetConfig('language', language), [language]);
  const [ffmpegExperimental, setFfmpegExperimental] = useState(configStore.get('ffmpegExperimental'));
  useEffect(() => safeSetConfig('ffmpegExperimental', ffmpegExperimental), [ffmpegExperimental]);
  const [hideNotifications, setHideNotifications] = useState(configStore.get('hideNotifications'));
  useEffect(() => safeSetConfig('hideNotifications', hideNotifications), [hideNotifications]);
  const [autoLoadTimecode, setAutoLoadTimecode] = useState(configStore.get('autoLoadTimecode'));
  useEffect(() => safeSetConfig('autoLoadTimecode', autoLoadTimecode), [autoLoadTimecode]);
  const [autoDeleteMergedSegments, setAutoDeleteMergedSegments] = useState(configStore.get('autoDeleteMergedSegments'));
  useEffect(() => safeSetConfig('autoDeleteMergedSegments', autoDeleteMergedSegments), [autoDeleteMergedSegments]);
  const [exportConfirmEnabled, setExportConfirmEnabled] = useState(configStore.get('exportConfirmEnabled'));
  useEffect(() => safeSetConfig('exportConfirmEnabled', exportConfirmEnabled), [exportConfirmEnabled]);
  const [segmentsToChapters, setSegmentsToChapters] = useState(configStore.get('segmentsToChapters'));
  useEffect(() => safeSetConfig('segmentsToChapters', segmentsToChapters), [segmentsToChapters]);
  const [preserveMetadataOnMerge, setPreserveMetadataOnMerge] = useState(configStore.get('preserveMetadataOnMerge'));
  useEffect(() => safeSetConfig('preserveMetadataOnMerge', preserveMetadataOnMerge), [preserveMetadataOnMerge]);
  const [simpleMode, setSimpleMode] = useState(configStore.get('simpleMode'));
  useEffect(() => safeSetConfig('simpleMode', simpleMode), [simpleMode]);

  useEffect(() => {
    i18n.changeLanguage(language || fallbackLng).catch(console.error);
  }, [language]);

  // This useEffect must be placed after all usages of firstUpdateRef.current
  useEffect(() => {
    firstUpdateRef.current = false;
  }, []);

  // Global state
  const [helpVisible, setHelpVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [wheelTunerVisible, setWheelTunerVisible] = useState(false);
  const [exportConfirmVisible, setExportConfirmVisible] = useState(false);
  const [mifiLink, setMifiLink] = useState();

  const videoRef = useRef();
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

  const toggleExportConfirmEnabled = useCallback(() => setExportConfirmEnabled((v) => !v), []);

  const toggleSegmentsToChapters = useCallback(() => setSegmentsToChapters((v) => !v), []);

  const togglePreserveMetadataOnMerge = useCallback(() => setPreserveMetadataOnMerge((v) => !v), []);

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

  const hideAllNotifications = hideNotifications === 'all';

  const toggleMute = useCallback(() => {
    setMuted((v) => {
      if (!v && !hideAllNotifications) toast.fire({ icon: 'info', title: i18n.t('Muted preview (exported file will not be affected)') });
      return !v;
    });
  }, [hideAllNotifications]);

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
    if (!isDurationValid(zoomedDuration)) return;
    seekRel(val * zoomedDuration);
  }, [seekRel, zoomedDuration]);

  const shortStep = useCallback((dir) => {
    seekRel((1 / (detectedFps || 60)) * dir);
  }, [seekRel, detectedFps]);

  /* useEffect(() => () => {
    if (dummyVideoPath) unlink(dummyVideoPath).catch(console.error);
  }, [dummyVideoPath]); */

  // 360 means we don't modify rotation
  const isRotationSet = rotation !== 360;
  const effectiveRotation = isRotationSet ? rotation : (mainVideoStream && mainVideoStream.tags && mainVideoStream.tags.rotate && parseInt(mainVideoStream.tags.rotate, 10));

  const zoomRel = useCallback((rel) => setZoom(z => Math.min(Math.max(z + rel, 1), zoomMax)), []);
  const canvasPlayerRequired = !!(mainVideoStream && dummyVideoPath);
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
    if (!isDurationValid(duration)) return undefined;

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

  const updateSegAtIndex = useCallback((index, newProps) => {
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

  const setCurrentSegmentName = useCallback((name) => {
    updateSegAtIndex(currentSegIndexSafe, { name });
  }, [currentSegIndexSafe, updateSegAtIndex]);

  const updateCurrentSegOrder = useCallback((newOrder) => {
    if (newOrder > cutSegments.length - 1 || newOrder < 0) return;
    const newSegments = [...cutSegments];
    const removedSeg = newSegments.splice(currentSegIndexSafe, 1)[0];
    newSegments.splice(newOrder, 0, removedSeg);
    setCutSegments(newSegments);
    setCurrentSegIndex(newOrder);
  }, [currentSegIndexSafe, cutSegments, setCutSegments]);

  const reorderSegsByStartTime = useCallback(() => {
    setCutSegments(sortBy(cutSegments, getSegApparentStart));
  }, [cutSegments, setCutSegments]);

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
        errorToast(err.message);
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
      errorToast(err.message);
    }
  }, [setCutTime, filePath]);

  const outputDir = getOutDir(customOutDir, filePath);

  const changeOutDir = useCallback(async () => {
    const newOutDir = await askForOutDir(outputDir);
    // We cannot allow exporting to a directory which has not yet been confirmed by an open dialog
    // because of sandox restrictions
    if (isMasBuild && !newOutDir) return;
    // Else it's OK, we allow clearing the dir too
    setCustomOutDir(newOutDir);
  }, [outputDir]);

  const effectiveFilePath = dummyVideoPath || html5FriendlyPath || filePath;
  const fileUri = effectiveFilePath ? filePathToUrl(effectiveFilePath) : '';

  const getEdlFilePath = useCallback((fp) => getOutPath(customOutDir, fp, 'llc-edl.csv'), [customOutDir]);
  const edlFilePath = getEdlFilePath(filePath);

  const currentSaveOperation = useMemo(() => {
    if (!edlFilePath) return undefined;
    return { cutSegments, edlFilePath };
  }, [cutSegments, edlFilePath]);

  const [debouncedSaveOperation] = useDebounce(currentSaveOperation, isDev ? 2000 : 500);

  const lastSaveOperation = useRef();
  useEffect(() => {
    async function save() {
      // NOTE: Could lose a save if user closes too fast, but not a big issue I think
      if (!autoSaveProjectFile || !debouncedSaveOperation) return;

      const { cutSegments: saveOperationCutSegments, edlFilePath: saveOperationEdlFilePath } = debouncedSaveOperation;

      try {
        // Initial state? Don't save
        if (isEqual(getCleanCutSegments(saveOperationCutSegments), getCleanCutSegments(createInitialCutSegments()))) return;

        if (lastSaveOperation.current && lastSaveOperation.current.edlFilePath === saveOperationEdlFilePath && isEqual(getCleanCutSegments(lastSaveOperation.current.cutSegments), getCleanCutSegments(saveOperationCutSegments))) {
          console.log('Segments unchanged, skipping save');
          return;
        }

        await saveCsv(saveOperationEdlFilePath, saveOperationCutSegments);
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
  }, []);

  const assureOutDirAccess = useCallback(async (outFilePath) => {
    // Reset if doesn't exist anymore
    const customOutDirExists = await dirExists(customOutDir);
    if (!customOutDirExists) setCustomOutDir(undefined);
    const newCustomOutDir = customOutDirExists ? customOutDir : undefined;

    const outDirPath = getOutDir(newCustomOutDir, outFilePath);
    const hasDirWriteAccess = await checkDirWriteAccess(outDirPath);
    if (!hasDirWriteAccess) {
      if (isMasBuild) {
        const newOutDir = await askForOutDir(outDirPath);
        // User cancelled open dialog. Refuse to continue, because we will get permission denied error from MAS sandbox
        if (!newOutDir) return { cancel: true };
        setCustomOutDir(newOutDir);
      } else {
        errorToast(i18n.t('You have no write access to the directory of this file, please select a custom working dir'));
      }
    }

    return { cancel: false, newCustomOutDir };
  }, [customOutDir]);

  const mergeFiles = useCallback(async ({ paths, allStreams, segmentsToChapters: segmentsToChapters2 }) => {
    try {
      setWorking(i18n.t('Merging'));

      const firstPath = paths[0];
      const { newCustomOutDir, cancel } = await assureOutDirAccess(firstPath);
      if (cancel) return;

      const ext = extname(firstPath);
      const outPath = getOutPath(newCustomOutDir, firstPath, `merged${ext}`);
      const outDir = getOutDir(customOutDir, firstPath);

      let chapters;
      if (segmentsToChapters2) {
        const chapterNames = paths.map((path) => parsePath(path).name);
        chapters = await createChaptersFromSegments({ segmentPaths: paths, chapterNames });
      }

      // console.log('merge', paths);
      await ffmpegMergeFiles({ paths, outPath, outDir, allStreams, ffmpegExperimental, onProgress: setCutProgress, preserveMovData, movFastStart, preserveMetadataOnMerge, chapters });
      openDirToast({ icon: 'success', dirPath: outDir, text: i18n.t('Files merged!') });
    } catch (err) {
      errorToast(i18n.t('Failed to merge files. Make sure they are all of the exact same codecs'));
      console.error('Failed to merge files', err);
    } finally {
      setWorking();
      setCutProgress();
    }
  }, [assureOutDirAccess, ffmpegExperimental, preserveMovData, movFastStart, preserveMetadataOnMerge, customOutDir]);

  const toggleCaptureFormat = useCallback(() => setCaptureFormat(f => (f === 'png' ? 'jpeg' : 'png')), []);

  const toggleKeyframeCut = useCallback((showMessage) => setKeyframeCut((val) => {
    const newVal = !val;
    if (showMessage && !hideAllNotifications) {
      if (newVal) toast.fire({ title: i18n.t('Keyframe cut enabled'), text: i18n.t('Will now cut at the nearest keyframe before the desired start cutpoint. This is recommended for most files.') });
      else toast.fire({ title: i18n.t('Keyframe cut disabled'), text: i18n.t('Will now cut at the exact position, but may leave an empty portion at the beginning of the file. You may have to set the cutpoint a few frames before the next keyframe to achieve a precise cut'), timer: 7000 });
    }
    return newVal;
  }), [hideAllNotifications]);

  const toggleAutoMerge = useCallback(() => setAutoMerge(val => !val), []);

  const togglePreserveMovData = useCallback(() => setPreserveMovData((val) => !val), []);

  const toggleMovFastStart = useCallback(() => setMovFastStart((val) => !val), []);

  const toggleSimpleMode = useCallback(() => setSimpleMode((v) => {
    if (!hideAllNotifications) toast.fire({ text: v ? i18n.t('Advanced view has been enabled. You will now also see non-essential buttons and functions') : i18n.t('Advanced view disabled. You will now see only the most essential buttons and functions') });
    return !v;
  }), [hideAllNotifications]);

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
  }, [copyAnyAudioTrack, filePath, mainStreams]);

  const removeCutSegment = useCallback(() => {
    if (cutSegments.length === 1 && cutSegments[0].start == null && cutSegments[0].end == null) return; // Initial segment

    if (cutSegments.length <= 1) {
      setCutSegments(createInitialCutSegments());
      return;
    }

    const cutSegmentsNew = [...cutSegments];
    cutSegmentsNew.splice(currentSegIndexSafe, 1);

    setCutSegments(cutSegmentsNew);
  }, [currentSegIndexSafe, cutSegments, setCutSegments]);

  const clearSegments = useCallback(() => {
    setCutSegments(createInitialCutSegments());
  }, [setCutSegments]);

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

  const [, cancelReadKeyframeDataDebounce] = useDebounceOld(() => {
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

  const [, cancelWaveformDataDebounce] = useDebounceOld(() => {
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
    setHtml5FriendlyPath();
    setDummyVideoPath();
    setWorking();
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
    setFilePath(''); // Setting video src="" prevents memory leak in chromium
    setExternalStreamFiles([]);
    setCustomTagsByFile({});
    setCustomTagsByStreamId({});
    setDetectedFps();
    setMainStreams([]);
    setMainVideoStream();
    setMainAudioStream();
    setCopyStreamIdsByFile({});
    setStreamsSelectorShown(false);
    setZoom(1);
    setShortestFlag(false);
    setZoomWindowStartTime(0);
    setHideCanvasPreview(false);

    setExportConfirmVisible(false);

    setWaveform();
    cancelWaveformDataDebounce();

    setNeighbouringFrames([]);
    cancelReadKeyframeDataDebounce();

    setThumbnails([]);
    cancelRenderThumbnails();
  }, [cutSegmentsHistory, setCutSegments, cancelWaveformDataDebounce, cancelReadKeyframeDataDebounce, cancelRenderThumbnails]);


  // Cleanup old
  useEffect(() => () => waveform && URL.revokeObjectURL(waveform.url), [waveform]);

  const showUnsupportedFileMessage = useCallback(() => {
    if (!hideAllNotifications) toast.fire({ timer: 13000, text: i18n.t('File not natively supported. Preview may have no audio or low quality. The final export will however be lossless with audio. You may convert it from the menu for a better preview with audio.') });
  }, [hideAllNotifications]);

  const createDummyVideo = useCallback(async (cod, fp) => {
    const html5ifiedDummyPathDummy = getOutPath(cod, fp, 'html5ified-dummy.mkv');
    try {
      setCutProgress(0);
      await html5ifyDummy(fp, html5ifiedDummyPathDummy, setCutProgress);
    } finally {
      setCutProgress();
    }
    setDummyVideoPath(html5ifiedDummyPathDummy);
    setHtml5FriendlyPath();
    showUnsupportedFileMessage();
  }, [showUnsupportedFileMessage]);

  const showPlaybackFailedMessage = () => errorToast(i18n.t('Unable to playback this file. Try to convert to supported format from the menu'));

  const tryCreateDummyVideo = useCallback(async () => {
    try {
      if (working) return;
      setWorking(i18n.t('Converting to supported format'));
      await createDummyVideo(customOutDir, filePath);
    } catch (err) {
      console.error(err);
      showPlaybackFailedMessage();
    } finally {
      setWorking();
    }
  }, [createDummyVideo, filePath, working, customOutDir]);

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

  const closeFile = useCallback(() => {
    if (!isFileOpened || working) return false;
    // eslint-disable-next-line no-alert
    if (askBeforeClose && !window.confirm(i18n.t('Are you sure you want to close the current file?'))) return false;

    resetState();
    return true;
  }, [askBeforeClose, isFileOpened, resetState, working]);

  const cleanupFiles = useCallback(async () => {
    // Because we will reset state before deleting files
    const saved = { html5FriendlyPath, dummyVideoPath, filePath, edlFilePath };

    if (!closeFile()) return;

    const trashResponse = await cleanupFilesDialog();
    console.log('trashResponse', trashResponse);
    if (!trashResponse) return;

    const deleteTmpFiles = ['all', 'projectAndTmpFiles', 'tmpFiles'].includes(trashResponse);
    const deleteProjectFile = ['all', 'projectAndTmpFiles'].includes(trashResponse);
    const deleteOriginal = ['all'].includes(trashResponse);

    try {
      setWorking(i18n.t('Cleaning up'));

      if (deleteTmpFiles && saved.html5FriendlyPath) await trash(saved.html5FriendlyPath).catch(console.error);
      if (deleteTmpFiles && saved.dummyVideoPath) await trash(saved.dummyVideoPath).catch(console.error);
      if (deleteProjectFile && saved.edlFilePath) await trash(saved.edlFilePath).catch(console.error);

      // throw new Error('test');
      if (deleteOriginal) await trash(saved.filePath);
      toast.fire({ icon: 'info', title: i18n.t('Cleanup successful') });
    } catch (err) {
      try {
        console.warn('Failed to trash', err);

        const { value } = await Swal.fire({
          icon: 'warning',
          text: i18n.t('Unable to move file to trash. Do you want to permanently delete it?'),
          confirmButtonText: i18n.t('Permanently delete'),
          showCancelButton: true,
        });

        if (value) {
          if (deleteTmpFiles && saved.html5FriendlyPath) await unlink(saved.html5FriendlyPath).catch(console.error);
          if (deleteTmpFiles && saved.dummyVideoPath) await unlink(saved.dummyVideoPath).catch(console.error);
          if (deleteProjectFile && saved.edlFilePath) await unlink(saved.edlFilePath).catch(console.error);
          if (deleteOriginal) await unlink(saved.filePath);
          toast.fire({ icon: 'info', title: i18n.t('Cleanup successful') });
        }
      } catch (err2) {
        errorToast(`Unable to delete file: ${err2.message}`);
        console.error(err2);
      }
    } finally {
      setWorking();
    }
  }, [filePath, html5FriendlyPath, dummyVideoPath, closeFile, edlFilePath]);

  const outSegments = useMemo(() => (invertCutSegments ? inverseCutSegments : apparentCutSegments),
    [invertCutSegments, inverseCutSegments, apparentCutSegments]);

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
    const html = (
      <div style={{ textAlign: 'left' }}>
        Try one of the following before exporting again:
        <ol>
          {detectedFileFormat === 'mp4' && <li>Change output <b>Format</b> from <b>MP4</b> to <b>MOV</b></li>}
          <li>Select a different output <b>Format</b> (<b>matroska</b> and <b>mp4</b> support most codecs)</li>
          <li>Disable unnecessary <b>Tracks</b></li>
          <li>Try both <b>Normal cut</b> and <b>Keyframe cut</b></li>
          <li>Set a different <b>Working directory</b></li>
          <li>Try with a <b>Different file</b></li>
          <li>See <b>Help</b></li>
          <li>If nothing helps, you can send an <b>Error report</b></li>
        </ol>
      </div>
    );

    const { value } = await ReactSwal.fire({ title: i18n.t('Unable to export this file'), html, timer: null, showConfirmButton: true, showCancelButton: true, cancelButtonText: i18n.t('OK'), confirmButtonText: i18n.t('Report'), reverseButtons: true, focusCancel: true });

    if (value) {
      openSendReportDialogWithState(err);
    }
  }, [openSendReportDialogWithState, detectedFileFormat]);

  const closeExportConfirm = useCallback(() => setExportConfirmVisible(false), []);

  const onExportConfirm = useCallback(async ({ exportSingle } = {}) => {
    if (working) return;

    if (numStreamsToCopy === 0) {
      errorToast(i18n.t('No tracks selected for export'));
      return;
    }

    setStreamsSelectorShown(false);
    setExportConfirmVisible(false);

    const outSegmentsWithOrder = outSegments.map((s, order) => ({ ...s, order }));
    const filteredOutSegments = exportSingle ? [outSegmentsWithOrder[currentSegIndexSafe]] : outSegmentsWithOrder;

    try {
      setWorking(i18n.t('Exporting'));

      // throw (() => { const err = new Error('test'); err.code = 'ENOENT'; return err; })();
      const outFiles = await cutMultiple({
        customOutDir,
        filePath,
        outFormat: fileFormat,
        isCustomFormatSelected,
        videoDuration: duration,
        rotation: isRotationSet ? effectiveRotation : undefined,
        copyFileStreams,
        keyframeCut,
        invertCutSegments,
        segments: filteredOutSegments,
        onProgress: setCutProgress,
        appendFfmpegCommandLog,
        shortestFlag,
        ffmpegExperimental,
        preserveMovData,
        movFastStart,
        avoidNegativeTs,
        customTagsByFile,
        customTagsByStreamId,
      });

      if (outFiles.length > 1 && autoMerge) {
        setCutProgress(0);
        setWorking(i18n.t('Merging'));

        const chapterNames = segmentsToChapters && !invertCutSegments && outSegments ? outSegments.map((s) => s.name) : undefined;

        await autoMergeSegments({
          customOutDir,
          sourceFile: filePath,
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

      if (exportExtraStreams && !exportSingle) {
        try {
          await extractStreams({ filePath, customOutDir, streams: nonCopiedExtraStreams });
        } catch (err) {
          console.error('Extra stream export failed', err);
        }
      }

      // https://github.com/mifi/lossless-cut/issues/329
      const extraIphoneMsg = isIphoneHevc(fileFormatData, mainStreams) ? ` ${i18n.t('There is a known issue with cutting iPhone HEVC videos. The output file may not work in all players.')}` : '';
      const extraStreamsMsg = exportExtraStreams ? ` ${i18n.t('Unprocessable streams were exported as separate files.')}` : '';

      if (!hideAllNotifications) openDirToast({ dirPath: outputDir, text: `${i18n.t('Done! Note: cutpoints may be inaccurate. Make sure you test the output files in your desired player/editor before you delete the source. If output does not look right, see the HELP page.')}${extraIphoneMsg}${extraStreamsMsg}`, timer: 15000 });
    } catch (err) {
      console.error('stdout:', err.stdout);
      console.error('stderr:', err.stderr);

      if (err.exitCode === 1 || err.code === 'ENOENT') {
        // A bit hacky but it works, unless someone has a file called "No space left on device" ( ͡° ͜ʖ ͡°)
        if (typeof err.stderr === 'string' && err.stderr.includes('No space left on device')) {
          showDiskFull();
          return;
        }
        handleCutFailed(err);
        return;
      }

      showFfmpegFail(err);
    } finally {
      setWorking();
      setCutProgress();
    }
  }, [autoMerge, copyFileStreams, customOutDir, duration, effectiveRotation, exportExtraStreams, ffmpegExperimental, fileFormat, fileFormatData, filePath, handleCutFailed, isCustomFormatSelected, isRotationSet, keyframeCut, mainStreams, nonCopiedExtraStreams, outSegments, outputDir, shortestFlag, working, preserveMovData, movFastStart, avoidNegativeTs, numStreamsToCopy, hideAllNotifications, currentSegIndexSafe, invertCutSegments, autoDeleteMergedSegments, segmentsToChapters, customTagsByFile, customTagsByStreamId, preserveMetadataOnMerge]);

  const onExportPress = useCallback(async () => {
    if (working || !filePath) return;

    if (haveInvalidSegs) {
      errorToast(i18n.t('Start time must be before end time'));
      return;
    }

    if (!outSegments || outSegments.length < 1) {
      errorToast(i18n.t('No segments to export'));
      return;
    }

    if (exportConfirmEnabled) setExportConfirmVisible(true);
    else await onExportConfirm();
  }, [working, filePath, haveInvalidSegs, outSegments, exportConfirmEnabled, onExportConfirm]);

  const capture = useCallback(async () => {
    if (!filePath || !isDurationValid(duration)) return;

    try {
      const mustCaptureFfmpeg = html5FriendlyPath || dummyVideoPath;
      const currentTime = currentTimeRef.current;
      const video = videoRef.current;
      const outPath = mustCaptureFfmpeg
        ? await captureFrameFfmpeg({ customOutDir, filePath, currentTime, captureFormat, duration })
        : await captureFrameFromTag({ customOutDir, filePath, currentTime, captureFormat, duration, video });

      openDirToast({ dirPath: outputDir, text: `${i18n.t('Screenshot captured to:')} ${outPath}` });
    } catch (err) {
      console.error(err);
      errorToast(i18n.t('Failed to capture frame'));
    }
  }, [filePath, captureFormat, customOutDir, html5FriendlyPath, dummyVideoPath, outputDir, duration]);

  const changePlaybackRate = useCallback((dir) => {
    if (canvasPlayerEnabled) {
      toast.fire({ title: i18n.t('Unable to change playback rate right now'), timer: 1000 });
      return;
    }

    const video = videoRef.current;
    if (!playing) {
      video.play();
    } else {
      const newRate = clamp(video.playbackRate + (dir * 0.15), 0.1, 16);
      toast.fire({ title: `${i18n.t('Playback rate:')} ${Math.floor(newRate * 100)}%`, timer: 1000 });
      video.playbackRate = newRate;
    }
  }, [playing, canvasPlayerEnabled]);

  const getHtml5ifiedPath = useCallback((cod, fp, type) => {
    const ext = type === 'fastest-audio' ? 'mkv' : 'mp4';
    return getOutPath(cod, fp, `html5ified-${type}.${ext}`);
  }, []);

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

    const firstPart = createSegment({ name: getNewName(segmentAtCursor2.name, '1'), start: segmentAtCursor2.start, end: currentTimeRef.current });
    const secondPart = createSegment({ name: getNewName(segmentAtCursor2.name, '2'), start: currentTimeRef.current, end: segmentAtCursor2.end });

    const newSegments = [...cutSegments];
    newSegments.splice(firstSegmentAtCursorIndex, 1, firstPart, secondPart);
    setCutSegments(newSegments);
  }, [cutSegments, firstSegmentAtCursorIndex, setCutSegments]);

  const loadCutSegments = useCallback((edl) => {
    const validEdl = edl.filter((row) => (
      (row.start === undefined || row.end === undefined || row.start < row.end)
      && (row.start === undefined || row.start >= 0)
    ));

    if (validEdl.length === 0) throw new Error(i18n.t('No valid segments found'));

    setCutSegments(validEdl.map(createSegment));
  }, [setCutSegments]);

  const loadEdlFile = useCallback(async (path, type = 'csv') => {
    try {
      let edl;
      if (type === 'csv') edl = await loadCsv(path);
      else if (type === 'xmeml') edl = await loadXmeml(path);
      else if (type === 'cue') edl = await loadCue(path);
      else if (type === 'pbf') edl = await loadPbf(path);

      loadCutSegments(edl);
    } catch (err) {
      console.error('EDL load failed', err);
      errorToast(`${i18n.t('Failed to load segments')} (${err.message})`);
    }
  }, [loadCutSegments]);

  const load = useCallback(async ({ filePath: fp, customOutDir: cod, html5FriendlyPathRequested, dummyVideoPathRequested }) => {
    console.log('Load', { fp, cod, html5FriendlyPathRequested, dummyVideoPathRequested });

    if (working) return;

    resetState();

    setWorking(i18n.t('Loading file'));

    async function checkAndSetExistingHtml5FriendlyFile(speed) {
      const existing = getHtml5ifiedPath(cod, fp, speed);
      const ret = existing && await exists(existing);
      if (ret) {
        console.log('Found existing supported file', existing);
        if (speed === 'fastest-audio') {
          setDummyVideoPath(existing);
          setHtml5FriendlyPath();
        } else {
          setHtml5FriendlyPath(existing);
        }

        showUnsupportedFileMessage();
      }
      return ret;
    }

    try {
      const fd = await getFormatData(fp);

      const ff = await getDefaultOutFormat(fp, fd);
      if (!ff) {
        errorToast(i18n.t('Unable to determine file format'));
        return;
      }

      const { streams } = await getAllStreams(fp);
      // console.log('streams', streamsNew);

      if (autoLoadTimecode) {
        const timecode = getTimecodeFromStreams(streams);
        if (timecode) setStartTimeOffset(timecode);
      }

      const videoStream = streams.find(stream => stream.codec_type === 'video' && !isStreamThumbnail(stream));
      const audioStream = streams.find(stream => stream.codec_type === 'audio');
      setMainVideoStream(videoStream);
      setMainAudioStream(audioStream);
      if (videoStream) {
        const streamFps = getStreamFps(videoStream);
        if (streamFps != null) setDetectedFps(streamFps);
      }

      const shouldDefaultCopyStream = (stream) => {
        if (!defaultProcessedCodecTypes.includes(stream.codec_type)) return false;
        // Don't enable thumbnail stream by default if we have a main video stream
        // It's been known to cause issues: https://github.com/mifi/lossless-cut/issues/308
        if (isStreamThumbnail(stream) && videoStream) return false;
        return true;
      };

      setMainStreams(streams);
      setCopyStreamIdsForPath(fp, () => fromPairs(streams.map((stream) => [
        stream.index, shouldDefaultCopyStream(stream),
      ])));

      setFileNameTitle(fp);
      setFileFormat(ff);
      setDetectedFileFormat(ff);
      setFileFormatData(fd);

      if (!isAudioSupported(streams)) {
        toast.fire({ icon: 'info', text: i18n.t('The audio track is not supported. You can convert to a supported format from the menu') });
      }

      const validDuration = isDurationValid(parseFloat(fd.duration));

      if (html5FriendlyPathRequested) {
        setHtml5FriendlyPath(html5FriendlyPathRequested);
        showUnsupportedFileMessage();
      } else if (dummyVideoPathRequested) {
        setDummyVideoPath(dummyVideoPathRequested);
        setHtml5FriendlyPath();
        showUnsupportedFileMessage();
      } else if (
        !(await checkAndSetExistingHtml5FriendlyFile('slowest') || await checkAndSetExistingHtml5FriendlyFile('slow-audio') || await checkAndSetExistingHtml5FriendlyFile('slow') || await checkAndSetExistingHtml5FriendlyFile('fast-audio') || await checkAndSetExistingHtml5FriendlyFile('fast') || await checkAndSetExistingHtml5FriendlyFile('fastest-audio'))
        && !doesPlayerSupportFile(streams)
        && validDuration
      ) {
        await createDummyVideo(cod, fp);
      }

      const openedFileEdlPath = getEdlFilePath(fp);

      if (await exists(openedFileEdlPath)) {
        await loadEdlFile(openedFileEdlPath);
      } else {
        const edl = await tryReadChaptersToEdl(fp);
        if (edl.length > 0 && enableAskForImportChapters && (await askForImportChapters())) {
          console.log('Read chapters', edl);
          loadCutSegments(edl);
        }
      }

      if (!validDuration) toast.fire({ icon: 'warning', timer: 10000, text: i18n.t('This file does not have a valid duration. This may cause issues. You can try to fix the file\'s duration from the File menu') });

      // This needs to be last, because it triggers <video> to load the video
      // If not, onVideoError might be triggered before setWorking() has been cleared.
      // https://github.com/mifi/lossless-cut/issues/515
      setFilePath(fp);
    } catch (err) {
      // Windows will throw error with code ENOENT if format detection fails.
      if (err.exitCode === 1 || (isWindows && err.code === 'ENOENT')) {
        errorToast(i18n.t('Unsupported file'));
        console.error(err);
        return;
      }
      showFfmpegFail(err);
    } finally {
      setWorking();
    }
  }, [resetState, working, createDummyVideo, loadEdlFile, getEdlFilePath, getHtml5ifiedPath, loadCutSegments, enableAskForImportChapters, showUnsupportedFileMessage, autoLoadTimecode]);

  const toggleHelp = useCallback(() => setHelpVisible(val => !val), []);
  const toggleSettings = useCallback(() => setSettingsVisible(val => !val), []);

  const jumpSeg = useCallback((val) => setCurrentSegIndex((old) => Math.max(Math.min(old + val, cutSegments.length - 1), 0)), [cutSegments.length]);

  const findNearestKeyFrameTime = useCallback(({ time, direction }) => ffmpegFindNearestKeyFrameTime({ frames: neighbouringFrames, time, direction, fps: detectedFps }), [neighbouringFrames, detectedFps]);

  const seekClosestKeyframe = useCallback((direction) => {
    const time = findNearestKeyFrameTime({ time: currentTimeRef.current, direction });
    if (time == null) return;
    seekAbs(time);
  }, [findNearestKeyFrameTime, seekAbs]);

  // TODO split up?
  useEffect(() => {
    if (exportConfirmVisible) return () => {};

    const togglePlayNoReset = () => togglePlay();
    const togglePlayReset = () => togglePlay(true);
    const reducePlaybackRate = () => changePlaybackRate(-1);
    const increasePlaybackRate = () => changePlaybackRate(1);
    const seekBackwards = () => seekRel(-1);
    const seekForwards = () => seekRel(1);
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

    // mousetrap seems to be the only lib properly handling layouts that require shift to be pressed to get a particular key #520
    // Also document.addEventListener needs custom handling of modifier keys or C will be triggered by CTRL+C, etc
    const mousetrap = new Mousetrap();
    // mousetrap.bind(':', () => console.log('test'));
    mousetrap.bind('plus', () => addCutSegment());
    mousetrap.bind('space', () => togglePlayReset());
    mousetrap.bind('k', () => togglePlayNoReset());
    mousetrap.bind('j', () => reducePlaybackRate());
    mousetrap.bind('l', () => increasePlaybackRate());
    mousetrap.bind('z', () => toggleComfortZoom());
    mousetrap.bind(',', () => seekBackwardsShort());
    mousetrap.bind('.', () => seekForwardsShort());
    mousetrap.bind('c', () => capture());
    mousetrap.bind('i', () => setCutStart());
    mousetrap.bind('o', () => setCutEnd());
    mousetrap.bind('backspace', () => removeCutSegment());
    mousetrap.bind('d', () => cleanupFiles());
    mousetrap.bind('b', () => splitCurrentSegment());
    mousetrap.bind('r', () => increaseRotation());

    mousetrap.bind('left', () => seekBackwards());
    mousetrap.bind(['ctrl+left', 'command+left'], () => seekBackwardsPercent());
    mousetrap.bind('alt+left', () => seekBackwardsKeyframe());
    mousetrap.bind('shift+left', () => jumpCutStart());

    mousetrap.bind('right', () => seekForwards());
    mousetrap.bind(['ctrl+right', 'command+right'], () => seekForwardsPercent());
    mousetrap.bind('alt+right', () => seekForwardsKeyframe());
    mousetrap.bind('shift+right', () => jumpCutEnd());

    mousetrap.bind('up', () => jumpPrevSegment());
    mousetrap.bind(['ctrl+up', 'command+up'], () => zoomIn());

    mousetrap.bind('down', () => jumpNextSegment());
    mousetrap.bind(['ctrl+down', 'command+down'], () => zoomOut());

    return () => mousetrap.reset();
  }, [
    addCutSegment, capture, changePlaybackRate, togglePlay, removeCutSegment,
    setCutEnd, setCutStart, seekRel, seekRelPercent, shortStep, cleanupFiles, jumpSeg,
    seekClosestKeyframe, zoomRel, toggleComfortZoom, splitCurrentSegment, exportConfirmVisible,
    increaseRotation, jumpCutStart, jumpCutEnd,
  ]);

  useEffect(() => {
    function onKeyPress() {
      if (exportConfirmVisible) onExportConfirm();
      else onExportPress();
    }

    const mousetrap = new Mousetrap();
    mousetrap.bind('e', onKeyPress);
    return () => mousetrap.reset();
  }, [exportConfirmVisible, onExportConfirm, onExportPress]);

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

  const extractAllStreams = useCallback(async () => {
    if (!filePath) return;

    if (!(await confirmExtractAllStreamsDialog())) return;

    try {
      setStreamsSelectorShown(false);
      setWorking(i18n.t('Extracting all streams'));
      await extractStreams({ customOutDir, filePath, streams: mainStreams });
      openDirToast({ dirPath: outputDir, text: i18n.t('All streams have been extracted as separate files') });
    } catch (err) {
      errorToast(i18n.t('Failed to extract all streams'));
      console.error('Failed to extract all streams', err);
    } finally {
      setWorking();
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

    // Because Apple is being nazi about the ability to open "copy protected DVD files"
    const disallowVob = isMasBuild;
    if (disallowVob && /\.vob$/i.test(firstFile)) {
      toast.fire({ icon: 'error', text: 'Unfortunately .vob files are not supported in the App Store version of LosslessCut due to Apple restrictions' });
      return;
    }

    const { newCustomOutDir, cancel } = await assureOutDirAccess(firstFile);
    if (cancel) return;

    if (!isFileOpened) {
      load({ filePath: firstFile, customOutDir: newCustomOutDir });
      return;
    }

    const openFileResponse = enableAskForFileOpenAction ? await askForFileOpenAction() : 'open';

    if (openFileResponse === 'open') {
      load({ filePath: firstFile, customOutDir: newCustomOutDir });
    } else if (openFileResponse === 'add') {
      addStreamSourceFile(firstFile);
      setStreamsSelectorShown(true);
    }
  }, [addStreamSourceFile, isFileOpened, load, mergeFiles, assureOutDirAccess, enableAskForFileOpenAction]);

  const checkFileOpened = useCallback(() => {
    if (isFileOpened) return true;
    toast.fire({ icon: 'info', title: i18n.t('You need to open a media file first') });
    return false;
  }, [isFileOpened]);

  const onDrop = useCallback(async (ev) => {
    ev.preventDefault();
    const { files } = ev.dataTransfer;
    const filePaths = Array.from(files).map(f => f.path);

    focusWindow();

    if (filePaths.length === 1 && filePaths[0].toLowerCase().endsWith('.csv')) {
      if (!checkFileOpened()) return;
      loadEdlFile(filePaths[0]);
      return;
    }
    userOpenFiles(filePaths);
  }, [userOpenFiles, loadEdlFile, checkFileOpened]);

  const html5ifyInternal = useCallback(async ({ customOutDir: cod, filePath: fp, speed, hasAudio: ha, hasVideo: hv }) => {
    const path = getHtml5ifiedPath(cod, fp, speed);

    let audio;
    if (ha) {
      if (speed === 'slowest') audio = 'hq';
      else if (speed === 'slow-audio') audio = 'lq-aac';
      else if (speed === 'fast-audio') audio = 'copy';
      else if (speed === 'fastest-audio') audio = 'lq-flac';
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
  }, [getHtml5ifiedPath]);

  const html5ifyAndLoad = useCallback(async (speed) => {
    if (speed === 'fastest-audio') {
      const path = await html5ifyInternal({ customOutDir, filePath, speed, hasAudio, hasVideo: false });
      load({ filePath, dummyVideoPathRequested: path, customOutDir });
    } else {
      const path = await html5ifyInternal({ customOutDir, filePath, speed, hasAudio, hasVideo });
      load({ filePath, html5FriendlyPathRequested: path, customOutDir });
    }
  }, [hasAudio, hasVideo, customOutDir, filePath, html5ifyInternal, load]);

  const html5ifyCurrentFile = useCallback(async () => {
    if (!filePath) return;

    try {
      setWorking(i18n.t('Converting to supported format'));

      const speed = await askForHtml5ifySpeed(['fastest', 'fastest-audio', 'fast-audio', 'fast', 'slow', 'slow-audio', 'slowest']);
      if (!speed) return;

      if (speed === 'fastest') {
        await createDummyVideo(customOutDir, filePath);
      } else if (['fastest-audio', 'fast-audio', 'fast', 'slow', 'slow-audio', 'slowest'].includes(speed)) {
        await html5ifyAndLoad(speed);
      }
    } catch (err) {
      errorToast(i18n.t('Failed to convert file. Try a different conversion'));
      console.error('Failed to html5ify file', err);
    } finally {
      setWorking();
    }
  }, [createDummyVideo, customOutDir, filePath, html5ifyAndLoad]);

  const onVideoError = useCallback(async () => {
    const { error } = videoRef.current;
    if (!error) return;
    if (!fileUri) return; // Probably MEDIA_ELEMENT_ERROR: Empty src attribute

    console.error(error.message);

    function showToast() {
      console.log('Trying to create dummy');
      if (!hideAllNotifications) toast.fire({ icon: 'info', text: 'This file is not natively supported. Creating a preview file...' });
    }

    const MEDIA_ERR_SRC_NOT_SUPPORTED = 4;
    if (error.code === MEDIA_ERR_SRC_NOT_SUPPORTED && !dummyVideoPath) {
      console.error('MEDIA_ERR_SRC_NOT_SUPPORTED');
      if (hasVideo) {
        if (isDurationValid(await getDuration(filePath))) {
          showToast();
          await tryCreateDummyVideo();
        }
      } else if (hasAudio) {
        showToast();
        await html5ifyAndLoad('fastest-audio');
      }
    }
  }, [tryCreateDummyVideo, fileUri, dummyVideoPath, hasVideo, hasAudio, html5ifyAndLoad, hideAllNotifications, filePath]);

  useEffect(() => {
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

    async function exportEdlFile(e, type) {
      try {
        if (!checkFileOpened()) return;

        let filters;
        let ext;
        if (type === 'csv') {
          ext = 'csv';
          filters = [{ name: i18n.t('CSV files'), extensions: [ext, 'txt'] }];
        } else if (type === 'tsv-human') {
          ext = 'tsv';
          filters = [{ name: i18n.t('TXT files'), extensions: [ext, 'txt'] }];
        } else if (type === 'csv-human') {
          ext = 'csv';
          filters = [{ name: i18n.t('TXT files'), extensions: [ext, 'txt'] }];
        }

        const { canceled, filePath: fp } = await dialog.showSaveDialog({ defaultPath: `${new Date().getTime()}.${ext}`, filters });
        if (canceled || !fp) return;
        console.log('Saving', type, fp);
        if (type === 'csv') await saveCsv(fp, cutSegments);
        else if (type === 'tsv-human') await saveTsv(fp, cutSegments);
        else if (type === 'csv-human') await saveCsvHuman(fp, cutSegments);
      } catch (err) {
        errorToast(i18n.t('Failed to export project'));
        console.error('Failed to export project', type, err);
      }
    }

    async function importEdlFile(e, type) {
      if (!checkFileOpened()) return;

      if (type === 'youtube') {
        const edl = await askForYouTubeInput();
        if (edl.length > 0) loadCutSegments(edl);
        return;
      }

      let filters;
      if (type === 'csv') filters = [{ name: i18n.t('CSV files'), extensions: ['csv'] }];
      else if (type === 'xmeml') filters = [{ name: i18n.t('XML files'), extensions: ['xml'] }];
      else if (type === 'cue') filters = [{ name: i18n.t('CUE files'), extensions: ['cue'] }];
      else if (type === 'pbf') filters = [{ name: i18n.t('PBF files'), extensions: ['pbf'] }];

      const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'], filters });
      if (canceled || filePaths.length < 1) return;
      await loadEdlFile(filePaths[0], type);
    }

    function openAbout() {
      Swal.fire({
        icon: 'info',
        title: 'About LosslessCut',
        text: `You are running version ${app.getVersion()}`,
      });
    }

    async function batchConvertFriendlyFormat() {
      const title = i18n.t('Select files to batch convert to supported format');
      const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'], title, message: title });
      if (canceled || filePaths.length < 1) return;

      const failedFiles = [];
      let i = 0;

      const speed = await askForHtml5ifySpeed(['fastest-audio', 'fast-audio', 'fast', 'slow', 'slow-audio', 'slowest']);
      if (!speed) return;

      try {
        setWorking(i18n.t('Batch converting to supported format'));
        setCutProgress(0);

        // eslint-disable-next-line no-restricted-syntax
        for (const path of filePaths) {
          try {
            // eslint-disable-next-line no-await-in-loop
            const { newCustomOutDir, cancel } = await assureOutDirAccess(path);
            if (cancel) {
              toast.fire({ title: i18n.t('Aborted') });
              return;
            }

            // eslint-disable-next-line no-await-in-loop
            await html5ifyInternal({ customOutDir: newCustomOutDir, filePath: path, speed, hasAudio: true, hasVideo: true });
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
      try {
        setWorking(i18n.t('Fixing file duration'));
        const path = await fixInvalidDuration({ filePath, fileFormat, customOutDir });
        load({ filePath: path, customOutDir });
        toast.fire({ icon: 'info', text: i18n.t('Duration has been fixed') });
      } catch (err) {
        errorToast(i18n.t('Failed to fix file duration'));
        console.error('Failed to fix file duration', err);
      } finally {
        setWorking();
      }
    }

    const fileOpened = (event, filePaths) => { userOpenFiles(filePaths); };
    const undo = () => { cutSegmentsHistory.back(); };
    const redo = () => { cutSegmentsHistory.forward(); };
    const showStreamsSelector = () => setStreamsSelectorShown(true);
    const openSendReportDialog2 = () => { openSendReportDialogWithState(); };
    const closeFile2 = () => { closeFile(); };

    electron.ipcRenderer.on('file-opened', fileOpened);
    electron.ipcRenderer.on('close-file', closeFile2);
    electron.ipcRenderer.on('html5ify', html5ifyCurrentFile);
    electron.ipcRenderer.on('show-merge-dialog', showOpenAndMergeDialog2);
    electron.ipcRenderer.on('set-start-offset', setStartOffset);
    electron.ipcRenderer.on('extract-all-streams', extractAllStreams);
    electron.ipcRenderer.on('showStreamsSelector', showStreamsSelector);
    electron.ipcRenderer.on('undo', undo);
    electron.ipcRenderer.on('redo', redo);
    electron.ipcRenderer.on('importEdlFile', importEdlFile);
    electron.ipcRenderer.on('exportEdlFile', exportEdlFile);
    electron.ipcRenderer.on('openHelp', toggleHelp);
    electron.ipcRenderer.on('openSettings', toggleSettings);
    electron.ipcRenderer.on('openAbout', openAbout);
    electron.ipcRenderer.on('batchConvertFriendlyFormat', batchConvertFriendlyFormat);
    electron.ipcRenderer.on('openSendReportDialog', openSendReportDialog2);
    electron.ipcRenderer.on('clearSegments', clearSegments);
    electron.ipcRenderer.on('createNumSegments', createNumSegments2);
    electron.ipcRenderer.on('createFixedDurationSegments', createFixedDurationSegments2);
    electron.ipcRenderer.on('fixInvalidDuration', fixInvalidDuration2);
    electron.ipcRenderer.on('reorderSegsByStartTime', reorderSegsByStartTime);

    return () => {
      electron.ipcRenderer.removeListener('file-opened', fileOpened);
      electron.ipcRenderer.removeListener('close-file', closeFile2);
      electron.ipcRenderer.removeListener('html5ify', html5ifyCurrentFile);
      electron.ipcRenderer.removeListener('show-merge-dialog', showOpenAndMergeDialog2);
      electron.ipcRenderer.removeListener('set-start-offset', setStartOffset);
      electron.ipcRenderer.removeListener('extract-all-streams', extractAllStreams);
      electron.ipcRenderer.removeListener('showStreamsSelector', showStreamsSelector);
      electron.ipcRenderer.removeListener('undo', undo);
      electron.ipcRenderer.removeListener('redo', redo);
      electron.ipcRenderer.removeListener('importEdlFile', importEdlFile);
      electron.ipcRenderer.removeListener('exportEdlFile', exportEdlFile);
      electron.ipcRenderer.removeListener('openHelp', toggleHelp);
      electron.ipcRenderer.removeListener('openSettings', toggleSettings);
      electron.ipcRenderer.removeListener('openAbout', openAbout);
      electron.ipcRenderer.removeListener('batchConvertFriendlyFormat', batchConvertFriendlyFormat);
      electron.ipcRenderer.removeListener('openSendReportDialog', openSendReportDialog2);
      electron.ipcRenderer.removeListener('clearSegments', clearSegments);
      electron.ipcRenderer.removeListener('createNumSegments', createNumSegments2);
      electron.ipcRenderer.removeListener('createFixedDurationSegments', createFixedDurationSegments2);
      electron.ipcRenderer.removeListener('fixInvalidDuration', fixInvalidDuration2);
      electron.ipcRenderer.removeListener('reorderSegsByStartTime', reorderSegsByStartTime);
    };
  }, [
    mergeFiles, outputDir, filePath, customOutDir, startTimeOffset, html5ifyCurrentFile,
    createDummyVideo, extractAllStreams, userOpenFiles, cutSegmentsHistory, openSendReportDialogWithState,
    loadEdlFile, cutSegments, edlFilePath, toggleHelp, toggleSettings, assureOutDirAccess, html5ifyAndLoad, html5ifyInternal,
    loadCutSegments, duration, checkFileOpened, load, fileFormat, reorderSegsByStartTime, closeFile, clearSegments,
  ]);

  async function showAddStreamSourceDialog() {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'] });
    if (canceled || filePaths.length < 1) return;
    await addStreamSourceFile(filePaths[0]);
  }

  useEffect(() => {
    document.body.addEventListener('drop', onDrop);
    return () => document.body.removeEventListener('drop', onDrop);
  }, [onDrop]);


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
    <Select value={fileFormat || ''} title={i18n.t('Output format')} onChange={withBlur(e => setFileFormat(e.target.value))} {...props}>
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
  ), [commonFormatsMap, detectedFileFormat, fileFormat, otherFormatsMap]);

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
    <SegmentedControl
      options={[{ label: i18n.t('Extract'), value: 'extract' }, { label: i18n.t('Discard'), value: 'discard' }]}
      value={autoExportExtraStreams ? 'extract' : 'discard'}
      onChange={value => setAutoExportExtraStreams(value === 'extract')}
    />
  ), [autoExportExtraStreams]);

  const onWheelTunerRequested = useCallback(() => {
    setSettingsVisible(false);
    setWheelTunerVisible(true);
  }, []);

  const renderSettings = useCallback(() => (
    <Settings
      changeOutDir={changeOutDir}
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
      autoDeleteMergedSegments={autoDeleteMergedSegments}
      setAutoDeleteMergedSegments={setAutoDeleteMergedSegments}

      AutoExportToggler={AutoExportToggler}
      renderCaptureFormatButton={renderCaptureFormatButton}
      onWheelTunerRequested={onWheelTunerRequested}
    />
  ), [AutoExportToggler, askBeforeClose, autoMerge, autoSaveProjectFile, customOutDir, invertCutSegments, keyframeCut, renderCaptureFormatButton, timecodeShowFrames, changeOutDir, onWheelTunerRequested, language, invertTimelineScroll, ffmpegExperimental, setFfmpegExperimental, enableAskForImportChapters, setEnableAskForImportChapters, enableAskForFileOpenAction, setEnableAskForFileOpenAction, hideNotifications, setHideNotifications, autoLoadTimecode, setAutoLoadTimecode, autoDeleteMergedSegments, setAutoDeleteMergedSegments]);

  useEffect(() => {
    if (!isStoreBuild) loadMifiLink().then(setMifiLink);
  }, []);

  useEffect(() => {
    // Testing:
    // if (isDev) load({ filePath: '/Users/mifi/Downloads/inp.MOV', customOutDir });
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

  const sideBarWidth = showSideBar && isFileOpened ? 200 : 0;

  const bottomBarHeight = 96 + ((hasAudio && waveformEnabled) || (hasVideo && thumbnailsEnabled) ? timelineHeight : 0);

  const thumbnailsSorted = useMemo(() => sortBy(thumbnails, thumbnail => thumbnail.time), [thumbnails]);

  let timelineMode;
  if (thumbnailsEnabled) timelineMode = 'thumbnails';
  if (waveformEnabled) timelineMode = 'waveform';

  const { t } = useTranslation();

  // throw new Error('Test');

  return (
    <div>
      <div className="no-user-select" style={{ background: controlsBackground, height: topBarHeight, display: 'flex', alignItems: 'center', padding: '0 5px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
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
            customTagsByFile={customTagsByFile}
            setCustomTagsByFile={setCustomTagsByFile}
            customTagsByStreamId={customTagsByStreamId}
            setCustomTagsByStreamId={setCustomTagsByStreamId}
          />
        </SideSheet>

        <TopMenu
          filePath={filePath}
          height={topBarHeight}
          copyAnyAudioTrack={copyAnyAudioTrack}
          toggleStripAudio={toggleStripAudio}
          customOutDir={customOutDir}
          changeOutDir={changeOutDir}
          renderOutFmt={renderOutFmt}
          toggleHelp={toggleHelp}
          toggleSettings={toggleSettings}
          numStreamsToCopy={numStreamsToCopy}
          numStreamsTotal={numStreamsTotal}
          setStreamsSelectorShown={setStreamsSelectorShown}
        />
      </div>

      {!isFileOpened && <NoFileLoaded topBarHeight={topBarHeight} bottomBarHeight={bottomBarHeight} mifiLink={mifiLink} toggleHelp={toggleHelp} currentCutSeg={currentCutSeg} simpleMode={simpleMode} toggleSimpleMode={toggleSimpleMode} />}

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
                  options={{ loop: true, autoplay: true, animationData: loadingLottie }}
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

      <div className="no-user-select" style={{ position: 'absolute', top: topBarHeight, left: 0, right: sideBarWidth, bottom: bottomBarHeight, visibility: !isFileOpened ? 'hidden' : undefined }} onWheel={onTimelineWheel}>
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
          onError={onVideoError}
        />

        {canvasPlayerEnabled && <Canvas rotate={effectiveRotation} filePath={filePath} width={mainVideoStream.width} height={mainVideoStream.height} streamIndex={mainVideoStream.index} playerTime={playerTime} commandedTime={commandedTime} playing={playing} />}
      </div>

      {isRotationSet && !hideCanvasPreview && (
        <div style={{
          position: 'absolute', top: topBarHeight, marginTop: '1em', marginRight: '1em', right: sideBarWidth, color: 'white',
        }}
        >
          {t('Rotation preview')}
          {!canvasPlayerRequired && <FaWindowClose role="button" style={{ cursor: 'pointer', verticalAlign: 'middle', padding: 10 }} onClick={() => setHideCanvasPreview(true)} />}
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
              title={t('Mute preview? (will not affect output)')}
              size={30}
              role="button"
              style={{ margin: '0 10px 10px 10px' }}
              onClick={toggleMute}
            />

            {!showSideBar && (
              <FaAngleLeft
                title={t('Show sidebar')}
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
                  outSegments={outSegments}
                  cutSegments={apparentCutSegments}
                  getFrameCount={getFrameCount}
                  formatTimecode={formatTimecode}
                  invertCutSegments={invertCutSegments}
                  onSegClick={setCurrentSegIndex}
                  updateCurrentSegOrder={updateCurrentSegOrder}
                  setCurrentSegmentName={setCurrentSegmentName}
                  currentCutSeg={currentCutSeg}
                  segmentAtCursor={segmentAtCursor}
                  addCutSegment={addCutSegment}
                  removeCutSegment={removeCutSegment}
                  toggleSideBar={toggleSideBar}
                  splitCurrentSegment={splitCurrentSegment}
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
          <LeftMenu
            zoom={zoom}
            setZoom={setZoom}
            invertCutSegments={invertCutSegments}
            setInvertCutSegments={setInvertCutSegments}
            toggleComfortZoom={toggleComfortZoom}
            simpleMode={simpleMode}
            toggleSimpleMode={toggleSimpleMode}
          />

          <RightMenu
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
            outSegments={outSegments}
            exportConfirmEnabled={exportConfirmEnabled}
            toggleExportConfirmEnabled={toggleExportConfirmEnabled}
            simpleMode={simpleMode}
          />
        </div>
      </motion.div>

      <ExportConfirm autoMerge={autoMerge} toggleAutoMerge={toggleAutoMerge} areWeCutting={areWeCutting} outSegments={outSegments} visible={exportConfirmVisible} onClosePress={closeExportConfirm} onExportConfirm={onExportConfirm} keyframeCut={keyframeCut} toggleKeyframeCut={toggleKeyframeCut} renderOutFmt={renderOutFmt} preserveMovData={preserveMovData} togglePreserveMovData={togglePreserveMovData} movFastStart={movFastStart} toggleMovFastStart={toggleMovFastStart} avoidNegativeTs={avoidNegativeTs} setAvoidNegativeTs={setAvoidNegativeTs} changeOutDir={changeOutDir} outputDir={outputDir} numStreamsTotal={numStreamsTotal} numStreamsToCopy={numStreamsToCopy} setStreamsSelectorShown={setStreamsSelectorShown} currentSegIndex={currentSegIndexSafe} invertCutSegments={invertCutSegments} exportConfirmEnabled={exportConfirmEnabled} toggleExportConfirmEnabled={toggleExportConfirmEnabled} segmentsToChapters={segmentsToChapters} toggleSegmentsToChapters={toggleSegmentsToChapters} outFormat={fileFormat} preserveMetadataOnMerge={preserveMetadataOnMerge} togglePreserveMetadataOnMerge={togglePreserveMetadataOnMerge} />

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

      {wheelTunerVisible && (
        <div style={{ display: 'flex', alignItems: 'center', background: 'white', color: 'black', padding: 10, margin: 10, borderRadius: 10, width: '100%', maxWidth: 500, position: 'fixed', left: 0, bottom: bottomBarHeight, zIndex: 10 }}>
          {t('Timeline trackpad/wheel sensitivity')}
          <input style={{ flexGrow: 1 }} type="range" min="0" max="1000" step="1" value={wheelSensitivity * 1000} onChange={e => setWheelSensitivity(e.target.value / 1000)} />
          <Button height={20} intent="success" onClick={() => setWheelTunerVisible(false)}>{t('Done')}</Button>
        </div>
      )}
    </div>
  );
});

export default App;
