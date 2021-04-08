import React, { memo, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { FaVolumeMute, FaVolumeUp, FaAngleLeft, FaWindowClose } from 'react-icons/fa';
import { AnimatePresence, motion } from 'framer-motion';
import Swal from 'sweetalert2';
import Lottie from 'react-lottie-player';
import { SideSheet, Button, Position, SegmentedControl, Select } from 'evergreen-ui';
import { useStateWithHistory } from 'react-use/lib/useStateWithHistory';
import useDebounceOld from 'react-use/lib/useDebounce'; // Want to phase out this
import { useDebounce } from 'use-debounce';
import filePathToUrl from 'file-url';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';
import Mousetrap from 'mousetrap';

import fromPairs from 'lodash/fromPairs';
import clamp from 'lodash/clamp';
import sortBy from 'lodash/sortBy';
import flatMap from 'lodash/flatMap';
import isEqual from 'lodash/isEqual';

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
import LeftMenu from './LeftMenu';
import Timeline from './Timeline';
import RightMenu from './RightMenu';
import TimelineControls from './TimelineControls';
import ExportConfirm from './ExportConfirm';
import ValueTuner from './components/ValueTuner';
import { loadMifiLink } from './mifi';
import { primaryColor, controlsBackground } from './colors';
import allOutFormats from './outFormats';
import { captureFrameFromTag, captureFrameFfmpeg } from './capture-frame';
import {
  defaultProcessedCodecTypes, getStreamFps, isCuttingStart, isCuttingEnd,
  getDefaultOutFormat, getFormatData, renderThumbnails as ffmpegRenderThumbnails,
  extractStreams, getAllStreams,
  isStreamThumbnail, isAudioSupported, isIphoneHevc, tryReadChaptersToEdl,
  getDuration, getTimecodeFromStreams, createChaptersFromSegments,
} from './ffmpeg';
import { saveCsv, saveTsv, loadCsv, loadXmeml, loadCue, loadPbf, loadMplayerEdl, saveCsvHuman } from './edlStore';
import { formatYouTube } from './edlFormats';
import {
  getOutPath, toast, errorToast, showFfmpegFail, setFileNameTitle, getOutDir, withBlur,
  checkDirWriteAccess, dirExists, openDirToast, isMasBuild, isStoreBuild, dragPreventer, doesPlayerSupportFile,
  isDurationValid, isWindows, filenamify, getOutFileExtension, generateSegFileName, defaultOutSegTemplate,
  hasDuplicates, havePermissionToReadFile, isMac, getFileBaseName,
} from './util';
import { formatDuration } from './util/duration';
import { askForOutDir, askForImportChapters, createNumSegments, createFixedDurationSegments, promptTimeOffset, askForHtml5ifySpeed, askForYouTubeInput, askForFileOpenAction, confirmExtractAllStreamsDialog, cleanupFilesDialog, showDiskFull, showCutFailedDialog, labelSegmentDialog, openYouTubeChaptersDialog, showMergeDialog, showOpenAndMergeDialog, openAbout } from './dialogs';
import { openSendReportDialog } from './reporting';
import { fallbackLng } from './i18n';
import { createSegment, createInitialCutSegments, getCleanCutSegments, getSegApparentStart, findSegmentsAtCursor, sortSegments, invertSegments } from './segments';


import loadingLottie from './7077-magic-flow.json';


const isDev = window.require('electron-is-dev');
const electron = window.require('electron'); // eslint-disable-line
const trash = window.require('trash');
const { unlink, exists, readdir } = window.require('fs-extra');
const { extname, parse: parsePath, sep: pathSep, join: pathJoin, normalize: pathNormalize, resolve: pathResolve, isAbsolute: pathIsAbsolute, basename } = window.require('path');

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
  const [thumbnails, setThumbnails] = useState([]);
  const [shortestFlag, setShortestFlag] = useState(false);
  const [zoomWindowStartTime, setZoomWindowStartTime] = useState(0);
  const [disabledSegmentIds, setDisabledSegmentIds] = useState({});

  // State per application launch
  const [keyframesEnabled, setKeyframesEnabled] = useState(true);
  const [waveformEnabled, setWaveformEnabled] = useState(false);
  const [thumbnailsEnabled, setThumbnailsEnabled] = useState(false);
  const [showSideBar, setShowSideBar] = useState(true);
  const [hideCanvasPreview, setHideCanvasPreview] = useState(false);
  const [cleanupChoices, setCleanupChoices] = useState({ tmpFiles: true });

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

  const {
    captureFormat, setCaptureFormat, customOutDir, setCustomOutDir, keyframeCut, setKeyframeCut, preserveMovData, setPreserveMovData, movFastStart, setMovFastStart, avoidNegativeTs, setAvoidNegativeTs, autoMerge, setAutoMerge, timecodeShowFrames, setTimecodeShowFrames, invertCutSegments, setInvertCutSegments, autoExportExtraStreams, setAutoExportExtraStreams, askBeforeClose, setAskBeforeClose, enableAskForImportChapters, setEnableAskForImportChapters, enableAskForFileOpenAction, setEnableAskForFileOpenAction, muted, setMuted, autoSaveProjectFile, setAutoSaveProjectFile, wheelSensitivity, setWheelSensitivity, invertTimelineScroll, setInvertTimelineScroll, language, setLanguage, ffmpegExperimental, setFfmpegExperimental, hideNotifications, setHideNotifications, autoLoadTimecode, setAutoLoadTimecode, autoDeleteMergedSegments, setAutoDeleteMergedSegments, exportConfirmEnabled, setExportConfirmEnabled, segmentsToChapters, setSegmentsToChapters, preserveMetadataOnMerge, setPreserveMetadataOnMerge, simpleMode, setSimpleMode, outSegTemplate, setOutSegTemplate, keyboardSeekAccFactor, setKeyboardSeekAccFactor, keyboardNormalSeekSpeed, setKeyboardNormalSeekSpeed, enableTransferTimestamps, setEnableTransferTimestamps, outFormatLocked, setOutFormatLocked,
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

  // Global state
  const [helpVisible, setHelpVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [tunerVisible, setTunerVisible] = useState();
  const [exportConfirmVisible, setExportConfirmVisible] = useState(false);
  const [mifiLink, setMifiLink] = useState();

  const videoRef = useRef();
  const currentTimeRef = useRef();

  const isFileOpened = !!filePath;

  const onOutFormatLockedClick = () => setOutFormatLocked((v) => (v ? undefined : fileFormat));

  function onOutputFormatUserChange(newFormat) {
    setFileFormat(newFormat);
    if (outFormatLocked) {
      setOutFormatLocked(newFormat === detectedFileFormat ? undefined : newFormat);
    }
  }

  function setTimelineMode(newMode) {
    if (newMode === 'waveform') {
      setWaveformEnabled(v => !v);
      setThumbnailsEnabled(false);
    } else {
      setThumbnailsEnabled(v => !v);
      setWaveformEnabled(false);
    }
  }

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
  }, [hideAllNotifications, setMuted]);

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

  const jumpSegStart = useCallback((index) => seekAbs(apparentCutSegments[index].start), [apparentCutSegments, seekAbs]);
  const jumpSegEnd = useCallback((index) => seekAbs(apparentCutSegments[index].end), [apparentCutSegments, seekAbs]);
  const jumpCutStart = useCallback(() => jumpSegStart(currentSegIndexSafe), [currentSegIndexSafe, jumpSegStart]);
  const jumpCutEnd = useCallback(() => jumpSegEnd(currentSegIndexSafe), [currentSegIndexSafe, jumpSegEnd]);

  const sortedCutSegments = useMemo(() => sortSegments(apparentCutSegments), [apparentCutSegments]);

  const inverseCutSegments = useMemo(() => {
    function invertSegmentsInternal() {
      if (haveInvalidSegs || !isDurationValid(duration)) return undefined;
      if (!isDurationValid(duration)) return undefined;
      return invertSegments(sortedCutSegments, duration);
    }
    const inverted = invertSegmentsInternal() || [];
    return inverted.map((seg) => ({ ...seg, segId: `${seg.start}-${seg.end}` }));
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

  const onLabelSegmentPress = useCallback(async (index) => {
    const { name } = cutSegments[index];
    const value = await labelSegmentDialog(name);
    if (value != null) updateSegAtIndex(index, { name: value });
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
  }, [outputDir, setCustomOutDir]);

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
    // Matroska is known not to work, so we warn user. See https://github.com/mifi/lossless-cut/discussions/661
    const supportsRotation = !['matroska', 'webm'].includes(fileFormat);
    if (!supportsRotation && !hideAllNotifications) toast.fire({ text: i18n.t('Lossless rotation might not work with this file format. You may try changing to MP4') });
  }, [hideAllNotifications, fileFormat]);

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
  }, [customOutDir, setCustomOutDir]);

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
  }, [assureOutDirAccess, ffmpegExperimental, preserveMovData, movFastStart, preserveMetadataOnMerge, customOutDir, ffmpegMergeFiles]);

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

  const removeCutSegment = useCallback((index) => {
    if (cutSegments.length === 1 && cutSegments[0].start == null && cutSegments[0].end == null) return; // Initial segment

    if (cutSegments.length <= 1) {
      setCutSegments(createInitialCutSegments());
      return;
    }

    const cutSegmentsNew = [...cutSegments];
    cutSegmentsNew.splice(index, 1);

    setCutSegments(cutSegmentsNew);
  }, [cutSegments, setCutSegments]);

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

  const hasAudio = !!mainAudioStream;
  const hasVideo = !!mainVideoStream;
  const shouldShowKeyframes = keyframesEnabled && !!mainVideoStream && calcShouldShowKeyframes(zoomedDuration);
  const shouldShowWaveform = calcShouldShowWaveform(zoomedDuration);

  const { neighbouringFrames, findNearestKeyFrameTime } = useKeyframes({ keyframesEnabled, filePath, commandedTime, mainVideoStream, detectedFps, ffmpegExtractWindow });
  const { waveform } = useWaveform({ filePath, commandedTime, zoomedDuration, waveformEnabled, mainAudioStream, shouldShowWaveform, ffmpegExtractWindow });

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
    setDisabledSegmentIds({});
    setHideCanvasPreview(false);

    setExportConfirmVisible(false);

    setThumbnails([]);
    cancelRenderThumbnails();
  }, [cutSegmentsHistory, setCutSegments, cancelRenderThumbnails]);


  const showUnsupportedFileMessage = useCallback(() => {
    if (!hideAllNotifications) toast.fire({ timer: 13000, text: i18n.t('File not natively supported. Preview may have no audio or low quality. The final export will however be lossless with audio. You may convert it from the menu for a better preview with audio.') });
  }, [hideAllNotifications]);

  const showPreviewFileLoadedMessage = useCallback((fileName) => {
    if (!hideAllNotifications) toast.fire({ text: i18n.t('Loaded existing preview file: {{ fileName }}', { fileName }) });
  }, [hideAllNotifications]);

  const createDummyVideo = useCallback(async (cod, fp) => {
    const html5ifiedDummyPathDummy = getOutPath(cod, fp, 'html5ified-dummy.mkv');
    try {
      setCutProgress(0);
      await html5ifyDummy({ filePath: fp, outPath: html5ifiedDummyPathDummy, onProgress: setCutProgress });
    } finally {
      setCutProgress();
    }
    setDummyVideoPath(html5ifiedDummyPathDummy);
    setHtml5FriendlyPath();
    showUnsupportedFileMessage();
  }, [html5ifyDummy, showUnsupportedFileMessage]);

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

    let trashResponse = cleanupChoices;
    if (!cleanupChoices.dontShowAgain) {
      trashResponse = await cleanupFilesDialog(cleanupChoices);
      console.log('trashResponse', trashResponse);
      if (!trashResponse) return; // Cancelled
      setCleanupChoices(trashResponse); // Store for next time
    }

    const { tmpFiles: deleteTmpFiles, projectFile: deleteProjectFile, sourceFile: deleteOriginal } = trashResponse;
    if (!deleteTmpFiles && !deleteProjectFile && !deleteOriginal) return;

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

  // For invertCutSegments we do not support filtering
  const enabledOutSegmentsRaw = useMemo(() => (invertCutSegments ? outSegments : outSegments.filter((s) => !disabledSegmentIds[s.segId])), [outSegments, invertCutSegments, disabledSegmentIds]);
  // If user has selected none to export, it makes no sense, so export all instead
  const enabledOutSegments = enabledOutSegmentsRaw.length > 0 ? enabledOutSegmentsRaw : outSegments;

  const onExportSingleSegmentClick = useCallback((activeSeg) => setDisabledSegmentIds(Object.fromEntries(cutSegments.filter((s) => s.segId !== activeSeg.segId).map((s) => [s.segId, true]))), [cutSegments]);
  const onExportSegmentEnabledToggle = useCallback((toggleSeg) => setDisabledSegmentIds((existing) => ({ ...existing, [toggleSeg.segId]: !existing[toggleSeg.segId] })), []);
  const onExportSegmentDisableAll = useCallback(() => setDisabledSegmentIds(Object.fromEntries(cutSegments.map((s) => [s.segId, true]))), [cutSegments]);
  const onExportSegmentEnableAll = useCallback(() => setDisabledSegmentIds({}), []);

  const generateOutSegFileNames = useCallback(({ segments = enabledOutSegments, template }) => (
    segments.map(({ start, end, name = '' }, i) => {
      const cutFromStr = formatDuration({ seconds: start, fileNameFriendly: true });
      const cutToStr = formatDuration({ seconds: end, fileNameFriendly: true });
      const segNum = i + 1;

      // https://github.com/mifi/lossless-cut/issues/583
      let segSuffix = '';
      if (name) segSuffix = `-${filenamify(name)}`;
      else if (segments.length > 1) segSuffix = `-seg${segNum}`;

      const ext = getOutFileExtension({ isCustomFormatSelected, outFormat: fileFormat, filePath });

      const { name: fileNameWithoutExt } = parsePath(filePath);

      const generated = generateSegFileName({ template, segSuffix, inputFileNameWithoutExt: fileNameWithoutExt, ext, segNum, segLabel: filenamify(name), cutFrom: cutFromStr, cutTo: cutToStr });
      return generated.substr(0, 200); // Just to be sure
    })
  ), [fileFormat, filePath, isCustomFormatSelected, enabledOutSegments]);

  // TODO improve user feedback
  const isOutSegFileNamesValid = useCallback((fileNames) => fileNames.every((fileName) => {
    if (!filePath) return false;

    const invalidChars = [
      pathSep,
      ':', // https://github.com/mifi/lossless-cut/issues/631
    ];
    const sameAsInputPath = pathNormalize(pathJoin(outputDir, fileName)) === pathNormalize(filePath);
    return fileName.length > 0 && !invalidChars.some((c) => fileName.includes(c)) && !sameAsInputPath;
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
    if (working) return;

    if (numStreamsToCopy === 0) {
      errorToast(i18n.t('No tracks selected for export'));
      return;
    }

    setStreamsSelectorShown(false);
    setExportConfirmVisible(false);

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

      if (exportExtraStreams && enabledOutSegments.length > 1) {
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
  }, [working, numStreamsToCopy, enabledOutSegments, outSegTemplateOrDefault, generateOutSegFileNames, customOutDir, filePath, fileFormat, duration, isRotationSet, effectiveRotation, copyFileStreams, keyframeCut, shortestFlag, ffmpegExperimental, preserveMovData, movFastStart, avoidNegativeTs, customTagsByFile, customTagsByStreamId, autoMerge, exportExtraStreams, fileFormatData, mainStreams, hideAllNotifications, outputDir, segmentsToChapters, invertCutSegments, isCustomFormatSelected, autoDeleteMergedSegments, preserveMetadataOnMerge, nonCopiedExtraStreams, handleCutFailed, isOutSegFileNamesValid, cutMultiple, autoMergeSegments]);

  const onExportPress = useCallback(async () => {
    if (working || !filePath) return;

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
  }, [working, filePath, haveInvalidSegs, enabledOutSegments, exportConfirmEnabled, onExportConfirm]);

  const capture = useCallback(async () => {
    if (!filePath) return;

    try {
      const mustCaptureFfmpeg = html5FriendlyPath || dummyVideoPath;
      const currentTime = currentTimeRef.current;
      const video = videoRef.current;
      const outPath = mustCaptureFfmpeg
        ? await captureFrameFfmpeg({ customOutDir, filePath, currentTime, captureFormat, enableTransferTimestamps })
        : await captureFrameFromTag({ customOutDir, filePath, currentTime, captureFormat, video, enableTransferTimestamps });

      openDirToast({ dirPath: outputDir, text: `${i18n.t('Screenshot captured to:')} ${outPath}` });
    } catch (err) {
      console.error(err);
      errorToast(i18n.t('Failed to capture frame'));
    }
  }, [filePath, captureFormat, customOutDir, html5FriendlyPath, dummyVideoPath, outputDir, enableTransferTimestamps]);

  const changePlaybackRate = useCallback((dir) => {
    if (canvasPlayerEnabled) {
      toast.fire({ title: i18n.t('Unable to change playback rate right now'), timer: 1000 });
      return;
    }

    const video = videoRef.current;
    if (!playing) {
      video.play();
    } else {
      // https://github.com/mifi/lossless-cut/issues/447#issuecomment-766339083
      const newRate = clamp(Math.round((video.playbackRate + (dir * 0.15)) * 100) / 100, 0.1, 16);
      toast.fire({ title: `${i18n.t('Playback rate:')} ${Math.round(newRate * 100)}%`, timer: 1000 });
      video.playbackRate = newRate;
    }
  }, [playing, canvasPlayerEnabled]);

  const html5ifiedPrefix = 'html5ified-';

  const getHtml5ifiedPath = useCallback((cod, fp, type) => {
    // See also inside ffmpegHtml5ify
    const ext = (isMac && ['slowest', 'slow', 'slow-audio'].includes(type)) ? 'mp4' : 'mkv';
    return getOutPath(cod, fp, `${html5ifiedPrefix}${type}.${ext}`);
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
      // TODO: Cannot do this because duration is not yet set when loading a file
      // && (row.start === undefined || (row.start >= 0 && row.start < duration))
      // && (row.end === undefined || row.end < duration)
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
      else if (type === 'mplayer') edl = await loadMplayerEdl(path);

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

    async function checkAndSetExistingHtml5FriendlyFile() {
      const speeds = ['slowest', 'slow-audio', 'slow', 'fast-audio', 'fast', 'fastest-audio'];
      const prefix = `${getFileBaseName(fp)}-${html5ifiedPrefix}`;

      const outDir = getOutDir(cod, fp);
      const dirEntries = await readdir(outDir);
      let speed;
      let path;
      // eslint-disable-next-line no-restricted-syntax
      for (const entry of dirEntries) {
        const html5Match = entry.startsWith(prefix);
        if (html5Match) {
          path = pathJoin(outDir, entry);
          const speedMatch = speeds.find((s) => new RegExp(`${s}\\..*$`).test(entry.replace(prefix, '')));
          if (speedMatch) {
            speed = speedMatch;
          }
          break;
        }
      }

      if (!path) return false;

      console.log('Found existing supported file', path, speed);
      if (speed === 'fastest-audio') {
        setDummyVideoPath(path);
        setHtml5FriendlyPath();
      } else {
        setHtml5FriendlyPath(path);
      }

      showPreviewFileLoadedMessage(basename(path));
      return true;
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
      setFileFormat(outFormatLocked || ff);
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
        !(await checkAndSetExistingHtml5FriendlyFile())
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
  }, [resetState, working, createDummyVideo, loadEdlFile, getEdlFilePath, getHtml5ifiedPath, loadCutSegments, enableAskForImportChapters, showUnsupportedFileMessage, autoLoadTimecode, outFormatLocked]);

  const toggleHelp = useCallback(() => setHelpVisible(val => !val), []);
  const toggleSettings = useCallback(() => setSettingsVisible(val => !val), []);

  const jumpSeg = useCallback((val) => setCurrentSegIndex((old) => Math.max(Math.min(old + val, cutSegments.length - 1), 0)), [cutSegments.length]);

  const seekClosestKeyframe = useCallback((direction) => {
    const time = findNearestKeyFrameTime({ time: currentTimeRef.current, direction });
    if (time == null) return;
    seekAbs(time);
  }, [findNearestKeyFrameTime, seekAbs]);

  const seekAccelerationRef = useRef(1);

  // TODO split up?
  useEffect(() => {
    if (exportConfirmVisible) return () => {};

    const togglePlayNoReset = () => togglePlay();
    const togglePlayReset = () => togglePlay(true);
    const reducePlaybackRate = () => changePlaybackRate(-1);
    const increasePlaybackRate = () => changePlaybackRate(1);
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
    mousetrap.bind('backspace', () => removeCutSegment(currentSegIndexSafe));
    mousetrap.bind('d', () => cleanupFiles());
    mousetrap.bind('b', () => splitCurrentSegment());
    mousetrap.bind('r', () => increaseRotation());

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

    mousetrap.bind('down', () => jumpNextSegment());
    mousetrap.bind(['ctrl+down', 'command+down'], () => zoomOut());

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
    seekClosestKeyframe, zoomRel, toggleComfortZoom, splitCurrentSegment, exportConfirmVisible,
    increaseRotation, jumpCutStart, jumpCutEnd, cutSegmentsHistory, keyboardSeekAccFactor,
    keyboardNormalSeekSpeed, onLabelSegmentPress, currentSegIndexSafe,
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

  const extractSingleStream = useCallback(async (index) => {
    if (!filePath || working) return;

    try {
      // setStreamsSelectorShown(false);
      setWorking(i18n.t('Extracting track'));
      await extractStreams({ customOutDir, filePath, streams: mainStreams.filter((s) => s.index === index) });
      openDirToast({ dirPath: outputDir, text: i18n.t('Track has been extracted') });
    } catch (err) {
      errorToast(i18n.t('Failed to extract track'));
      console.error('Failed to extract track', err);
    } finally {
      setWorking();
    }
  }, [customOutDir, filePath, mainStreams, outputDir, working]);

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

  const addStreamSourceFile = useCallback(async (path) => {
    if (externalStreamFiles[path]) return;
    const { streams } = await getAllStreams(path);
    const formatData = await getFormatData(path);
    // console.log('streams', streams);
    setExternalStreamFiles(old => ({ ...old, [path]: { streams, formatData } }));
    setCopyStreamIdsForPath(path, () => fromPairs(streams.map(({ index }) => [index, true])));
  }, [externalStreamFiles]);

  const userOpenFiles = useCallback(async (filePathsRaw) => {
    console.log('userOpenFiles');
    console.log(filePathsRaw.join('\n'));

    // Need to resolve relative paths https://github.com/mifi/lossless-cut/issues/639
    const filePaths = filePathsRaw.map((path) => (pathIsAbsolute(path) ? path : pathResolve(path)));

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

    if (!(await havePermissionToReadFile(firstFile))) {
      errorToast(i18n.t('You do not have permission to access this file'));
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
      else if (speed === 'slow-audio') audio = 'lq';
      else if (speed === 'fast-audio') audio = 'copy';
      else if (speed === 'fastest-audio') audio = 'silent-audio';
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
  }, [ffmpegHtml5ify, getHtml5ifiedPath]);

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

    async function exportEdlYouTube() {
      if (!checkFileOpened()) return;

      await openYouTubeChaptersDialog(formatYouTube(apparentCutSegments));
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
      else if (type === 'mplayer') filters = [{ name: i18n.t('MPlayer EDL'), extensions: ['*'] }];

      const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'], filters });
      if (canceled || filePaths.length < 1) return;
      await loadEdlFile(filePaths[0], type);
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
        const path = await fixInvalidDuration({ fileFormat, customOutDir });
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
    electron.ipcRenderer.on('importEdlFile', importEdlFile);
    electron.ipcRenderer.on('exportEdlFile', exportEdlFile);
    electron.ipcRenderer.on('exportEdlYouTube', exportEdlYouTube);
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
      electron.ipcRenderer.removeListener('importEdlFile', importEdlFile);
      electron.ipcRenderer.removeListener('exportEdlFile', exportEdlFile);
      electron.ipcRenderer.removeListener('exportEdlYouTube', exportEdlYouTube);
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
    createDummyVideo, extractAllStreams, userOpenFiles, openSendReportDialogWithState,
    loadEdlFile, cutSegments, apparentCutSegments, edlFilePath, toggleHelp, toggleSettings, assureOutDirAccess, html5ifyAndLoad, html5ifyInternal,
    loadCutSegments, duration, checkFileOpened, load, fileFormat, reorderSegsByStartTime, closeFile, clearSegments, fixInvalidDuration,
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
    <Select value={fileFormat || ''} title={i18n.t('Output format')} onChange={withBlur(e => onOutputFormatUserChange(e.target.value))} {...props}>
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
      enableTransferTimestamps={enableTransferTimestamps}
      setEnableTransferTimestamps={setEnableTransferTimestamps}
      AutoExportToggler={AutoExportToggler}
      renderCaptureFormatButton={renderCaptureFormatButton}
      onTunerRequested={onTunerRequested}
    />
  ), [changeOutDir, customOutDir, keyframeCut, setKeyframeCut, invertCutSegments, setInvertCutSegments, autoSaveProjectFile, setAutoSaveProjectFile, timecodeShowFrames, setTimecodeShowFrames, askBeforeClose, setAskBeforeClose, enableAskForImportChapters, setEnableAskForImportChapters, enableAskForFileOpenAction, setEnableAskForFileOpenAction, ffmpegExperimental, setFfmpegExperimental, invertTimelineScroll, setInvertTimelineScroll, language, setLanguage, hideNotifications, setHideNotifications, autoLoadTimecode, setAutoLoadTimecode, AutoExportToggler, renderCaptureFormatButton, onTunerRequested, enableTransferTimestamps, setEnableTransferTimestamps]);

  useEffect(() => {
    if (!isStoreBuild) loadMifiLink().then(setMifiLink);
  }, []);

  useEffect(() => {
    // Testing:
    // if (isDev) load({ filePath: '/Users/mifi/Downloads/inp.MOV', customOutDir });
  }, []);

  // TODO fastest-audio shows muted
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
          />
        </SideSheet>

        <TopMenu
          filePath={filePath}
          height={topBarHeight}
          copyAnyAudioTrack={copyAnyAudioTrack}
          toggleStripAudio={toggleStripAudio}
          customOutDir={customOutDir}
          changeOutDir={changeOutDir}
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
        <>
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
                  toggleSideBar={toggleSideBar}
                  splitCurrentSegment={splitCurrentSegment}
                  enabledOutSegmentsRaw={enabledOutSegmentsRaw}
                  enabledOutSegments={enabledOutSegments}
                  onExportSingleSegmentClick={onExportSingleSegmentClick}
                  onExportSegmentEnabledToggle={onExportSegmentEnabledToggle}
                  onExportSegmentDisableAll={onExportSegmentDisableAll}
                  onExportSegmentEnableAll={onExportSegmentEnableAll}
                  jumpSegStart={jumpSegStart}
                  jumpSegEnd={jumpSegEnd}
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
          waveform={waveform}
          shouldShowWaveform={shouldShowWaveform}
          waveformEnabled={waveformEnabled}
          thumbnailsEnabled={thumbnailsEnabled}
          neighbouringFrames={neighbouringFrames}
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
            enabledOutSegments={enabledOutSegments}
            exportConfirmEnabled={exportConfirmEnabled}
            toggleExportConfirmEnabled={toggleExportConfirmEnabled}
            simpleMode={simpleMode}
          />
        </div>
      </motion.div>

      <ExportConfirm filePath={filePath} autoMerge={autoMerge} setAutoMerge={setAutoMerge} areWeCutting={areWeCutting} enabledOutSegments={enabledOutSegments} visible={exportConfirmVisible} onClosePress={closeExportConfirm} onExportConfirm={onExportConfirm} keyframeCut={keyframeCut} toggleKeyframeCut={toggleKeyframeCut} renderOutFmt={renderOutFmt} preserveMovData={preserveMovData} togglePreserveMovData={togglePreserveMovData} movFastStart={movFastStart} toggleMovFastStart={toggleMovFastStart} avoidNegativeTs={avoidNegativeTs} setAvoidNegativeTs={setAvoidNegativeTs} changeOutDir={changeOutDir} outputDir={outputDir} numStreamsTotal={numStreamsTotal} numStreamsToCopy={numStreamsToCopy} setStreamsSelectorShown={setStreamsSelectorShown} exportConfirmEnabled={exportConfirmEnabled} toggleExportConfirmEnabled={toggleExportConfirmEnabled} segmentsToChapters={segmentsToChapters} toggleSegmentsToChapters={toggleSegmentsToChapters} outFormat={fileFormat} preserveMetadataOnMerge={preserveMetadataOnMerge} togglePreserveMetadataOnMerge={togglePreserveMetadataOnMerge} setOutSegTemplate={setOutSegTemplate} outSegTemplate={outSegTemplateOrDefault} generateOutSegFileNames={generateOutSegFileNames} currentSegIndexSafe={currentSegIndexSafe} isOutSegFileNamesValid={isOutSegFileNamesValid} autoDeleteMergedSegments={autoDeleteMergedSegments} setAutoDeleteMergedSegments={setAutoDeleteMergedSegments} />

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

      {tunerVisible && renderTuner(tunerVisible)}
    </div>
  );
});

export default App;
