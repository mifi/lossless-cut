import React, { memo, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { FaAngleLeft, FaWindowClose } from 'react-icons/fa';
import { MdRotate90DegreesCcw } from 'react-icons/md';
import { AnimatePresence } from 'framer-motion';
import { Heading, InlineAlert, Table, SideSheet, Position, ThemeProvider } from 'evergreen-ui';
import useDebounceOld from 'react-use/lib/useDebounce'; // Want to phase out this
import { useDebounce } from 'use-debounce';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';

import fromPairs from 'lodash/fromPairs';
import sortBy from 'lodash/sortBy';
import flatMap from 'lodash/flatMap';
import isEqual from 'lodash/isEqual';
import sum from 'lodash/sum';

import theme from './theme';
import useTimelineScroll from './hooks/useTimelineScroll';
import useUserSettingsRoot from './hooks/useUserSettingsRoot';
import useFfmpegOperations from './hooks/useFfmpegOperations';
import useKeyframes from './hooks/useKeyframes';
import useWaveform from './hooks/useWaveform';
import useKeyboard from './hooks/useKeyboard';
import useFileFormatState from './hooks/useFileFormatState';
import useFrameCapture from './hooks/useFrameCapture';
import useSegments from './hooks/useSegments';
import useDirectoryAccess from './hooks/useDirectoryAccess';

import UserSettingsContext from './contexts/UserSettingsContext';

import NoFileLoaded from './NoFileLoaded';
import Canvas from './Canvas';
import TopMenu from './TopMenu';
import Sheet from './Sheet';
import LastCommandsSheet from './LastCommandsSheet';
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
import Working from './components/Working';
import OutputFormatSelect from './components/OutputFormatSelect';

import { loadMifiLink, runStartupCheck } from './mifi';
import { controlsBackground } from './colors';
import {
  getStreamFps, isCuttingStart, isCuttingEnd,
  readFileMeta, getSmarterOutFormat, renderThumbnails as ffmpegRenderThumbnails,
  extractStreams, setCustomFfPath as ffmpegSetCustomFfPath,
  isIphoneHevc, isProblematicAvc1, tryMapChaptersToEdl,
  getDuration, getTimecodeFromStreams, createChaptersFromSegments, extractSubtitleTrack,
  RefuseOverwriteError, abortFfmpegs,
} from './ffmpeg';
import { shouldCopyStreamByDefault, getAudioStreams, getRealVideoStreams, isAudioDefinitelyNotSupported, willPlayerProperlyHandleVideo, doesPlayerSupportHevcPlayback, isStreamThumbnail } from './util/streams';
import { exportEdlFile, readEdlFile, saveLlcProject, loadLlcProject, askForEdlImport } from './edlStore';
import { formatYouTube, getFrameCountRaw } from './edlFormats';
import {
  getOutPath, getSuffixedOutPath, handleError, getOutDir,
  isMasBuild, isStoreBuild, dragPreventer,
  filenamify, getOutFileExtension, generateSegFileName, defaultOutSegTemplate,
  havePermissionToReadFile, resolvePathIfNeeded, getPathReadAccessError, html5ifiedPrefix, html5dummySuffix, findExistingHtml5FriendlyFile,
  deleteFiles, isOutOfSpaceError, getNumDigits, isExecaFailure, readFileSize, readFileSizes, checkFileSizes, setDocumentTitle,
} from './util';
import { toast, errorToast } from './swal';
import { formatDuration } from './util/duration';
import { adjustRate } from './util/rate-calculator';
import { askExtractFramesAsImages } from './dialogs/extractFrames';
import { askForHtml5ifySpeed } from './dialogs/html5ify';
import { askForOutDir, askForImportChapters, promptTimeOffset, askForFileOpenAction, confirmExtractAllStreamsDialog, showCleanupFilesDialog, showDiskFull, showExportFailedDialog, showConcatFailedDialog, openYouTubeChaptersDialog, openAbout, showRefuseToOverwrite, openDirToast, openCutFinishedToast, openConcatFinishedToast } from './dialogs';
import { openSendReportDialog } from './reporting';
import { fallbackLng } from './i18n';
import { createSegment, getCleanCutSegments, findSegmentsAtCursor, sortSegments, getSegmentTags, convertSegmentsToChapters, hasAnySegmentOverlap, isDurationValid } from './segments';
import { getOutSegError as getOutSegErrorRaw } from './util/outputNameTemplate';
import { rightBarWidth, leftBarWidth, ffmpegExtractWindow, zoomMax } from './util/constants';

import isDev from './isDev';

const electron = window.require('electron');
const { exists } = window.require('fs-extra');
const filePathToUrl = window.require('file-url');
const { parse: parsePath, join: pathJoin, basename, dirname } = window.require('path');

const remote = window.require('@electron/remote');

const { dialog } = remote;

const { focusWindow } = remote.require('./electron');


const calcShouldShowWaveform = (zoomedDuration) => (zoomedDuration != null && zoomedDuration < ffmpegExtractWindow * 8);
const calcShouldShowKeyframes = (zoomedDuration) => (zoomedDuration != null && zoomedDuration < ffmpegExtractWindow * 8);


const videoStyle = { width: '100%', height: '100%', objectFit: 'contain' };
const bottomStyle = { background: controlsBackground };

let lastOpenedPath;
const hevcPlaybackSupportedPromise = doesPlayerSupportHevcPlayback();
hevcPlaybackSupportedPromise.catch((err) => console.error(err));

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
  const [zoomUnrounded, setZoom] = useState(1);
  const [thumbnails, setThumbnails] = useState([]);
  const [shortestFlag, setShortestFlag] = useState(false);
  const [zoomWindowStartTime, setZoomWindowStartTime] = useState(0);
  const [subtitlesByStreamId, setSubtitlesByStreamId] = useState({});
  const [activeSubtitleStreamIndex, setActiveSubtitleStreamIndex] = useState();
  const [hideCanvasPreview, setHideCanvasPreview] = useState(false);
  const [exportConfirmVisible, setExportConfirmVisible] = useState(false);

  const { fileFormat, setFileFormat, detectedFileFormat, setDetectedFileFormat, isCustomFormatSelected } = useFileFormatState();

  // State per application launch
  const [timelineMode, setTimelineMode] = useState();
  const [keyframesEnabled, setKeyframesEnabled] = useState(true);
  const [showRightBar, setShowRightBar] = useState(true);
  const [cleanupChoices, setCleanupChoices] = useState({ tmpFiles: true });
  const [rememberConvertToSupportedFormat, setRememberConvertToSupportedFormat] = useState();
  const [lastCommandsVisible, setLastCommandsVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [tunerVisible, setTunerVisible] = useState();
  const [keyboardShortcutsVisible, setKeyboardShortcutsVisible] = useState(false);
  const [mifiLink, setMifiLink] = useState();
  const [alwaysConcatMultipleFiles, setAlwaysConcatMultipleFiles] = useState(false);

  // Batch state / concat files
  const [batchFiles, setBatchFiles] = useState([]);
  const [selectedBatchFiles, setSelectedBatchFiles] = useState([]);

  const [cutStartTimeManual, setCutStartTimeManual] = useState();
  const [cutEndTimeManual, setCutEndTimeManual] = useState();

  // Store "working" in a ref so we can avoid race conditions
  const workingRef = useRef(working);
  const setWorking = useCallback((val) => {
    workingRef.current = val;
    setWorkingState(val);
  }, []);

  useEffect(() => setDocumentTitle({ filePath, working, cutProgress }), [cutProgress, filePath, working]);

  const zoom = Math.floor(zoomUnrounded);

  const durationSafe = isDurationValid(duration) ? duration : 1;
  const zoomedDuration = isDurationValid(duration) ? duration / zoom : undefined;

  const allUserSettings = useUserSettingsRoot();

  const {
    captureFormat, setCaptureFormat, customOutDir, setCustomOutDir, keyframeCut, setKeyframeCut, preserveMovData, setPreserveMovData, movFastStart, setMovFastStart, avoidNegativeTs, autoMerge, timecodeFormat, invertCutSegments, setInvertCutSegments, autoExportExtraStreams, askBeforeClose, enableAskForImportChapters, enableAskForFileOpenAction, playbackVolume, setPlaybackVolume, autoSaveProjectFile, wheelSensitivity, invertTimelineScroll, language, ffmpegExperimental, hideNotifications, autoLoadTimecode, autoDeleteMergedSegments, exportConfirmEnabled, setExportConfirmEnabled, segmentsToChapters, setSegmentsToChapters, preserveMetadataOnMerge, setPreserveMetadataOnMerge, setSimpleMode, outSegTemplate, setOutSegTemplate, keyboardSeekAccFactor, keyboardNormalSeekSpeed, enableTransferTimestamps, outFormatLocked, setOutFormatLocked, safeOutputFileName, setSafeOutputFileName, enableAutoHtml5ify, segmentsToChaptersOnly, keyBindings, setKeyBindings, resetKeyBindings, enableSmartCut, customFfPath, storeProjectInWorkingDir, enableOverwriteOutput, mouseWheelZoomModifierKey, captureFrameMethod, captureFrameQuality, captureFrameFileNameFormat, enableNativeHevc,
  } = allUserSettings;

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

  const toggleTimelineMode = useCallback((newMode) => {
    if (newMode === timelineMode) {
      setTimelineMode();
    } else {
      setTimelineMode(newMode);
    }
  }, [timelineMode]);

  const toggleExportConfirmEnabled = useCallback(() => setExportConfirmEnabled((v) => {
    const newVal = !v;
    toast.fire({ text: newVal ? i18n.t('Export options will be shown before exporting.') : i18n.t('Export options will not be shown before exporting.') });
    return newVal;
  }), [setExportConfirmEnabled]);

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
  const effectiveRotation = useMemo(() => (isRotationSet ? rotation : (mainVideoStream && mainVideoStream.tags && mainVideoStream.tags.rotate && parseInt(mainVideoStream.tags.rotate, 10))), [isRotationSet, mainVideoStream, rotation]);

  const zoomRel = useCallback((rel) => setZoom((z) => Math.min(Math.max(z + (rel * (1 + (z / 10))), 1), zoomMax)), []);
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

  const onTimelineWheel = useTimelineScroll({ wheelSensitivity, mouseWheelZoomModifierKey, invertTimelineScroll, zoomRel, seekRel });

  // Relevant time is the player's playback position if we're currently playing - if not, it's the user's commanded time.
  const relevantTime = useMemo(() => (playing ? playerTime : commandedTime) || 0, [commandedTime, playerTime, playing]);
  // The reason why we also have a getter is because it can be used when we need to get the time, but don't want to re-render for every time update (which can be heavy!)
  const getRelevantTime = useCallback(() => (playing ? videoRef.current.currentTime : commandedTimeRef.current) || 0, [playing]);

  const maxLabelLength = safeOutputFileName ? 100 : 500;

  const checkFileOpened = useCallback(() => {
    if (isFileOpened) return true;
    toast.fire({ icon: 'info', title: i18n.t('You need to open a media file first') });
    return false;
  }, [isFileOpened]);

  const {
    cutSegments, cutSegmentsHistory, createSegmentsFromKeyframes, shuffleSegments, detectBlackScenes, detectSilentScenes, detectSceneChanges, removeCutSegment, invertAllSegments, fillSegmentsGaps, combineOverlappingSegments, shiftAllSegmentTimes, alignSegmentTimesToKeyframes, onViewSegmentTags, updateSegOrder, updateSegOrders, reorderSegsByStartTime, addSegment, setCutStart, setCutEnd, onLabelSegment, splitCurrentSegment, createNumSegments, createFixedDurationSegments, createRandomSegments, apparentCutSegments, haveInvalidSegs, currentSegIndexSafe, currentCutSeg, currentApparentCutSeg, inverseCutSegments, clearSegments, loadCutSegments, selectedSegmentsRaw, setCutTime, getSegApparentEnd, setCurrentSegIndex, onLabelSelectedSegments, deselectAllSegments, selectAllSegments, selectOnlyCurrentSegment, toggleCurrentSegmentSelected, removeSelectedSegments, setDeselectedSegmentIds, onSelectSegmentsByLabel, toggleSegmentSelected, selectOnlySegment,
  } = useSegments({ filePath, workingRef, setWorking, setCutProgress, mainVideoStream, duration, getRelevantTime, maxLabelLength, checkFileOpened });

  const jumpSegStart = useCallback((index) => seekAbs(apparentCutSegments[index].start), [apparentCutSegments, seekAbs]);
  const jumpSegEnd = useCallback((index) => seekAbs(apparentCutSegments[index].end), [apparentCutSegments, seekAbs]);
  const jumpCutStart = useCallback(() => jumpSegStart(currentSegIndexSafe), [currentSegIndexSafe, jumpSegStart]);
  const jumpCutEnd = useCallback(() => jumpSegEnd(currentSegIndexSafe), [currentSegIndexSafe, jumpSegEnd]);
  const jumpTimelineStart = useCallback(() => seekAbs(0), [seekAbs]);
  const jumpTimelineEnd = useCallback(() => seekAbs(durationSafe), [durationSafe, seekAbs]);


  const getFrameCount = useCallback((sec) => getFrameCountRaw(detectedFps, sec), [detectedFps]);

  const formatTimecode = useCallback(({ seconds, shorten, fileNameFriendly }) => {
    if (timecodeFormat === 'frameCount') {
      const frameCount = getFrameCount(seconds);
      return frameCount != null ? frameCount : '';
    }
    if (timecodeFormat === 'timecodeWithFramesFraction') {
      return formatDuration({ seconds, fps: detectedFps, shorten, fileNameFriendly });
    }
    return formatDuration({ seconds, shorten, fileNameFriendly });
  }, [detectedFps, timecodeFormat, getFrameCount]);

  const { captureFrameFromTag, captureFrameFromFfmpeg, captureFramesRange } = useFrameCapture({ formatTimecode });

  // const getSafeCutTime = useCallback((cutTime, next) => ffmpeg.getSafeCutTime(neighbouringFrames, cutTime, next), [neighbouringFrames]);

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
  const getEdlFilePath = useCallback((fp, storeProjectInWorkingDir2 = false) => getSuffixedOutPath({ customOutDir: storeProjectInWorkingDir2 ? customOutDir : undefined, filePath: fp, nameSuffix: projectSuffix }), [customOutDir]);
  // Old versions of LosslessCut used CSV files and stored them in customOutDir:
  const getEdlFilePathOld = useCallback((fp) => getSuffixedOutPath({ customOutDir, filePath: fp, nameSuffix: oldProjectSuffix }), [customOutDir]);
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

  const { ensureWritableDirs } = useDirectoryAccess({ customOutDir, setCustomOutDir });

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
    ...allUserSettings, toggleCaptureFormat, changeOutDir, toggleKeyframeCut, togglePreserveMovData, toggleMovFastStart, toggleExportConfirmEnabled, toggleSegmentsToChapters, togglePreserveMetadataOnMerge, toggleSimpleMode, toggleSafeOutputFileName, effectiveExportMode,
  }), [allUserSettings, changeOutDir, effectiveExportMode, toggleCaptureFormat, toggleExportConfirmEnabled, toggleKeyframeCut, toggleMovFastStart, togglePreserveMetadataOnMerge, togglePreserveMovData, toggleSafeOutputFileName, toggleSegmentsToChapters, toggleSimpleMode]);

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

  const mainCopiedStreams = useMemo(() => mainStreams.filter((stream) => isCopyingStreamId(filePath, stream.index)), [filePath, isCopyingStreamId, mainStreams]);
  const mainCopiedThumbnailStreams = useMemo(() => mainCopiedStreams.filter(isStreamThumbnail), [mainCopiedStreams]);

  // Streams that are not copy enabled by default
  const extraStreams = useMemo(() => mainStreams.filter((stream) => !shouldCopyStreamByDefault(stream)), [mainStreams]);

  // Extra streams that the user has not selected for copy
  const nonCopiedExtraStreams = useMemo(() => extraStreams.filter((stream) => !isCopyingStreamId(filePath, stream.index)), [extraStreams, filePath, isCopyingStreamId]);

  const exportExtraStreams = autoExportExtraStreams && nonCopiedExtraStreams.length > 0;

  const copyFileStreams = useMemo(() => Object.entries(copyStreamIdsByFile).map(([path, streamIdsMap]) => ({
    path,
    streamIds: Object.keys(streamIdsMap).filter(index => streamIdsMap[index]).map((streamIdStr) => parseInt(streamIdStr, 10)),
  })), [copyStreamIdsByFile]);

  // total number of streams to copy for ALL files
  const numStreamsToCopy = copyFileStreams.reduce((acc, { streamIds }) => acc + streamIds.length, 0);

  const allFilesMeta = useMemo(() => ({
    ...externalFilesMeta,
    [filePath]: mainFileMeta,
  }), [externalFilesMeta, filePath, mainFileMeta]);

  // total number of streams for ALL files
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

  const thumnailsRef = useRef([]);
  const thumnailsRenderingPromiseRef = useRef();

  function addThumbnail(thumbnail) {
    // console.log('Rendered thumbnail', thumbnail.url);
    setThumbnails(v => [...v, thumbnail]);
  }

  const hasAudio = !!mainAudioStream;
  const hasVideo = !!mainVideoStream;

  const waveformEnabled = timelineMode === 'waveform' && hasAudio;
  const thumbnailsEnabled = timelineMode === 'thumbnails' && hasVideo;

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

  const shouldShowKeyframes = keyframesEnabled && !!mainVideoStream && calcShouldShowKeyframes(zoomedDuration);
  const shouldShowWaveform = calcShouldShowWaveform(zoomedDuration);

  const { neighbouringKeyFrames, findNearestKeyFrameTime } = useKeyframes({ keyframesEnabled, filePath, commandedTime, mainVideoStream, detectedFps, ffmpegExtractWindow });
  const { waveforms } = useWaveform({ filePath, commandedTime, zoomedDuration, waveformEnabled, mainAudioStream, shouldShowWaveform, ffmpegExtractWindow });

  const resetState = useCallback(() => {
    console.log('State reset');
    const video = videoRef.current;
    setCommandedTime(0);
    video.currentTime = 0;
    video.playbackRate = 1;

    // setWorking();
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
  }, [cutSegmentsHistory, clearSegments, setFileFormat, setDetectedFileFormat, setDeselectedSegmentIds, cancelRenderThumbnails]);


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
        const path = getSuffixedOutPath({ customOutDir: cod, filePath: fp, nameSuffix: `${html5ifiedPrefix}${html5dummySuffix}.mkv` });
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
  }, [html5ify, html5ifyDummy]);

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
          const { newCustomOutDir, cancel } = await ensureWritableDirs({ inputPath: path });
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
  }, [batchFiles, ensureWritableDirs, html5ify, setWorking]);

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

  const commonSettings = useMemo(() => ({
    ffmpegExperimental,
    preserveMovData,
    movFastStart,
    preserveMetadataOnMerge,
  }), [ffmpegExperimental, movFastStart, preserveMetadataOnMerge, preserveMovData]);

  const openSendReportDialogWithState = useCallback(async (err) => {
    const state = {
      ...commonSettings,

      filePath,
      fileFormat,
      externalFilesMeta,
      mainStreams,
      copyStreamIdsByFile,
      cutSegments: cutSegments.map(s => ({ start: s.start, end: s.end })),
      mainFileFormatData,
      rotation,
      shortestFlag,
      effectiveExportMode,
      outSegTemplate,
    };

    openSendReportDialog(err, state);
  }, [commonSettings, copyStreamIdsByFile, cutSegments, effectiveExportMode, externalFilesMeta, fileFormat, filePath, mainFileFormatData, mainStreams, outSegTemplate, rotation, shortestFlag]);

  const openSendConcatReportDialogWithState = useCallback(async (err, reportState) => {
    const state = { ...commonSettings, ...reportState };
    openSendReportDialog(err, state);
  }, [commonSettings]);

  const handleExportFailed = useCallback(async (err) => {
    const sendErrorReport = await showExportFailedDialog({ fileFormat, safeOutputFileName });
    if (sendErrorReport) openSendReportDialogWithState(err);
  }, [fileFormat, safeOutputFileName, openSendReportDialogWithState]);

  const handleConcatFailed = useCallback(async (err, reportState) => {
    const sendErrorReport = await showConcatFailedDialog({ fileFormat });
    if (sendErrorReport) openSendConcatReportDialogWithState(err, reportState);
  }, [fileFormat, openSendConcatReportDialogWithState]);

  const userConcatFiles = useCallback(async ({ paths, includeAllStreams, streams, fileFormat: outFormat, fileName: outFileName, clearBatchFilesAfterConcat }) => {
    if (workingRef.current) return;
    try {
      setConcatDialogVisible(false);
      setWorking(i18n.t('Merging'));

      const firstPath = paths[0];
      if (!firstPath) return;

      const { newCustomOutDir, cancel } = await ensureWritableDirs({ inputPath: firstPath });
      if (cancel) return;

      const outDir = getOutDir(newCustomOutDir, firstPath);

      const outPath = getOutPath({ customOutDir: newCustomOutDir, filePath: firstPath, fileName: outFileName });

      let chaptersFromSegments;
      if (segmentsToChapters) {
        const chapterNames = paths.map((path) => parsePath(path).name);
        chaptersFromSegments = await createChaptersFromSegments({ segmentPaths: paths, chapterNames });
      }

      const inputSize = sum(await readFileSizes(paths));

      // console.log('merge', paths);
      const metadataFromPath = paths[0];
      const { haveExcludedStreams } = await concatFiles({ paths, outPath, outDir, outFormat, metadataFromPath, includeAllStreams, streams, ffmpegExperimental, onProgress: setCutProgress, preserveMovData, movFastStart, preserveMetadataOnMerge, chapters: chaptersFromSegments, appendFfmpegCommandLog });

      const warnings = [];
      const notices = [];

      const outputSize = await readFileSize(outPath); // * 1.06; // testing:)
      const sizeCheckResult = checkFileSizes(inputSize, outputSize);
      if (sizeCheckResult != null) warnings.push(sizeCheckResult);

      if (clearBatchFilesAfterConcat) closeBatch();
      if (!includeAllStreams && haveExcludedStreams) notices.push(i18n.t('Some extra tracks have been discarded. You can change this option before merging.'));
      if (!hideAllNotifications) openConcatFinishedToast({ filePath: outPath, notices, warnings });
    } catch (err) {
      if (err.killed === true) {
        // assume execa killed (aborted by user)
        return;
      }

      console.error('stdout:', err.stdout);
      console.error('stderr:', err.stderr);

      if (isExecaFailure(err)) {
        if (isOutOfSpaceError(err)) {
          showDiskFull();
          return;
        }
        const reportState = { includeAllStreams, streams, outFormat, outFileName, segmentsToChapters };
        handleConcatFailed(err, reportState);
        return;
      }

      handleError(err);
    } finally {
      setWorking();
      setCutProgress();
    }
  }, [setWorking, ensureWritableDirs, segmentsToChapters, concatFiles, ffmpegExperimental, preserveMovData, movFastStart, preserveMetadataOnMerge, closeBatch, hideAllNotifications, handleConcatFailed]);

  const cleanupFiles = useCallback(async (cleanupChoices2) => {
    // Store paths before we reset state
    const savedPaths = { previewFilePath, sourceFilePath: filePath, projectFilePath: projectFileSavePath };

    resetState();

    batchRemoveFile(savedPaths.sourceFilePath);

    if (!cleanupChoices2.tmpFiles && !cleanupChoices2.projectFile && !cleanupChoices2.sourceFile) return;

    try {
      setWorking(i18n.t('Cleaning up'));
      console.log('trashing', cleanupChoices2);
      await deleteFiles({ toDelete: cleanupChoices2, paths: savedPaths });
    } catch (err) {
      errorToast(i18n.t('Unable to delete file: {{message}}', { message: err.message }));
      console.error(err);
    }
  }, [batchRemoveFile, filePath, previewFilePath, projectFileSavePath, resetState, setWorking]);

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

    try {
      await cleanupFiles(trashResponse);
    } finally {
      setWorking();
    }
  }, [isFileOpened, cleanupChoices, cleanupFiles, setWorking]);

  // For invertCutSegments we do not support filtering
  const selectedSegmentsOrInverseRaw = useMemo(() => (invertCutSegments ? inverseCutSegments : selectedSegmentsRaw), [inverseCutSegments, invertCutSegments, selectedSegmentsRaw]);

  const nonFilteredSegments = useMemo(() => (invertCutSegments ? inverseCutSegments : apparentCutSegments), [invertCutSegments, inverseCutSegments, apparentCutSegments]);

  // If user has selected none to export, it makes no sense, so export all instead
  const selectedSegmentsOrInverse = selectedSegmentsOrInverseRaw.length > 0 ? selectedSegmentsOrInverseRaw : nonFilteredSegments;

  const segmentsToExport = useMemo(() => {
    if (!segmentsToChaptersOnly) return selectedSegmentsOrInverse;
    // segmentsToChaptersOnly is a special mode where all segments will be simply written out as chapters to one file: https://github.com/mifi/lossless-cut/issues/993#issuecomment-1037927595
    // Chapters export mode: Emulate a single segment with no cuts (full timeline)
    return [{ start: 0, end: getSegApparentEnd({}) }];
  }, [selectedSegmentsOrInverse, getSegApparentEnd, segmentsToChaptersOnly]);

  const areWeCutting = useMemo(() => segmentsToExport.some(({ start, end }) => isCuttingStart(start) || isCuttingEnd(end, duration)), [duration, segmentsToExport]);

  const generateOutSegFileNames = useCallback(({ segments = segmentsToExport, template, forceSafeOutputFileName }) => (
    segments.map((segment, i) => {
      const { start, end, name = '' } = segment;
      const cutFromStr = formatTimecode({ seconds: start, fileNameFriendly: true });
      const cutToStr = formatTimecode({ seconds: end, fileNameFriendly: true });
      const numDigits = getNumDigits(segments.length);
      const segNum = `${i + 1}`.padStart(numDigits, '0');

      const filenamifyOrNot = (fileName) => (safeOutputFileName || forceSafeOutputFileName ? filenamify(fileName) : fileName).substr(0, maxLabelLength);

      let segSuffix = '';
      if (name) segSuffix = `-${filenamifyOrNot(name)}`;
      // https://github.com/mifi/lossless-cut/issues/583
      else if (segments.length > 1) segSuffix = `-seg${segNum}`;

      const ext = getOutFileExtension({ isCustomFormatSelected, outFormat: fileFormat, filePath });

      const { name: fileNameWithoutExt } = parsePath(filePath);

      // Fields that did not come from the source file's name must be sanitized, because they may contain characters that are not supported by the target operating/file system
      const tagsSanitized = Object.fromEntries(Object.entries(getSegmentTags(segment)).map(([tag, value]) => [tag, filenamifyOrNot(value)]));
      const nameSanitized = filenamifyOrNot(name);

      const generated = generateSegFileName({ template, segSuffix, inputFileNameWithoutExt: fileNameWithoutExt, ext, segNum, segLabel: nameSanitized, cutFrom: cutFromStr, cutTo: cutToStr, tags: tagsSanitized });
      return safeOutputFileName ? generated.substring(0, 200) : generated; // If sanitation is enabled, make sure filename is not too long
    })
  ), [segmentsToExport, formatTimecode, isCustomFormatSelected, fileFormat, filePath, safeOutputFileName, maxLabelLength]);

  const getOutSegError = useCallback((fileNames) => getOutSegErrorRaw({ fileNames, filePath, outputDir }), [outputDir, filePath]);

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
        const sortedSegments = sortSegments(selectedSegmentsOrInverse);
        if (hasAnySegmentOverlap(sortedSegments)) {
          errorToast(i18n.t('Make sure you have no overlapping segments.'));
          return;
        }
        chaptersToAdd = convertSegmentsToChapters(sortedSegments);
      }

      console.log('outSegTemplateOrDefault', outSegTemplateOrDefault);

      let outSegFileNames = generateOutSegFileNames({ segments: segmentsToExport, template: outSegTemplateOrDefault });
      if (getOutSegError(outSegFileNames) != null) {
        console.warn('Output segments file name invalid, using default instead', outSegFileNames);
        outSegFileNames = generateOutSegFileNames({ segments: segmentsToExport, template: defaultOutSegTemplate, forceSafeOutputFileName: true });
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
        enableOverwriteOutput,
      });

      let concatOutPath;
      if (willMerge) {
        setCutProgress(0);
        setWorking(i18n.t('Merging'));

        const chapterNames = segmentsToChapters && !invertCutSegments ? segmentsToExport.map((s) => s.name) : undefined;

        concatOutPath = await autoConcatCutSegments({
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

      const notices = [];
      const warnings = [];

      if (!exportConfirmEnabled) notices.push(i18n.t('Export options are not shown. You can enable export options by clicking the icon right next to the export button.'));

      // https://github.com/mifi/lossless-cut/issues/329
      if (isIphoneHevc(mainFileFormatData, mainStreams)) warnings.push(i18n.t('There is a known issue with cutting iPhone HEVC videos. The output file may not work in all players.'));

      // https://github.com/mifi/lossless-cut/issues/280
      if (!ffmpegExperimental && isProblematicAvc1(fileFormat, mainStreams)) warnings.push(i18n.t('There is a known problem with this file type, and the output might not be playable. You can work around this problem by enabling the "Experimental flag" under Settings.'));

      if (exportExtraStreams) {
        try {
          setCutProgress(); // If extracting extra streams takes a long time, prevent loader from being stuck at 100%
          setWorking(i18n.t('Extracting {{numTracks}} unprocessable tracks(s)', { numTracks: nonCopiedExtraStreams.length }));
          await extractStreams({ filePath, customOutDir, streams: nonCopiedExtraStreams, enableOverwriteOutput });
          notices.push(i18n.t('Unprocessable streams were exported as separate files.'));
        } catch (err) {
          console.error('Extra stream export failed', err);
          warnings.push(i18n.t('Unable to export unprocessable streams.'));
        }
      }

      if (areWeCutting) notices.push(i18n.t('Cutpoints may be inaccurate.'));

      const revealPath = concatOutPath || outFiles[0];
      if (!hideAllNotifications) openCutFinishedToast({ filePath: revealPath, warnings, notices });

      if (cleanupChoices.cleanupAfterExport) await cleanupFiles(cleanupChoices);
    } catch (err) {
      if (err.killed === true) {
        // assume execa killed (aborted by user)
        return;
      }
      if (err instanceof RefuseOverwriteError) {
        showRefuseToOverwrite();
        return;
      }

      console.error('stdout:', err.stdout);
      console.error('stderr:', err.stderr);

      if (isExecaFailure(err)) {
        if (isOutOfSpaceError(err)) {
          showDiskFull();
          return;
        }
        handleExportFailed(err);
        return;
      }

      handleError(err);
    } finally {
      setWorking();
      setCutProgress();
    }
  }, [numStreamsToCopy, setWorking, segmentsToChaptersOnly, outSegTemplateOrDefault, generateOutSegFileNames, segmentsToExport, getOutSegError, cutMultiple, outputDir, customOutDir, fileFormat, duration, isRotationSet, effectiveRotation, copyFileStreams, allFilesMeta, keyframeCut, shortestFlag, ffmpegExperimental, preserveMovData, preserveMetadataOnMerge, movFastStart, avoidNegativeTs, customTagsByFile, customTagsByStreamId, dispositionByStreamId, detectedFps, enableSmartCut, enableOverwriteOutput, willMerge, exportConfirmEnabled, mainFileFormatData, mainStreams, exportExtraStreams, areWeCutting, hideAllNotifications, cleanupChoices, cleanupFiles, selectedSegmentsOrInverse, segmentsToChapters, invertCutSegments, autoConcatCutSegments, isCustomFormatSelected, autoDeleteMergedSegments, nonCopiedExtraStreams, filePath, handleExportFailed]);

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
      const currentTime = getRelevantTime();
      const video = videoRef.current;
      const useFffmpeg = usingPreviewFile || captureFrameMethod === 'ffmpeg';
      const outPath = useFffmpeg
        ? await captureFrameFromFfmpeg({ customOutDir, filePath, fromTime: currentTime, captureFormat, enableTransferTimestamps, quality: captureFrameQuality })
        : await captureFrameFromTag({ customOutDir, filePath, currentTime, captureFormat, video, enableTransferTimestamps, quality: captureFrameQuality });

      if (!hideAllNotifications) openDirToast({ icon: 'success', filePath: outPath, text: `${i18n.t('Screenshot captured to:')} ${outPath}` });
    } catch (err) {
      console.error(err);
      errorToast(i18n.t('Failed to capture frame'));
    }
  }, [filePath, getRelevantTime, usingPreviewFile, captureFrameMethod, captureFrameFromFfmpeg, customOutDir, captureFormat, enableTransferTimestamps, captureFrameQuality, captureFrameFromTag, hideAllNotifications]);

  const extractSegmentFramesAsImages = useCallback(async (index) => {
    if (!filePath || detectedFps == null || workingRef.current) return;
    const { start, end } = apparentCutSegments[index];
    const segmentNumFrames = getFrameCount(end - start);
    const captureFramesResponse = await askExtractFramesAsImages({ segmentNumFrames, fps: detectedFps });
    if (captureFramesResponse == null) return;

    try {
      setWorking(i18n.t('Extracting frames'));

      setCutProgress(0);
      const outPath = await captureFramesRange({ customOutDir, filePath, fps: detectedFps, fromTime: start, toTime: end, estimatedMaxNumFiles: captureFramesResponse.estimatedMaxNumFiles, captureFormat, quality: captureFrameQuality, filter: captureFramesResponse.filter, outputTimestamps: captureFrameFileNameFormat === 'timestamp', onProgress: setCutProgress });
      if (!hideAllNotifications) openDirToast({ icon: 'success', filePath: outPath, text: i18n.t('Frames extracted to: {{path}}', { path: outputDir }) });
    } catch (err) {
      handleError(err);
    } finally {
      setWorking();
      setCutProgress();
    }
  }, [apparentCutSegments, captureFormat, captureFrameFileNameFormat, captureFrameQuality, captureFramesRange, customOutDir, detectedFps, filePath, getFrameCount, hideAllNotifications, outputDir, setWorking]);

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

  const loadEdlFile = useCallback(async ({ path, type, append }) => {
    console.log('Loading EDL file', type, path, append);
    loadCutSegments(await readEdlFile({ type, path }), append);
  }, [loadCutSegments]);

  const loadMedia = useCallback(async ({ filePath: fp, projectPath }) => {
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

    setWorking(i18n.t('Loading file'));
    try {
      // Need to check if file is actually readable
      const pathReadAccessErrorCode = await getPathReadAccessError(fp);
      if (pathReadAccessErrorCode != null) {
        let errorMessage;
        if (pathReadAccessErrorCode === 'ENOENT') errorMessage = i18n.t('The media you tried to open does not exist');
        else if (['EACCES', 'EPERM'].includes(pathReadAccessErrorCode)) errorMessage = i18n.t('You do not have permission to access this file');
        else errorMessage = i18n.t('Could not open media due to error {{errorCode}}', { errorCode: pathReadAccessErrorCode });
        errorToast(errorMessage);
        return;
      }

      // Not sure why this one is needed, but I think sometimes fs.access doesn't fail but it fails when actually trying to read
      if (!(await havePermissionToReadFile(fp))) {
        errorToast(i18n.t('You do not have permission to access this file'));
        return;
      }

      const fileMeta = await readFileMeta(fp);
      // console.log('file meta read', fileMeta);

      const fileFormatNew = await getSmarterOutFormat({ filePath: fp, fileMeta });

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

      const validDuration = isDurationValid(parseFloat(fileMeta.format.duration));

      const hevcPlaybackSupported = enableNativeHevc && await hevcPlaybackSupportedPromise;

      const mightNeedAutoHtml5ify = !willPlayerProperlyHandleVideo({ streams: fileMeta.streams, hevcPlaybackSupported }) && validDuration;

      // We may be be writing project file to input path's dir (if storeProjectInWorkingDir is true), or write html5ified file to input dir
      const { newCustomOutDir: cod, canceled } = await ensureWritableDirs({ inputPath: fp, checkInputDir: !storeProjectInWorkingDir || mightNeedAutoHtml5ify });
      if (canceled) return;

      const existingHtml5FriendlyFile = await findExistingHtml5FriendlyFile(fp, cod);

      const needsAutoHtml5ify = !existingHtml5FriendlyFile && mightNeedAutoHtml5ify;

      // BEGIN STATE UPDATES:

      console.log('loadMedia', fp, cod, projectPath);

      resetState();

      if (existingHtml5FriendlyFile) {
        console.log('Found existing html5 friendly file', existingHtml5FriendlyFile.path);
        setUsingDummyVideo(existingHtml5FriendlyFile.usingDummyVideo);
        setPreviewFilePath(existingHtml5FriendlyFile.path);
      }

      if (needsAutoHtml5ify) {
        // Try to auto-html5ify if there are known issues with this file
        // 'fastest' works with almost all video files
        await html5ifyAndLoadWithPreferences(cod, fp, 'fastest', haveVideoStream, haveAudioStream);
      }

      await tryOpenProject({ chapters: fileMeta.chapters });

      // throw new Error('test');

      if (timecode) setStartTimeOffset(timecode);
      setDetectedFps(haveVideoStream ? getStreamFps(videoStream) : undefined);
      setMainFileMeta({ streams: fileMeta.streams, formatData: fileMeta.format, chapters: fileMeta.chapters });
      setMainVideoStream(videoStream);
      setMainAudioStream(audioStream);
      setCopyStreamIdsForPath(fp, () => copyStreamIdsForPathNew);
      setFileFormat(outFormatLocked || fileFormatNew);
      setDetectedFileFormat(fileFormatNew);

      // only show one toast, or else we will only show the last one
      if (existingHtml5FriendlyFile) {
        showPreviewFileLoadedMessage(basename(existingHtml5FriendlyFile.path));
      } else if (needsAutoHtml5ify) {
        showUnsupportedFileMessage();
      } else if (isAudioDefinitelyNotSupported(fileMeta.streams)) {
        toast.fire({ icon: 'info', text: i18n.t('The audio track is not supported. You can convert to a supported format from the menu') });
      } else if (!validDuration) {
        toast.fire({ icon: 'warning', timer: 10000, text: i18n.t('This file does not have a valid duration. This may cause issues. You can try to fix the file\'s duration from the File menu') });
      }

      // This needs to be last, because it triggers <video> to load the video
      // If not, onVideoError might be triggered before setWorking() has been cleared.
      // https://github.com/mifi/lossless-cut/issues/515
      setFilePath(fp);
    } catch (err) {
      resetState();
      throw err;
    }
  }, [ensureWritableDirs, storeProjectInWorkingDir, resetState, setWorking, loadEdlFile, getEdlFilePath, getEdlFilePathOld, enableAskForImportChapters, loadCutSegments, autoLoadTimecode, enableNativeHevc, setCopyStreamIdsForPath, setFileFormat, outFormatLocked, setDetectedFileFormat, showPreviewFileLoadedMessage, html5ifyAndLoadWithPreferences, showUnsupportedFileMessage]);

  const toggleLastCommands = useCallback(() => setLastCommandsVisible(val => !val), []);
  const toggleSettings = useCallback(() => setSettingsVisible(val => !val), []);

  const jumpSeg = useCallback((val) => setCurrentSegIndex((old) => Math.max(Math.min(old + val, cutSegments.length - 1), 0)), [cutSegments.length, setCurrentSegIndex]);

  const seekClosestKeyframe = useCallback((direction) => {
    const time = findNearestKeyFrameTime({ time: getRelevantTime(), direction });
    if (time == null) return;
    seekAbs(time);
  }, [findNearestKeyFrameTime, getRelevantTime, seekAbs]);

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

    await loadMedia({ filePath: path, projectPath });
  }, [loadMedia]);

  // todo merge with userOpenFiles?
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
      const extractedPaths = await extractStreams({ customOutDir, filePath, streams: mainCopiedStreams, enableOverwriteOutput });
      if (!hideAllNotifications) openDirToast({ icon: 'success', filePath: extractedPaths[0], text: i18n.t('All streams have been extracted as separate files') });
    } catch (err) {
      if (err instanceof RefuseOverwriteError) {
        showRefuseToOverwrite();
        return;
      }
      errorToast(i18n.t('Failed to extract all streams'));
      console.error('Failed to extract all streams', err);
    } finally {
      setWorking();
    }
  }, [customOutDir, enableOverwriteOutput, filePath, hideAllNotifications, mainCopiedStreams, setWorking]);


  const userHtml5ifyCurrentFile = useCallback(async ({ ignoreRememberedValue } = {}) => {
    if (!filePath) return;

    let selectedOption = rememberConvertToSupportedFormat;
    if (selectedOption == null || ignoreRememberedValue) {
      const allHtml5ifyOptions = ['fastest', 'fastest-audio', 'fastest-audio-remux', 'fast-audio-remux', 'fast-audio', 'fast', 'slow', 'slow-audio', 'slowest'];
      let relevantOptions = [];
      if (hasAudio && hasVideo) relevantOptions = [...allHtml5ifyOptions];
      else if (hasAudio) relevantOptions = [...relevantOptions, 'fast-audio-remux', 'slow-audio', 'slowest'];
      else if (hasVideo) relevantOptions = [...relevantOptions, 'fastest', 'fast', 'slow', 'slowest'];

      const userResponse = await askForHtml5ifySpeed({ allowedOptions: allHtml5ifyOptions.filter((option) => relevantOptions.includes(option)), showRemember: true, initialOption: selectedOption });
      console.log('Choice', userResponse);
      ({ selectedOption } = userResponse);
      if (!selectedOption) return;

      const { remember } = userResponse;

      setRememberConvertToSupportedFormat(remember ? selectedOption : undefined);
    }

    if (workingRef.current) return;
    try {
      setWorking(i18n.t('Converting to supported format'));
      await html5ifyAndLoad(customOutDir, filePath, selectedOption, hasVideo, hasAudio);
    } catch (err) {
      errorToast(i18n.t('Failed to convert file. Try a different conversion'));
      console.error('Failed to html5ify file', err);
    } finally {
      setWorking();
    }
  }, [customOutDir, filePath, html5ifyAndLoad, hasVideo, hasAudio, rememberConvertToSupportedFormat, setWorking]);

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
      setCutProgress(0);
      const path = await fixInvalidDuration({ fileFormat, customOutDir, duration, onProgress: setCutProgress });
      toast.fire({ icon: 'info', text: i18n.t('Duration has been fixed') });

      await loadMedia({ filePath: path });
    } catch (err) {
      errorToast(i18n.t('Failed to fix file duration'));
      console.error('Failed to fix file duration', err);
    } finally {
      setWorking();
      setCutProgress();
    }
  }, [checkFileOpened, customOutDir, duration, fileFormat, fixInvalidDuration, loadMedia, setWorking]);

  const addStreamSourceFile = useCallback(async (path) => {
    if (allFilesMeta[path]) return undefined; // Already added?
    const fileMeta = await readFileMeta(path);
    // console.log('streams', fileMeta.streams);
    setExternalFilesMeta((old) => ({ ...old, [path]: { streams: fileMeta.streams, formatData: fileMeta.format, chapters: fileMeta.chapters } }));
    setCopyStreamIdsForPath(path, () => fromPairs(fileMeta.streams.map(({ index }) => [index, true])));
    return fileMeta;
  }, [allFilesMeta, setCopyStreamIdsForPath]);

  const addFileAsCoverArt = useCallback(async (path) => {
    const fileMeta = await addStreamSourceFile(path);
    if (!fileMeta) return false;
    const firstIndex = fileMeta.streams[0].index;
    setDispositionByStreamId((old) => ({ ...old, [path]: { [firstIndex]: 'attached_pic' } }));
    return true;
  }, [addStreamSourceFile]);

  const captureSnapshotAsCoverArt = useCallback(async () => {
    if (!filePath) return;
    try {
      const currentTime = getRelevantTime();
      const path = await captureFrameFromFfmpeg({ customOutDir, filePath, fromTime: currentTime, captureFormat, enableTransferTimestamps, quality: captureFrameQuality });
      if (!(await addFileAsCoverArt(path))) return;
      if (!hideAllNotifications) toast.fire({ text: i18n.t('Current frame has been set as cover art') });
    } catch (err) {
      console.error(err);
      errorToast(i18n.t('Failed to capture frame'));
    }
  }, [addFileAsCoverArt, captureFormat, captureFrameFromFfmpeg, captureFrameQuality, customOutDir, enableTransferTimestamps, filePath, getRelevantTime, hideAllNotifications]);

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

    [lastOpenedPath] = filePaths;

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
      const edlFormats = { csv: 'csv', pbf: 'pbf', edl: 'mplayer', cue: 'cue', xml: 'xmeml', fcpxml: 'fcpxml' };
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
      else if (isFileOpened) inputOptions.mergeWithCurrentFile = i18n.t('Merge/concatenate with current file');

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
        if (openFileResponse === 'mergeWithCurrentFile') {
          const batchPaths = new Set();
          if (filePath) batchPaths.add(filePath);
          filePaths.forEach((path) => batchPaths.add(path));
          batchLoadPaths([...batchPaths]);
          if (batchPaths.size > 1) setConcatDialogVisible(true);
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
  }, [alwaysConcatMultipleFiles, batchLoadPaths, setWorking, isFileOpened, batchFiles.length, userOpenSingleFile, checkFileOpened, loadEdlFile, enableAskForFileOpenAction, addStreamSourceFile, filePath]);

  const openFilesDialog = useCallback(async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'], defaultPath: lastOpenedPath });
    if (canceled) return;
    userOpenFiles(filePaths);
  }, [userOpenFiles]);

  const concatCurrentBatch = useCallback(() => {
    if (batchFiles.length < 2) {
      openFilesDialog();
      return;
    }

    setConcatDialogVisible(true);
  }, [batchFiles.length, openFilesDialog]);

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
      captureSnapshotAsCoverArt,
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
      toggleLastCommands: () => { toggleLastCommands(); return false; },
      export: onExportPress,
      extractCurrentSegmentFramesAsImages,
      reorderSegsByStartTime,
      invertAllSegments,
      fillSegmentsGaps,
      combineOverlappingSegments,
      createFixedDurationSegments,
      createNumSegments,
      createRandomSegments,
      alignSegmentTimesToKeyframes,
      shuffleSegments,
      clearSegments,
      toggleSegmentsList,
      toggleStreamsSelector,
      extractAllStreams,
      convertFormatCurrentFile: () => userHtml5ifyCurrentFile(),
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
      shiftAllSegmentTimes,
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
      setLastCommandsVisible(false);
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
  }, [addSegment, alignSegmentTimesToKeyframes, askSetStartTimeOffset, batchFileJump, batchOpenSelectedFile, captureSnapshot, captureSnapshotAsCoverArt, changePlaybackRate, cleanupFilesDialog, clearSegments, closeBatch, closeExportConfirm, combineOverlappingSegments, concatCurrentBatch, concatDialogVisible, convertFormatBatch, createFixedDurationSegments, createNumSegments, createRandomSegments, currentSegIndexSafe, cutSegmentsHistory, deselectAllSegments, exportConfirmVisible, extractAllStreams, extractCurrentSegmentFramesAsImages, fillSegmentsGaps, goToTimecode, increaseRotation, invertAllSegments, jumpCutEnd, jumpCutStart, jumpSeg, jumpTimelineEnd, jumpTimelineStart, keyboardNormalSeekSpeed, keyboardSeekAccFactor, keyboardShortcutsVisible, onExportConfirm, onExportPress, onLabelSegment, pause, play, removeCutSegment, removeSelectedSegments, reorderSegsByStartTime, seekClosestKeyframe, seekRel, seekRelPercent, selectAllSegments, selectOnlyCurrentSegment, setCutEnd, setCutStart, setPlaybackVolume, shiftAllSegmentTimes, shortStep, shuffleSegments, splitCurrentSegment, timelineToggleComfortZoom, toggleCaptureFormat, toggleCurrentSegmentSelected, toggleKeyboardShortcuts, toggleKeyframeCut, toggleLastCommands, togglePlay, toggleSegmentsList, toggleStreamsSelector, toggleStripAudio, tryFixInvalidDuration, userHtml5ifyCurrentFile, zoomRel]);

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
      const extractedPaths = await extractStreams({ customOutDir, filePath, streams: mainStreams.filter((s) => s.index === index), enableOverwriteOutput });
      if (!hideAllNotifications) openDirToast({ icon: 'success', filePath: extractedPaths[0], text: i18n.t('Track has been extracted') });
    } catch (err) {
      if (err instanceof RefuseOverwriteError) {
        showRefuseToOverwrite();
        return;
      }
      errorToast(i18n.t('Failed to extract track'));
      console.error('Failed to extract track', err);
    } finally {
      setWorking();
    }
  }, [customOutDir, enableOverwriteOutput, filePath, hideAllNotifications, mainStreams, setWorking]);

  const batchFilePaths = useMemo(() => batchFiles.map((f) => f.path), [batchFiles]);

  const onVideoError = useCallback(async () => {
    const { error } = videoRef.current;
    if (!error) return;
    if (!fileUri) return; // Probably MEDIA_ELEMENT_ERROR: Empty src attribute

    console.error('onVideoError', error.message, error.code);

    try {
      const PIPELINE_ERROR_DECODE = 3; // This usually happens when the user presses play or seeks, but the video is not actually playable. To reproduce: "RX100VII PCM audio timecode.MP4" or see https://github.com/mifi/lossless-cut/issues/804
      const MEDIA_ERR_SRC_NOT_SUPPORTED = 4; // Test: issue-668-3.20.1.m2ts - NOTE: DEMUXER_ERROR_COULD_NOT_OPEN and DEMUXER_ERROR_NO_SUPPORTED_STREAMS is also 4
      if (!([MEDIA_ERR_SRC_NOT_SUPPORTED, PIPELINE_ERROR_DECODE].includes(error.code) && !usingPreviewFile && filePath)) return;

      if (workingRef.current) return;
      try {
        setWorking(i18n.t('Converting to supported format'));

        console.log('Trying to create preview');

        if (!isDurationValid(await getDuration(filePath))) throw new Error('Invalid duration');

        if (hasVideo) {
          // "fastest" is the most likely type not to fail for video (but it is muted).
          await html5ifyAndLoadWithPreferences(customOutDir, filePath, 'fastest', hasVideo, hasAudio);
          showUnsupportedFileMessage();
        } else if (hasAudio) {
          // For audio do a fast re-encode
          await html5ifyAndLoadWithPreferences(customOutDir, filePath, 'fastest-audio', hasVideo, hasAudio);
          showUnsupportedFileMessage();
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
  }, [fileUri, usingPreviewFile, filePath, setWorking, hasVideo, hasAudio, html5ifyAndLoadWithPreferences, customOutDir, showUnsupportedFileMessage]);

  useEffect(() => {
    async function exportEdlFile2(e, type) {
      if (!checkFileOpened()) return;
      try {
        await exportEdlFile({ type, cutSegments, customOutDir, filePath, getFrameCount });
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

    const actions = {
      openFiles: (event, filePaths) => { userOpenFiles(filePaths.map(resolvePathIfNeeded)); },
      openFilesDialog,
      closeCurrentFile: () => { closeFileWithConfirm(); },
      closeBatchFiles: () => { closeBatch(); },
      html5ify: () => userHtml5ifyCurrentFile({ ignoreRememberedValue: true }),
      askSetStartTimeOffset,
      extractAllStreams,
      showStreamsSelector: () => setStreamsSelectorShown(true),
      importEdlFile,
      exportEdlFile: exportEdlFile2,
      exportEdlYouTube,
      toggleLastCommands,
      toggleKeyboardShortcuts,
      toggleSettings,
      openAbout,
      openSendReportDialog: () => { openSendReportDialogWithState(); },
      clearSegments,
      shuffleSegments,
      createNumSegments,
      createFixedDurationSegments,
      createRandomSegments,
      invertAllSegments,
      fillSegmentsGaps,
      combineOverlappingSegments,
      fixInvalidDuration: tryFixInvalidDuration,
      reorderSegsByStartTime,
      concatCurrentBatch,
      detectBlackScenes,
      detectSilentScenes,
      detectSceneChanges,
      createSegmentsFromKeyframes,
      shiftAllSegmentTimes,
      alignSegmentTimesToKeyframes,
    };

    const actionsWithCatch = Object.entries(actions).map(([key, action]) => [
      key,
      async (...args) => {
        try {
          await action(...args);
        } catch (err) {
          handleError(err);
        }
      },
    ]);

    actionsWithCatch.forEach(([key, action]) => electron.ipcRenderer.on(key, action));
    return () => actionsWithCatch.forEach(([key, action]) => electron.ipcRenderer.removeListener(key, action));
  }, [alignSegmentTimesToKeyframes, apparentCutSegments, askSetStartTimeOffset, checkFileOpened, clearSegments, closeBatch, closeFileWithConfirm, combineOverlappingSegments, concatCurrentBatch, createFixedDurationSegments, createNumSegments, createRandomSegments, createSegmentsFromKeyframes, customOutDir, cutSegments, detectBlackScenes, detectSceneChanges, detectSilentScenes, detectedFps, extractAllStreams, fileFormat, filePath, fillSegmentsGaps, getFrameCount, invertAllSegments, loadCutSegments, loadMedia, openFilesDialog, openSendReportDialogWithState, reorderSegsByStartTime, setWorking, shiftAllSegmentTimes, shuffleSegments, toggleKeyboardShortcuts, toggleLastCommands, toggleSettings, tryFixInvalidDuration, userHtml5ifyCurrentFile, userOpenFiles]);

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

  useEffect(() => {
    if (!isStoreBuild) loadMifiLink().then(setMifiLink);
  }, []);

  const haveCustomFfPath = !!customFfPath;
  useEffect(() => {
    runStartupCheck({ ffmpeg: !haveCustomFfPath });
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
            toggleSettings={toggleSettings}
            numStreamsToCopy={numStreamsToCopy}
            numStreamsTotal={numStreamsTotal}
            setStreamsSelectorShown={setStreamsSelectorShown}
            selectedSegments={selectedSegmentsOrInverse}
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
              {!isFileOpened && <NoFileLoaded mifiLink={mifiLink} currentCutSeg={currentCutSeg} />}

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
                {working && <Working text={working} cutProgress={cutProgress} onAbortClick={abortFfmpegs} />}
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
                  selectedSegments={selectedSegmentsOrInverse}
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

          <div className="no-user-select" style={bottomStyle}>
            <Timeline
              shouldShowKeyframes={shouldShowKeyframes}
              waveforms={waveforms}
              shouldShowWaveform={shouldShowWaveform}
              waveformEnabled={waveformEnabled}
              thumbnailsEnabled={thumbnailsEnabled}
              neighbouringKeyFrames={neighbouringKeyFrames}
              thumbnails={thumbnailsSorted}
              playerTime={playerTime}
              commandedTime={commandedTime}
              relevantTime={relevantTime}
              getRelevantTime={getRelevantTime}
              commandedTimeRef={commandedTimeRef}
              startTimeOffset={startTimeOffset}
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
              segmentsToExport={segmentsToExport}
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
              toggleTimelineMode={toggleTimelineMode}
              timelineMode={timelineMode}
              hasAudio={hasAudio}
              keyframesEnabled={keyframesEnabled}
              toggleKeyframesEnabled={toggleKeyframesEnabled}
              detectedFps={detectedFps}
            />
          </div>

          <SideSheet
            width={700}
            containerProps={{ style: { maxWidth: '100%' } }}
            position={Position.LEFT}
            isShown={streamsSelectorShown}
            onCloseComplete={() => setStreamsSelectorShown(false)}
          >
            {mainStreams && (
              <StreamsSelector
                mainFilePath={filePath}
                mainFileFormatData={mainFileFormatData}
                mainFileChapters={mainFileChapters}
                allFilesMeta={allFilesMeta}
                externalFilesMeta={externalFilesMeta}
                setExternalFilesMeta={setExternalFilesMeta}
                showAddStreamSourceDialog={showAddStreamSourceDialog}
                mainFileStreams={mainStreams}
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
            )}
          </SideSheet>

          <ExportConfirm filePath={filePath} areWeCutting={areWeCutting} nonFilteredSegments={nonFilteredSegments} selectedSegments={selectedSegmentsOrInverse} segmentsToExport={segmentsToExport} willMerge={willMerge} visible={exportConfirmVisible} onClosePress={closeExportConfirm} onExportConfirm={onExportConfirm} renderOutFmt={renderOutFmt} outputDir={outputDir} numStreamsTotal={numStreamsTotal} numStreamsToCopy={numStreamsToCopy} setStreamsSelectorShown={setStreamsSelectorShown} outFormat={fileFormat} setOutSegTemplate={setOutSegTemplate} outSegTemplate={outSegTemplateOrDefault} generateOutSegFileNames={generateOutSegFileNames} currentSegIndexSafe={currentSegIndexSafe} getOutSegError={getOutSegError} mainCopiedThumbnailStreams={mainCopiedThumbnailStreams} />

          <LastCommandsSheet
            visible={lastCommandsVisible}
            onTogglePress={toggleLastCommands}
            ffmpegCommandLog={ffmpegCommandLog}
          />

          <Sheet visible={settingsVisible} onClosePress={toggleSettings} style={{ background: 'white', color: 'black' }}>
            <Heading>{t('Keyboard & mouse shortcuts')}</Heading>
            <InlineAlert marginTop={20}>{t('Hover mouse over buttons in the main interface to see which function they have')}</InlineAlert>
            <Table style={{ marginTop: 20 }}>
              <Table.Head>
                <Table.TextHeaderCell>{t('Settings')}</Table.TextHeaderCell>
                <Table.TextHeaderCell>{t('Current setting')}</Table.TextHeaderCell>
              </Table.Head>
              <Table.Body>
                <Settings
                  onTunerRequested={onTunerRequested}
                  onKeyboardShortcutsDialogRequested={toggleKeyboardShortcuts}
                />
              </Table.Body>
            </Table>
          </Sheet>

          <ConcatDialog isShown={batchFiles.length > 0 && concatDialogVisible} onHide={() => setConcatDialogVisible(false)} paths={batchFilePaths} onConcat={userConcatFiles} setAlwaysConcatMultipleFiles={setAlwaysConcatMultipleFiles} alwaysConcatMultipleFiles={alwaysConcatMultipleFiles} />

          <KeyboardShortcuts isShown={keyboardShortcutsVisible} onHide={() => setKeyboardShortcutsVisible(false)} keyBindings={keyBindings} setKeyBindings={setKeyBindings} currentCutSeg={currentCutSeg} resetKeyBindings={resetKeyBindings} />
        </div>
      </ThemeProvider>
    </UserSettingsContext.Provider>
  );
});

export default App;
