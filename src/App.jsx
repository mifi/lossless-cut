import React, { memo, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { FaAngleLeft, FaWindowClose } from 'react-icons/fa';
import { MdRotate90DegreesCcw } from 'react-icons/md';
import { AnimatePresence } from 'framer-motion';
import { ThemeProvider } from 'evergreen-ui';
import useDebounceOld from 'react-use/lib/useDebounce'; // Want to phase out this
import { useDebounce } from 'use-debounce';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';
import { produce } from 'immer';
import screenfull from 'screenfull';

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
import useDirectoryAccess, { DirectoryAccessDeclinedError } from './hooks/useDirectoryAccess';

import { UserSettingsContext, SegColorsContext } from './contexts';

import NoFileLoaded from './NoFileLoaded';
import Canvas from './Canvas';
import TopMenu from './TopMenu';
import Sheet from './components/Sheet';
import LastCommandsSheet from './LastCommandsSheet';
import StreamsSelector from './StreamsSelector';
import SegmentList from './SegmentList';
import Settings from './components/Settings';
import Timeline from './Timeline';
import BottomBar from './BottomBar';
import ExportConfirm from './components/ExportConfirm';
import ValueTuners from './components/ValueTuners';
import VolumeControl from './components/VolumeControl';
import SubtitleControl from './components/SubtitleControl';
import BatchFilesList from './components/BatchFilesList';
import ConcatDialog from './components/ConcatDialog';
import KeyboardShortcuts from './components/KeyboardShortcuts';
import Working from './components/Working';
import OutputFormatSelect from './components/OutputFormatSelect';

import { loadMifiLink, runStartupCheck } from './mifi';
import { controlsBackground, darkModeTransition } from './colors';
import { getSegColor } from './util/colors';
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
import { formatYouTube, getFrameCountRaw, formatTsv } from './edlFormats';
import {
  getOutPath, getSuffixedOutPath, handleError, getOutDir,
  isStoreBuild, dragPreventer,
  havePermissionToReadFile, resolvePathIfNeeded, getPathReadAccessError, html5ifiedPrefix, html5dummySuffix, findExistingHtml5FriendlyFile,
  deleteFiles, isOutOfSpaceError, isExecaFailure, readFileSize, readFileSizes, checkFileSizes, setDocumentTitle, getOutFileExtension, getSuffixedFileName, mustDisallowVob, readVideoTs, getImportProjectType,
  calcShouldShowWaveform, calcShouldShowKeyframes,
} from './util';
import { toast, errorToast } from './swal';
import { formatDuration } from './util/duration';
import { adjustRate } from './util/rate-calculator';
import { askExtractFramesAsImages } from './dialogs/extractFrames';
import { askForHtml5ifySpeed } from './dialogs/html5ify';
import { askForOutDir, askForImportChapters, promptTimeOffset, askForFileOpenAction, confirmExtractAllStreamsDialog, showCleanupFilesDialog, showDiskFull, showExportFailedDialog, showConcatFailedDialog, openYouTubeChaptersDialog, showRefuseToOverwrite, openDirToast, openExportFinishedToast, openConcatFinishedToast, showOpenDialog } from './dialogs';
import { openSendReportDialog } from './reporting';
import { fallbackLng } from './i18n';
import { createSegment, getCleanCutSegments, findSegmentsAtCursor, sortSegments, convertSegmentsToChapters, hasAnySegmentOverlap, isDurationValid, playOnlyCurrentSegment, getSegmentTags } from './segments';
import { generateOutSegFileNames as generateOutSegFileNamesRaw, defaultOutSegTemplate } from './util/outputNameTemplate';
import { rightBarWidth, leftBarWidth, ffmpegExtractWindow, zoomMax } from './util/constants';
import BigWaveform from './components/BigWaveform';

import isDev from './isDev';

const electron = window.require('electron');
const { exists } = window.require('fs-extra');
const filePathToUrl = window.require('file-url');
const { parse: parsePath, join: pathJoin, basename, dirname } = window.require('path');

const remote = window.require('@electron/remote');
const { focusWindow, hasDisabledNetworking, quitApp } = remote.require('./electron');


const videoStyle = { width: '100%', height: '100%', objectFit: 'contain' };
const bottomStyle = { background: controlsBackground, transition: darkModeTransition };

const hevcPlaybackSupportedPromise = doesPlayerSupportHevcPlayback();
hevcPlaybackSupportedPromise.catch((err) => console.error(err));


function App() {
  // Per project state
  const [commandedTime, setCommandedTime] = useState(0);
  const [ffmpegCommandLog, setFfmpegCommandLog] = useState([]);

  const [previewFilePath, setPreviewFilePath] = useState();
  const [working, setWorkingState] = useState();
  const [usingDummyVideo, setUsingDummyVideo] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [canvasPlayerEventId, setCanvasPlayerEventId] = useState(0);
  const playbackModeRef = useRef();
  const [playerTime, setPlayerTime] = useState();
  const [duration, setDuration] = useState();
  const [rotation, setRotation] = useState(360);
  const [cutProgress, setCutProgress] = useState();
  const [startTimeOffset, setStartTimeOffset] = useState(0);
  const [filePath, setFilePath] = useState('');
  const [externalFilesMeta, setExternalFilesMeta] = useState({});
  const [customTagsByFile, setCustomTagsByFile] = useState({});
  const [paramsByStreamId, setParamsByStreamId] = useState(new Map());
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
  const [cacheBuster, setCacheBuster] = useState(0);
  const [mergedOutFileName, setMergedOutFileName] = useState();
  const [outputPlaybackRate, setOutputPlaybackRateState] = useState(1);

  const { fileFormat, setFileFormat, detectedFileFormat, setDetectedFileFormat, isCustomFormatSelected } = useFileFormatState();

  // State per application launch
  const lastOpenedPathRef = useRef();
  const [waveformMode, setWaveformMode] = useState();
  const [thumbnailsEnabled, setThumbnailsEnabled] = useState(false);
  const [keyframesEnabled, setKeyframesEnabled] = useState(true);
  const [showRightBar, setShowRightBar] = useState(true);
  const [rememberConvertToSupportedFormat, setRememberConvertToSupportedFormat] = useState();
  const [lastCommandsVisible, setLastCommandsVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [tunerVisible, setTunerVisible] = useState();
  const [keyboardShortcutsVisible, setKeyboardShortcutsVisible] = useState(false);
  const [mifiLink, setMifiLink] = useState();
  const [alwaysConcatMultipleFiles, setAlwaysConcatMultipleFiles] = useState(false);
  const [editingSegmentTagsSegmentIndex, setEditingSegmentTagsSegmentIndex] = useState();
  const [editingSegmentTags, setEditingSegmentTags] = useState();

  // Batch state / concat files
  const [batchFiles, setBatchFiles] = useState([]);
  const [selectedBatchFiles, setSelectedBatchFiles] = useState([]);

  // Store "working" in a ref so we can avoid race conditions
  const workingRef = useRef(!!working);
  const setWorking = useCallback((val) => {
    workingRef.current = !!val;
    setWorkingState(val ? { text: val.text, abortController: val.abortController } : undefined);
  }, []);

  const handleAbortWorkingClick = useCallback(() => {
    console.log('User clicked abort');
    abortFfmpegs(); // todo use abortcontroller for this also
    working?.abortController?.abort();
  }, [working?.abortController]);

  useEffect(() => setDocumentTitle({ filePath, working: working?.text, cutProgress }), [cutProgress, filePath, working?.text]);

  const zoom = Math.floor(zoomUnrounded);

  const durationSafe = isDurationValid(duration) ? duration : 1;
  const zoomedDuration = isDurationValid(duration) ? duration / zoom : undefined;

  const allUserSettings = useUserSettingsRoot();

  const {
    captureFormat, setCaptureFormat, customOutDir, setCustomOutDir, keyframeCut, setKeyframeCut, preserveMovData, setPreserveMovData, movFastStart, setMovFastStart, avoidNegativeTs, autoMerge, timecodeFormat, invertCutSegments, setInvertCutSegments, autoExportExtraStreams, askBeforeClose, enableAskForImportChapters, enableAskForFileOpenAction, playbackVolume, setPlaybackVolume, autoSaveProjectFile, wheelSensitivity, invertTimelineScroll, language, ffmpegExperimental, hideNotifications, autoLoadTimecode, autoDeleteMergedSegments, exportConfirmEnabled, setExportConfirmEnabled, segmentsToChapters, setSegmentsToChapters, preserveMetadataOnMerge, setPreserveMetadataOnMerge, simpleMode, setSimpleMode, outSegTemplate, setOutSegTemplate, keyboardSeekAccFactor, keyboardNormalSeekSpeed, treatInputFileModifiedTimeAsStart, treatOutputFileModifiedTimeAsStart, outFormatLocked, setOutFormatLocked, safeOutputFileName, setSafeOutputFileName, enableAutoHtml5ify, segmentsToChaptersOnly, keyBindings, setKeyBindings, resetKeyBindings, enableSmartCut, customFfPath, storeProjectInWorkingDir, setStoreProjectInWorkingDir, enableOverwriteOutput, mouseWheelZoomModifierKey, captureFrameMethod, captureFrameQuality, captureFrameFileNameFormat, enableNativeHevc, cleanupChoices, setCleanupChoices, darkMode, setDarkMode, preferStrongColors, outputFileNameMinZeroPadding,
  } = allUserSettings;

  useEffect(() => {
    ffmpegSetCustomFfPath(customFfPath);
  }, [customFfPath]);

  const outSegTemplateOrDefault = outSegTemplate || defaultOutSegTemplate;

  useEffect(() => {
    const l = language || fallbackLng;
    i18n.changeLanguage(l).catch(console.error);
    electron.ipcRenderer.send('setLanguage', l);
  }, [language]);

  const videoRef = useRef();
  const videoContainerRef = useRef();

  const setOutputPlaybackRate = useCallback((v) => {
    setOutputPlaybackRateState(v);
    if (videoRef.current) videoRef.current.playbackRate = v;
  }, []);

  const isFileOpened = !!filePath;

  const onOutputFormatUserChange = useCallback((newFormat) => {
    setFileFormat(newFormat);
    if (outFormatLocked) {
      setOutFormatLocked(newFormat === detectedFileFormat ? undefined : newFormat);
    }
  }, [detectedFileFormat, outFormatLocked, setFileFormat, setOutFormatLocked]);

  const toggleShowThumbnails = useCallback(() => setThumbnailsEnabled((v) => !v), []);

  const toggleExportConfirmEnabled = useCallback(() => setExportConfirmEnabled((v) => {
    const newVal = !v;
    toast.fire({ text: newVal ? i18n.t('Export options will be shown before exporting.') : i18n.t('Export options will not be shown before exporting.') });
    return newVal;
  }), [setExportConfirmEnabled]);

  const toggleSegmentsToChapters = useCallback(() => setSegmentsToChapters((v) => !v), [setSegmentsToChapters]);

  const togglePreserveMetadataOnMerge = useCallback(() => setPreserveMetadataOnMerge((v) => !v), [setPreserveMetadataOnMerge]);

  const toggleShowKeyframes = useCallback(() => {
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

  const toggleWaveformMode = useCallback(() => {
    if (waveformMode === 'waveform') {
      setWaveformMode('big-waveform');
    } else if (waveformMode === 'big-waveform') {
      setWaveformMode();
    } else {
      if (!hideAllNotifications) toast.fire({ text: i18n.t('Mini-waveform has been enabled. Click again to enable full-screen waveform') });
      setWaveformMode('waveform');
    }
  }, [hideAllNotifications, waveformMode]);

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
    setCanvasPlayerEventId((id) => id + 1); // To make sure that we can seek even to the same commanded time that we are already add (e.g. loop current segment)
  }, []);

  const userSeekAbs = useCallback((val) => {
    playbackModeRef.current = undefined; // If the user seeks, we clear any custom playback mode
    return seekAbs(val);
  }, [seekAbs]);

  const commandedTimeRef = useRef(commandedTime);
  useEffect(() => {
    commandedTimeRef.current = commandedTime;
  }, [commandedTime]);

  const seekRel = useCallback((val) => {
    userSeekAbs(videoRef.current.currentTime + val);
  }, [userSeekAbs]);

  const seekRelPercent = useCallback((val) => {
    if (!isDurationValid(zoomedDuration)) return;
    seekRel(val * zoomedDuration);
  }, [seekRel, zoomedDuration]);

  const shortStep = useCallback((direction) => {
    // If we don't know fps, just assume 30 (for example if unknown audio file)
    const fps = detectedFps || 30;

    // try to align with frame
    const currentTimeNearestFrameNumber = getFrameCountRaw(fps, videoRef.current.currentTime);
    const nextFrame = currentTimeNearestFrameNumber + direction;
    userSeekAbs(nextFrame / fps);
  }, [detectedFps, userSeekAbs]);

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
    cutSegments, cutSegmentsHistory, createSegmentsFromKeyframes, shuffleSegments, detectBlackScenes, detectSilentScenes, detectSceneChanges, removeCutSegment, invertAllSegments, fillSegmentsGaps, combineOverlappingSegments, combineSelectedSegments, shiftAllSegmentTimes, alignSegmentTimesToKeyframes, updateSegOrder, updateSegOrders, reorderSegsByStartTime, addSegment, setCutStart, setCutEnd, onLabelSegment, splitCurrentSegment, createNumSegments, createFixedDurationSegments, createRandomSegments, apparentCutSegments, haveInvalidSegs, currentSegIndexSafe, currentCutSeg, currentApparentCutSeg, inverseCutSegments, clearSegments, loadCutSegments, isSegmentSelected, setCutTime, setCurrentSegIndex, onLabelSelectedSegments, deselectAllSegments, selectAllSegments, selectOnlyCurrentSegment, toggleCurrentSegmentSelected, invertSelectedSegments, removeSelectedSegments, setDeselectedSegmentIds, onSelectSegmentsByLabel, onSelectSegmentsByTag, toggleSegmentSelected, selectOnlySegment, getApparentCutSegmentById, selectedSegments, selectedSegmentsOrInverse, nonFilteredSegmentsOrInverse, segmentsToExport, duplicateCurrentSegment, duplicateSegment, updateSegAtIndex,
  } = useSegments({ filePath, workingRef, setWorking, setCutProgress, mainVideoStream, duration, getRelevantTime, maxLabelLength, checkFileOpened, invertCutSegments, segmentsToChaptersOnly });

  const jumpSegStart = useCallback((index) => userSeekAbs(apparentCutSegments[index].start), [apparentCutSegments, userSeekAbs]);
  const jumpSegEnd = useCallback((index) => userSeekAbs(apparentCutSegments[index].end), [apparentCutSegments, userSeekAbs]);
  const jumpCutStart = useCallback(() => jumpSegStart(currentSegIndexSafe), [currentSegIndexSafe, jumpSegStart]);
  const jumpCutEnd = useCallback(() => jumpSegEnd(currentSegIndexSafe), [currentSegIndexSafe, jumpSegEnd]);
  const jumpTimelineStart = useCallback(() => userSeekAbs(0), [userSeekAbs]);
  const jumpTimelineEnd = useCallback(() => userSeekAbs(durationSafe), [durationSafe, userSeekAbs]);


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

  const formatTimeAndFrames = useCallback((seconds) => {
    const frameCount = getFrameCount(seconds);

    const timeStr = timecodeFormat === 'timecodeWithFramesFraction'
      ? formatDuration({ seconds, fps: detectedFps })
      : formatDuration({ seconds });

    return `${timeStr} (${frameCount ?? '0'})`;
  }, [detectedFps, timecodeFormat, getFrameCount]);

  const { captureFrameFromTag, captureFrameFromFfmpeg, captureFramesRange } = useFrameCapture({ formatTimecode, treatOutputFileModifiedTimeAsStart });

  // const getSafeCutTime = useCallback((cutTime, next) => ffmpeg.getSafeCutTime(neighbouringFrames, cutTime, next), [neighbouringFrames]);

  const outputDir = getOutDir(customOutDir, filePath);

  const usingPreviewFile = !!previewFilePath;
  const effectiveFilePath = previewFilePath || filePath;
  const fileUri = useMemo(() => {
    if (!effectiveFilePath) return '';
    const uri = filePathToUrl(effectiveFilePath);
    // https://github.com/mifi/lossless-cut/issues/1674
    if (cacheBuster !== 0) {
      const qs = new URLSearchParams();
      qs.set('t', cacheBuster);
      return `${uri}?${qs.toString()}`;
    }
    return uri;
  }, [cacheBuster, effectiveFilePath]);

  const projectSuffix = 'proj.llc';
  const oldProjectSuffix = 'llc-edl.csv';
  // New LLC format can be stored along with input file or in working dir (customOutDir)
  const getEdlFilePath = useCallback((fp, cod) => getSuffixedOutPath({ customOutDir: cod, filePath: fp, nameSuffix: projectSuffix }), []);
  // Old versions of LosslessCut used CSV files and stored them always in customOutDir:
  const getEdlFilePathOld = useCallback((fp, cod) => getSuffixedOutPath({ customOutDir: cod, filePath: fp, nameSuffix: oldProjectSuffix }), []);
  const getProjectFileSavePath = useCallback((storeProjectInWorkingDirIn) => getEdlFilePath(filePath, storeProjectInWorkingDirIn ? customOutDir : undefined), [getEdlFilePath, filePath, customOutDir]);
  const projectFileSavePath = useMemo(() => getProjectFileSavePath(storeProjectInWorkingDir), [getProjectFileSavePath, storeProjectInWorkingDir]);

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
        console.error('Failed to save project file', err);
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

  const onStopPlaying = useCallback(() => {
    onPlayingChange(false);
    playbackModeRef.current = undefined;
  }, []);

  const onVideoAbort = useCallback(() => {
    setPlaying(false); // we want to preserve current time https://github.com/mifi/lossless-cut/issues/1674#issuecomment-1658937716
    playbackModeRef.current = undefined;
  }, []);

  const onSartPlaying = useCallback(() => onPlayingChange(true), []);
  const onDurationChange = useCallback((e) => {
    // Some files report duration infinity first, then proper duration later
    // Sometimes after seeking to end of file, duration might change
    const { duration: durationNew } = e.target;
    console.log('onDurationChange', durationNew);
    if (isDurationValid(durationNew)) setDuration(durationNew);
  }, []);

  const increaseRotation = useCallback(() => {
    setRotation((r) => (r + 90) % 450);
    setHideCanvasPreview(false);
    // Matroska is known not to work, so we warn user. See https://github.com/mifi/lossless-cut/discussions/661
    const supportsRotation = !['matroska', 'webm'].includes(fileFormat);
    if (!supportsRotation && !hideAllNotifications) toast.fire({ text: i18n.t('Lossless rotation might not work with this file format. You may try changing to MP4') });
  }, [hideAllNotifications, fileFormat]);

  const { ensureWritableOutDir, ensureAccessToSourceDir } = useDirectoryAccess({ setCustomOutDir });

  const toggleCaptureFormat = useCallback(() => setCaptureFormat((f) => {
    const captureFormats = ['jpeg', 'png', 'webp'];
    let index = captureFormats.indexOf(f);
    if (index === -1) index = 0;
    index += 1;
    if (index >= captureFormats.length) index = 0;
    return captureFormats[index];
  }), [setCaptureFormat]);

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

  const changeOutDir = useCallback(async () => {
    const newOutDir = await askForOutDir(outputDir);
    if (newOutDir) setCustomOutDir(newOutDir);
  }, [outputDir, setCustomOutDir]);

  const clearOutDir = useCallback(async () => {
    try {
      await ensureWritableOutDir({ inputPath: filePath, outDir: undefined });
      setCustomOutDir();
    } catch (err) {
      if (err instanceof DirectoryAccessDeclinedError) return;
      throw err;
    }
  }, [ensureWritableOutDir, filePath, setCustomOutDir]);

  const toggleStoreProjectInWorkingDir = useCallback(async () => {
    const newValue = !storeProjectInWorkingDir;
    const path = getProjectFileSavePath(newValue);
    if (path) { // path will be falsy if no file loaded
      try {
        await ensureAccessToSourceDir(path);
      } catch (err) {
        if (err instanceof DirectoryAccessDeclinedError) return;
        console.error(err);
      }
    }
    setStoreProjectInWorkingDir(newValue);
  }, [ensureAccessToSourceDir, getProjectFileSavePath, setStoreProjectInWorkingDir, storeProjectInWorkingDir]);

  const userSettingsContext = useMemo(() => ({
    ...allUserSettings, toggleCaptureFormat, changeOutDir, toggleKeyframeCut, togglePreserveMovData, toggleMovFastStart, toggleExportConfirmEnabled, toggleSegmentsToChapters, togglePreserveMetadataOnMerge, toggleSimpleMode, toggleSafeOutputFileName, effectiveExportMode,
  }), [allUserSettings, changeOutDir, effectiveExportMode, toggleCaptureFormat, toggleExportConfirmEnabled, toggleKeyframeCut, toggleMovFastStart, togglePreserveMetadataOnMerge, togglePreserveMovData, toggleSafeOutputFileName, toggleSegmentsToChapters, toggleSimpleMode]);

  const segColorsContext = useMemo(() => ({
    getSegColor: (seg) => {
      const color = getSegColor(seg);
      return preferStrongColors ? color.desaturate(0.2) : color.desaturate(0.6);
    },
  }), [preferStrongColors]);

  const isCopyingStreamId = useCallback((path, streamId) => (
    !!(copyStreamIdsByFile[path] || {})[streamId]
  ), [copyStreamIdsByFile]);

  const mainStreams = useMemo(() => mainFileMeta.streams, [mainFileMeta.streams]);
  const mainFileFormatData = useMemo(() => mainFileMeta.formatData, [mainFileMeta.formatData]);
  const mainFileChapters = useMemo(() => mainFileMeta.chapters, [mainFileMeta.chapters]);

  const checkCopyingAnyTrackOfType = useCallback((filter) => mainStreams.some(stream => isCopyingStreamId(filePath, stream.index) && filter(stream)), [filePath, isCopyingStreamId, mainStreams]);
  const copyAnyAudioTrack = useMemo(() => checkCopyingAnyTrackOfType((stream) => stream.codec_type === 'audio'), [checkCopyingAnyTrackOfType]);

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
      setWorking({ text: i18n.t('Loading subtitle') });
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
    streamIds: Object.entries(streamIdsMap).filter(([, shouldCopy]) => shouldCopy).map(([streamIdStr]) => parseInt(streamIdStr, 10)),
  })), [copyStreamIdsByFile]);

  // total number of streams to copy for ALL files
  const numStreamsToCopy = useMemo(() => copyFileStreams.reduce((acc, { streamIds }) => acc + streamIds.length, 0), [copyFileStreams]);

  const allFilesMeta = useMemo(() => ({
    ...externalFilesMeta,
    [filePath]: mainFileMeta,
  }), [externalFilesMeta, filePath, mainFileMeta]);

  // total number of streams for ALL files
  const numStreamsTotal = flatMap(Object.values(allFilesMeta), ({ streams }) => streams).length;

  const toggleStripStream = useCallback((filter) => {
    const copyingAnyTrackOfType = checkCopyingAnyTrackOfType(filter);
    setCopyStreamIdsForPath(filePath, (old) => {
      const newCopyStreamIds = { ...old };
      mainStreams.forEach((stream) => {
        if (filter(stream)) newCopyStreamIds[stream.index] = !copyingAnyTrackOfType;
      });
      return newCopyStreamIds;
    });
  }, [checkCopyingAnyTrackOfType, filePath, mainStreams, setCopyStreamIdsForPath]);

  const toggleStripAudio = useCallback(() => toggleStripStream((stream) => stream.codec_type === 'audio'), [toggleStripStream]);
  const toggleStripThumbnail = useCallback(() => toggleStripStream(isStreamThumbnail), [toggleStripStream]);

  const thumnailsRef = useRef([]);
  const thumnailsRenderingPromiseRef = useRef();

  function addThumbnail(thumbnail) {
    // console.log('Rendered thumbnail', thumbnail.url);
    setThumbnails(v => [...v, thumbnail]);
  }

  const hasAudio = !!mainAudioStream;
  const hasVideo = !!mainVideoStream;

  const waveformEnabled = hasAudio && ['waveform', 'big-waveform'].includes(waveformMode);
  const bigWaveformEnabled = waveformEnabled && waveformMode === 'big-waveform';
  const showThumbnails = thumbnailsEnabled && hasVideo;

  const [, cancelRenderThumbnails] = useDebounceOld(() => {
    async function renderThumbnails() {
      if (!showThumbnails || thumnailsRenderingPromiseRef.current) return;

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
  }, 500, [zoomedDuration, filePath, zoomWindowStartTime, showThumbnails]);

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

  const shouldShowKeyframes = keyframesEnabled && hasVideo && calcShouldShowKeyframes(zoomedDuration);
  const shouldShowWaveform = calcShouldShowWaveform(zoomedDuration);

  const { neighbouringKeyFrames, findNearestKeyFrameTime } = useKeyframes({ keyframesEnabled, filePath, commandedTime, mainVideoStream, detectedFps, ffmpegExtractWindow });
  const { waveforms } = useWaveform({ darkMode, filePath, relevantTime, waveformEnabled, mainAudioStream, shouldShowWaveform, ffmpegExtractWindow, durationSafe });

  const resetMergedOutFileName = useCallback(() => {
    const ext = getOutFileExtension({ isCustomFormatSelected, outFormat: fileFormat, filePath });
    const outFileName = getSuffixedFileName(filePath, `cut-merged-${new Date().getTime()}${ext}`);
    setMergedOutFileName(outFileName);
  }, [fileFormat, filePath, isCustomFormatSelected]);

  useEffect(() => resetMergedOutFileName(), [resetMergedOutFileName]);

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
    playbackModeRef.current = undefined;
    setCanvasPlayerEventId(0);
    setDuration();
    cutSegmentsHistory.go(0);
    clearSegments();
    setFileFormat();
    setDetectedFileFormat();
    setRotation(360);
    setCutProgress();
    setStartTimeOffset(0);
    setFilePath(''); // Setting video src="" prevents memory leak in chromium
    setExternalFilesMeta({});
    setCustomTagsByFile({});
    setParamsByStreamId(new Map());
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
    resetMergedOutFileName();
    setOutputPlaybackRateState(1);

    cancelRenderThumbnails();
  }, [cutSegmentsHistory, clearSegments, setFileFormat, setDetectedFileFormat, setDeselectedSegmentIds, resetMergedOutFileName, cancelRenderThumbnails]);


  const showUnsupportedFileMessage = useCallback(() => {
    if (!hideAllNotifications) toast.fire({ timer: 13000, text: i18n.t('File not natively supported. Preview may have no audio or low quality. The final export will however be lossless with audio. You may convert it from the menu for a better preview with audio.') });
  }, [hideAllNotifications]);

  const showPreviewFileLoadedMessage = useCallback((fileName) => {
    if (!hideAllNotifications) toast.fire({ icon: 'info', text: i18n.t('Loaded existing preview file: {{ fileName }}', { fileName }) });
  }, [hideAllNotifications]);

  const areWeCutting = useMemo(() => segmentsToExport.some(({ start, end }) => isCuttingStart(start) || isCuttingEnd(end, duration)), [duration, segmentsToExport]);
  const needSmartCut = !!(areWeCutting && enableSmartCut);

  const {
    concatFiles, html5ifyDummy, cutMultiple, autoConcatCutSegments, html5ify, fixInvalidDuration,
  } = useFfmpegOperations({ filePath, treatInputFileModifiedTimeAsStart, treatOutputFileModifiedTimeAsStart, needSmartCut, enableOverwriteOutput, outputPlaybackRate });

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
      setWorking({ text: i18n.t('Batch converting to supported format') });
      setCutProgress(0);

      // eslint-disable-next-line no-restricted-syntax
      for (const path of filePaths) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const newCustomOutDir = await ensureWritableOutDir({ inputPath: path, outDir: customOutDir });

          // eslint-disable-next-line no-await-in-loop
          await html5ify({ customOutDir: newCustomOutDir, filePath: path, speed, hasAudio: true, hasVideo: true, onProgress: setTotalProgress });
        } catch (err2) {
          if (err2 instanceof DirectoryAccessDeclinedError) return;

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
  }, [batchFiles, customOutDir, ensureWritableOutDir, html5ify, setWorking]);

  const getConvertToSupportedFormat = useCallback((fallback) => rememberConvertToSupportedFormat || fallback, [rememberConvertToSupportedFormat]);

  const html5ifyAndLoadWithPreferences = useCallback(async (cod, fp, speed, hv, ha) => {
    if (!enableAutoHtml5ify) return;
    setWorking({ text: i18n.t('Converting to supported format') });
    await html5ifyAndLoad(cod, fp, getConvertToSupportedFormat(speed), hv, ha);
  }, [enableAutoHtml5ify, setWorking, html5ifyAndLoad, getConvertToSupportedFormat]);

  const showPlaybackFailedMessage = () => errorToast(i18n.t('Unable to playback this file. Try to convert to supported format from the menu'));

  const getNewJumpIndex = (oldIndex, direction) => Math.max(oldIndex + direction, 0);
  const jumpSeg = useCallback((direction) => setCurrentSegIndex((old) => Math.min(getNewJumpIndex(old, direction), cutSegments.length - 1)), [cutSegments, setCurrentSegIndex]);

  const pause = useCallback(() => {
    if (!filePath || !playing) return;
    videoRef.current.pause();
  }, [filePath, playing]);

  const play = useCallback((resetPlaybackRate) => {
    if (!filePath || playing) return;

    const video = videoRef.current;

    // This was added to re-sync time if file gets reloaded #1674 - but I had to remove this because it broke loop-selected-segments https://github.com/mifi/lossless-cut/discussions/1785#discussioncomment-7852134
    // if (Math.abs(commandedTimeRef.current - video.currentTime) > 1) video.currentTime = commandedTimeRef.current;

    if (resetPlaybackRate) video.playbackRate = outputPlaybackRate;
    video.play().catch((err) => {
      showPlaybackFailedMessage();
      console.error(err);
    });
  }, [filePath, outputPlaybackRate, playing]);

  const togglePlay = useCallback(({ resetPlaybackRate, playbackMode } = {}) => {
    playbackModeRef.current = undefined;
    if (playing) {
      pause();
      return;
    }
    if (playbackMode != null) {
      if (playbackMode === 'loop-selected-segments') {
        const firstSelectedSegment = selectedSegments[0];
        playbackModeRef.current = { segId: firstSelectedSegment.segId, playbackMode };
        const index = apparentCutSegments.indexOf(firstSelectedSegment);
        if (index >= 0) setCurrentSegIndex(index);
        seekAbs(firstSelectedSegment.start);
      } else {
        playbackModeRef.current = { segId: currentApparentCutSeg.segId, playbackMode };
        seekAbs(currentApparentCutSeg.start);
      }
    }
    play(resetPlaybackRate);
  }, [playing, play, pause, selectedSegments, apparentCutSegments, setCurrentSegIndex, seekAbs, currentApparentCutSeg.segId, currentApparentCutSeg.start]);

  const onTimeUpdate = useCallback((e) => {
    const { currentTime } = e.target;
    if (playerTime === currentTime) return;
    setPlayerTime(currentTime);

    if (playbackModeRef.current != null) {
      const { segId, playbackMode } = playbackModeRef.current;
      const playingSegment = getApparentCutSegmentById(segId);

      if (playingSegment != null) {
        const { seek, stop, nextSegment } = playOnlyCurrentSegment({ playbackMode, currentTime, playingSegment });
        // console.log({ seek, stop, nextSegment });

        if (nextSegment != null) {
          const index = selectedSegments.indexOf(playingSegment);
          let newIndex = getNewJumpIndex(index >= 0 ? index : 0, 1);
          if (newIndex > selectedSegments.length - 1) newIndex = 0; // have reached end of last segment, start over
          const nextSelectedSegment = selectedSegments[newIndex];
          if (nextSelectedSegment != null) seekAbs(nextSelectedSegment.start);
          playbackModeRef.current.segId = nextSelectedSegment.segId;
        }
        if (seek != null) seekAbs(seek);
        if (stop) {
          playbackModeRef.current = undefined;
          pause();
        }
      }
    }
  }, [getApparentCutSegmentById, pause, playerTime, seekAbs, selectedSegments]);

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

  const batchListRemoveFile = useCallback((path) => {
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

  const userConcatFiles = useCallback(async ({ paths, includeAllStreams, streams, fileFormat: outFormat, outFileName, clearBatchFilesAfterConcat }) => {
    if (workingRef.current) return;
    try {
      setConcatDialogVisible(false);
      setWorking({ text: i18n.t('Merging') });

      const firstPath = paths[0];
      if (!firstPath) return;

      const newCustomOutDir = await ensureWritableOutDir({ inputPath: firstPath, outDir: customOutDir });

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
      if (err instanceof DirectoryAccessDeclinedError) return;

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
  }, [setWorking, ensureWritableOutDir, customOutDir, segmentsToChapters, concatFiles, ffmpegExperimental, preserveMovData, movFastStart, preserveMetadataOnMerge, closeBatch, hideAllNotifications, handleConcatFailed]);

  const cleanupFiles = useCallback(async (cleanupChoices2) => {
    // Store paths before we reset state
    const savedPaths = { previewFilePath, sourceFilePath: filePath, projectFilePath: projectFileSavePath };

    if (cleanupChoices2.closeFile) {
      batchListRemoveFile(savedPaths.sourceFilePath);

      // close the file
      resetState();
    }

    try {
      const abortController = new AbortController();
      setWorking({ text: i18n.t('Cleaning up'), abortController });
      console.log('Cleaning up files', cleanupChoices2);

      const pathsToDelete = [];
      if (cleanupChoices2.trashTmpFiles && savedPaths.previewFilePath) pathsToDelete.push(savedPaths.previewFilePath);
      if (cleanupChoices2.trashProjectFile && savedPaths.projectFilePath) pathsToDelete.push(savedPaths.projectFilePath);
      if (cleanupChoices2.trashSourceFile && savedPaths.sourceFilePath) pathsToDelete.push(savedPaths.sourceFilePath);

      await deleteFiles({ paths: pathsToDelete, deleteIfTrashFails: cleanupChoices2.deleteIfTrashFails, signal: abortController.signal });
    } catch (err) {
      errorToast(i18n.t('Unable to delete file: {{message}}', { message: err.message }));
      console.error(err);
    }
  }, [batchListRemoveFile, filePath, previewFilePath, projectFileSavePath, resetState, setWorking]);

  const askForCleanupChoices = useCallback(async () => {
    const trashResponse = await showCleanupFilesDialog(cleanupChoices);
    if (!trashResponse) return undefined; // Canceled
    setCleanupChoices(trashResponse); // Store for next time
    return trashResponse;
  }, [cleanupChoices, setCleanupChoices]);

  const cleanupFilesWithDialog = useCallback(async () => {
    let response = cleanupChoices;
    if (cleanupChoices.askForCleanup) {
      response = await askForCleanupChoices();
      console.log('trashResponse', response);
      if (!response) return; // Canceled
    }

    await cleanupFiles(response);
  }, [askForCleanupChoices, cleanupChoices, cleanupFiles]);

  const cleanupFilesDialog = useCallback(async () => {
    if (!isFileOpened) return;
    if (workingRef.current) return;

    try {
      await cleanupFilesWithDialog();
    } finally {
      setWorking();
    }
  }, [cleanupFilesWithDialog, isFileOpened, setWorking]);

  const generateOutSegFileNames = useCallback(({ segments = segmentsToExport, template, forceSafeOutputFileName }) => (
    generateOutSegFileNamesRaw({ segments, template, forceSafeOutputFileName, formatTimecode, isCustomFormatSelected, fileFormat, filePath, outputDir, safeOutputFileName, maxLabelLength, outputFileNameMinZeroPadding })
  ), [fileFormat, filePath, formatTimecode, isCustomFormatSelected, maxLabelLength, outputDir, outputFileNameMinZeroPadding, safeOutputFileName, segmentsToExport]);

  const closeExportConfirm = useCallback(() => setExportConfirmVisible(false), []);

  const willMerge = segmentsToExport.length > 1 && autoMerge;

  const mergedOutFilePath = useMemo(() => (
    getOutPath({ customOutDir, filePath, fileName: mergedOutFileName })
  ), [customOutDir, filePath, mergedOutFileName]);

  const onExportConfirm = useCallback(async () => {
    if (numStreamsToCopy === 0) {
      errorToast(i18n.t('No tracks selected for export'));
      return;
    }

    if (segmentsToExport.length < 1) {
      return;
    }

    if (haveInvalidSegs) {
      errorToast(i18n.t('Start time must be before end time'));
      return;
    }

    setStreamsSelectorShown(false);
    setExportConfirmVisible(false);

    if (workingRef.current) return;
    try {
      setWorking({ text: i18n.t('Exporting') });

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

      const { outSegFileNames, outSegError } = generateOutSegFileNames({ segments: segmentsToExport, template: outSegTemplateOrDefault });
      if (outSegError != null) {
        console.warn('Output segments file name invalid, using default instead', outSegFileNames);
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
        outSegFileNames,
        onProgress: setCutProgress,
        appendFfmpegCommandLog,
        shortestFlag,
        ffmpegExperimental,
        preserveMovData,
        preserveMetadataOnMerge,
        movFastStart,
        avoidNegativeTs,
        customTagsByFile,
        paramsByStreamId,
        chapters: chaptersToAdd,
        detectedFps,
      });

      if (willMerge) {
        setCutProgress(0);
        setWorking({ text: i18n.t('Merging') });

        const chapterNames = segmentsToChapters && !invertCutSegments ? segmentsToExport.map((s) => s.name) : undefined;

        await autoConcatCutSegments({
          customOutDir,
          outFormat: fileFormat,
          segmentPaths: outFiles,
          ffmpegExperimental,
          preserveMovData,
          movFastStart,
          onProgress: setCutProgress,
          chapterNames,
          autoDeleteMergedSegments,
          preserveMetadataOnMerge,
          appendFfmpegCommandLog,
          mergedOutFilePath,
        });
      }

      const notices = [];
      const warnings = [];

      if (!enableOverwriteOutput) warnings.push(i18n.t('Overwrite output setting is disabled and some files might have been skipped.'));

      if (!exportConfirmEnabled) notices.push(i18n.t('Export options are not shown. You can enable export options by clicking the icon right next to the export button.'));

      // https://github.com/mifi/lossless-cut/issues/329
      if (isIphoneHevc(mainFileFormatData, mainStreams)) warnings.push(i18n.t('There is a known issue with cutting iPhone HEVC videos. The output file may not work in all players.'));

      // https://github.com/mifi/lossless-cut/issues/280
      if (!ffmpegExperimental && isProblematicAvc1(fileFormat, mainStreams)) warnings.push(i18n.t('There is a known problem with this file type, and the output might not be playable. You can work around this problem by enabling the "Experimental flag" under Settings.'));

      if (exportExtraStreams) {
        try {
          setCutProgress(); // If extracting extra streams takes a long time, prevent loader from being stuck at 100%
          setWorking({ text: i18n.t('Extracting {{count}} unprocessable tracks', { count: nonCopiedExtraStreams.length }) });
          await extractStreams({ filePath, customOutDir, streams: nonCopiedExtraStreams, enableOverwriteOutput });
          notices.push(i18n.t('Unprocessable streams were exported as separate files.'));
        } catch (err) {
          console.error('Extra stream export failed', err);
          warnings.push(i18n.t('Unable to export unprocessable streams.'));
        }
      }

      if (areWeCutting) notices.push(i18n.t('Cutpoints may be inaccurate.'));

      const revealPath = willMerge ? mergedOutFilePath : outFiles[0];
      if (!hideAllNotifications) openExportFinishedToast({ filePath: revealPath, warnings, notices });

      if (cleanupChoices.cleanupAfterExport) await cleanupFilesWithDialog();

      resetMergedOutFileName();
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
        handleExportFailed(err);
        return;
      }

      handleError(err);
    } finally {
      setWorking();
      setCutProgress();
    }
  }, [numStreamsToCopy, segmentsToExport, haveInvalidSegs, setWorking, segmentsToChaptersOnly, outSegTemplateOrDefault, generateOutSegFileNames, cutMultiple, outputDir, customOutDir, fileFormat, duration, isRotationSet, effectiveRotation, copyFileStreams, allFilesMeta, keyframeCut, shortestFlag, ffmpegExperimental, preserveMovData, preserveMetadataOnMerge, movFastStart, avoidNegativeTs, customTagsByFile, paramsByStreamId, detectedFps, willMerge, enableOverwriteOutput, exportConfirmEnabled, mainFileFormatData, mainStreams, exportExtraStreams, areWeCutting, mergedOutFilePath, hideAllNotifications, cleanupChoices.cleanupAfterExport, cleanupFilesWithDialog, resetMergedOutFileName, selectedSegmentsOrInverse, segmentsToChapters, invertCutSegments, autoConcatCutSegments, autoDeleteMergedSegments, nonCopiedExtraStreams, filePath, handleExportFailed]);

  const onExportPress = useCallback(async () => {
    if (!filePath) return;

    if (!exportConfirmEnabled || exportConfirmVisible) {
      await onExportConfirm();
    } else {
      setExportConfirmVisible(true);
    }
  }, [filePath, exportConfirmEnabled, exportConfirmVisible, onExportConfirm]);

  const captureSnapshot = useCallback(async () => {
    if (!filePath) return;

    try {
      const currentTime = getRelevantTime();
      const video = videoRef.current;
      const useFffmpeg = usingPreviewFile || captureFrameMethod === 'ffmpeg';
      const outPath = useFffmpeg
        ? await captureFrameFromFfmpeg({ customOutDir, filePath, fromTime: currentTime, captureFormat, quality: captureFrameQuality })
        : await captureFrameFromTag({ customOutDir, filePath, currentTime, captureFormat, video, quality: captureFrameQuality });

      if (!hideAllNotifications) openDirToast({ icon: 'success', filePath: outPath, text: `${i18n.t('Screenshot captured to:')} ${outPath}` });
    } catch (err) {
      console.error(err);
      errorToast(i18n.t('Failed to capture frame'));
    }
  }, [filePath, getRelevantTime, usingPreviewFile, captureFrameMethod, captureFrameFromFfmpeg, customOutDir, captureFormat, captureFrameQuality, captureFrameFromTag, hideAllNotifications]);

  const extractSegmentFramesAsImages = useCallback(async (segIds) => {
    if (!filePath || detectedFps == null || workingRef.current) return;
    const segments = apparentCutSegments.filter((seg) => segIds.includes(seg.segId));
    const segmentsNumFrames = segments.reduce((acc, { start, end }) => acc + (getFrameCount(end - start) ?? 0), 0);
    const captureFramesResponse = await askExtractFramesAsImages({ segmentsNumFrames, plural: segments.length > 1, fps: detectedFps });
    if (captureFramesResponse == null) return;

    try {
      setWorking({ text: i18n.t('Extracting frames') });
      console.log('Extracting frames as images', { segIds, captureFramesResponse });

      setCutProgress(0);

      let lastOutPath;
      let totalProgress = 0;

      const onProgress = (progress) => {
        totalProgress += progress;
        setCutProgress(totalProgress / segments.length);
      };

      // eslint-disable-next-line no-restricted-syntax
      for (const segment of segments) {
        const { start, end } = segment;
        // eslint-disable-next-line no-await-in-loop
        lastOutPath = await captureFramesRange({ customOutDir, filePath, fps: detectedFps, fromTime: start, toTime: end, estimatedMaxNumFiles: captureFramesResponse.estimatedMaxNumFiles, captureFormat, quality: captureFrameQuality, filter: captureFramesResponse.filter, outputTimestamps: captureFrameFileNameFormat === 'timestamp', onProgress });
      }
      if (!hideAllNotifications) openDirToast({ icon: 'success', filePath: lastOutPath, text: i18n.t('Frames extracted to: {{path}}', { path: outputDir }) });
    } catch (err) {
      handleError(err);
    } finally {
      setWorking();
      setCutProgress();
    }
  }, [apparentCutSegments, captureFormat, captureFrameFileNameFormat, captureFrameQuality, captureFramesRange, customOutDir, detectedFps, filePath, getFrameCount, hideAllNotifications, outputDir, setWorking]);

  const extractCurrentSegmentFramesAsImages = useCallback(() => extractSegmentFramesAsImages([currentCutSeg?.segId]), [currentCutSeg?.segId, extractSegmentFramesAsImages]);
  const extractSelectedSegmentsFramesAsImages = useCallback(() => extractSegmentFramesAsImages(selectedSegments.map((seg) => seg.segId)), [extractSegmentFramesAsImages, selectedSegments]);

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

    const storeProjectInSourceDir = !storeProjectInWorkingDir;

    async function tryFindAndLoadProjectFile({ chapters, cod }) {
      try {
        // First try to open from from working dir
        if (await tryOpenProjectPath(getEdlFilePath(fp, cod), 'llc')) return;

        // then try to open project from source file dir
        const sameDirEdlFilePath = getEdlFilePath(fp);
        // MAS only allows fs.stat (fs-extra.exists) if we don't have access to input dir yet, so check first if the file exists,
        // so we don't need to annoy the user by asking for permission if the project file doesn't exist
        if (await exists(sameDirEdlFilePath)) {
          // Ok, the file exists. now we have to ask the user, because we need to read that file
          await ensureAccessToSourceDir(fp);
          // Ok, we got access from the user (or already have access), now read the project file
          await loadEdlFile({ path: sameDirEdlFilePath, type: 'llc' });
        }

        // then finally old csv style project
        if (await tryOpenProjectPath(getEdlFilePathOld(fp, cod), 'csv')) return;

        // OK, we didn't find a project file, instead maybe try to create project (segments) from chapters
        const edl = await tryMapChaptersToEdl(chapters);
        if (edl.length > 0 && enableAskForImportChapters && (await askForImportChapters())) {
          console.log('Convert chapters to segments', edl);
          loadCutSegments(edl);
        }
      } catch (err) {
        if (err instanceof DirectoryAccessDeclinedError) throw err;
        console.error('EDL load failed, but continuing', err);
        errorToast(`${i18n.t('Failed to load segments')} (${err.message})`);
      }
    }

    setWorking({ text: i18n.t('Loading file') });
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

      // need to ensure we have access to write to working directory
      const cod = await ensureWritableOutDir({ inputPath: fp, outDir: customOutDir });

      // if storeProjectInSourceDir is true, we will be writing project file to input path's dir, so ensure that one too
      if (storeProjectInSourceDir) await ensureAccessToSourceDir(fp);

      const existingHtml5FriendlyFile = await findExistingHtml5FriendlyFile(fp, cod);

      const needsAutoHtml5ify = !existingHtml5FriendlyFile && !willPlayerProperlyHandleVideo({ streams: fileMeta.streams, hevcPlaybackSupported }) && validDuration;

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

      if (projectPath) {
        await loadEdlFile({ path: projectPath, type: 'llc' });
      } else {
        await tryFindAndLoadProjectFile({ chapters: fileMeta.chapters, cod });
      }

      // throw new Error('test');

      // eslint-disable-next-line no-inner-declarations
      function getFps() {
        if (haveVideoStream) return getStreamFps(videoStream);
        if (haveAudioStream) return getStreamFps(audioStream);
        return undefined;
      }

      if (timecode) setStartTimeOffset(timecode);
      setDetectedFps(getFps());
      if (!haveVideoStream) setWaveformMode('big-waveform');
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
        if (!hideAllNotifications) toast.fire({ icon: 'info', text: i18n.t('The audio track is not supported. You can convert to a supported format from the menu') });
      } else if (!validDuration) {
        toast.fire({ icon: 'warning', timer: 10000, text: i18n.t('This file does not have a valid duration. This may cause issues. You can try to fix the file\'s duration from the File menu') });
      }

      // This needs to be last, because it triggers <video> to load the video
      // If not, onVideoError might be triggered before setWorking() has been cleared.
      // https://github.com/mifi/lossless-cut/issues/515
      setFilePath(fp);
    } catch (err) {
      if (err) {
        if (err instanceof DirectoryAccessDeclinedError) return;
      }
      resetState();
      throw err;
    }
  }, [storeProjectInWorkingDir, setWorking, loadEdlFile, getEdlFilePath, getEdlFilePathOld, enableAskForImportChapters, ensureAccessToSourceDir, loadCutSegments, autoLoadTimecode, enableNativeHevc, ensureWritableOutDir, customOutDir, resetState, setCopyStreamIdsForPath, setFileFormat, outFormatLocked, setDetectedFileFormat, html5ifyAndLoadWithPreferences, showPreviewFileLoadedMessage, showUnsupportedFileMessage, hideAllNotifications]);

  const toggleLastCommands = useCallback(() => setLastCommandsVisible(val => !val), []);
  const toggleSettings = useCallback(() => setSettingsVisible(val => !val), []);

  const seekClosestKeyframe = useCallback((direction) => {
    const time = findNearestKeyFrameTime({ time: getRelevantTime(), direction });
    if (time == null) return;
    userSeekAbs(time);
  }, [findNearestKeyFrameTime, getRelevantTime, userSeekAbs]);

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

      const mediaFilePath = pathJoin(dirname(path), mediaFileName);

      // Note: MAS only allows fs.stat (fs-extra.exists) if we don't have access to input dir yet
      if (!(await exists(mediaFilePath))) {
        errorToast(i18n.t('The media file referenced by the project file you tried to open does not exist in the same directory as the project file: {{mediaFileName}}', { mediaFileName }));
        return;
      }

      projectPath = path;

      // We might need to get user's access to the project file's directory, in order to read the media file
      try {
        await ensureAccessToSourceDir(mediaFilePath);
      } catch (err) {
        if (err instanceof DirectoryAccessDeclinedError) return;
      }
      path = mediaFilePath;
    }

    if (/\.vob$/i.test(path) && mustDisallowVob()) return;

    await loadMedia({ filePath: path, projectPath });
  }, [ensureAccessToSourceDir, loadMedia]);

  // todo merge with userOpenFiles?
  const batchOpenSingleFile = useCallback(async (path) => {
    if (workingRef.current) return;
    if (filePath === path) return;
    try {
      setWorking({ text: i18n.t('Loading file') });
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

    userSeekAbs(timeCode);
  }, [filePath, userSeekAbs]);

  const toggleStreamsSelector = useCallback(() => setStreamsSelectorShown((v) => !v), []);

  const handleShowStreamsSelectorClick = useCallback(() => {
    setStreamsSelectorShown(true);
    setExportConfirmVisible(false);
  }, []);

  const extractAllStreams = useCallback(async () => {
    if (!filePath) return;

    if (!(await confirmExtractAllStreamsDialog())) return;

    if (workingRef.current) return;
    try {
      setWorking({ text: i18n.t('Extracting all streams') });
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
      setWorking({ text: i18n.t('Converting to supported format') });
      await html5ifyAndLoad(customOutDir, filePath, selectedOption, hasVideo, hasAudio);
    } catch (err) {
      errorToast(i18n.t('Failed to convert file. Try a different conversion'));
      console.error('Failed to html5ify file', err);
    } finally {
      setWorking();
    }
  }, [customOutDir, filePath, html5ifyAndLoad, hasVideo, hasAudio, rememberConvertToSupportedFormat, setWorking]);

  const askStartTimeOffset = useCallback(async () => {
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
      setWorking({ text: i18n.t('Fixing file duration') });
      setCutProgress(0);
      const path = await fixInvalidDuration({ fileFormat, customOutDir, duration, onProgress: setCutProgress });
      if (!hideAllNotifications) toast.fire({ icon: 'info', text: i18n.t('Duration has been fixed') });

      await loadMedia({ filePath: path });
    } catch (err) {
      errorToast(i18n.t('Failed to fix file duration'));
      console.error('Failed to fix file duration', err);
    } finally {
      setWorking();
      setCutProgress();
    }
  }, [checkFileOpened, customOutDir, duration, fileFormat, fixInvalidDuration, hideAllNotifications, loadMedia, setWorking]);

  const addStreamSourceFile = useCallback(async (path) => {
    if (allFilesMeta[path]) return undefined; // Already added?
    const fileMeta = await readFileMeta(path);
    // console.log('streams', fileMeta.streams);
    setExternalFilesMeta((old) => ({ ...old, [path]: { streams: fileMeta.streams, formatData: fileMeta.format, chapters: fileMeta.chapters } }));
    setCopyStreamIdsForPath(path, () => fromPairs(fileMeta.streams.map(({ index }) => [index, true])));
    return fileMeta;
  }, [allFilesMeta, setCopyStreamIdsForPath]);

  const updateStreamParams = useCallback((fileId, streamId, setter) => setParamsByStreamId(produce((draft) => {
    if (!draft.has(fileId)) draft.set(fileId, new Map());
    const fileMap = draft.get(fileId);
    if (!fileMap.has(streamId)) fileMap.set(streamId, new Map());

    setter(fileMap.get(streamId));
  })), [setParamsByStreamId]);

  const addFileAsCoverArt = useCallback(async (path) => {
    const fileMeta = await addStreamSourceFile(path);
    if (!fileMeta) return false;
    const firstIndex = fileMeta.streams[0].index;
    updateStreamParams(path, firstIndex, (params) => params.set('disposition', 'attached_pic'));
    return true;
  }, [addStreamSourceFile, updateStreamParams]);

  const captureSnapshotAsCoverArt = useCallback(async () => {
    if (!filePath) return;
    try {
      const currentTime = getRelevantTime();
      const path = await captureFrameFromFfmpeg({ customOutDir, filePath, fromTime: currentTime, captureFormat, quality: captureFrameQuality });
      if (!(await addFileAsCoverArt(path))) return;
      if (!hideAllNotifications) toast.fire({ text: i18n.t('Current frame has been set as cover art') });
    } catch (err) {
      console.error(err);
      errorToast(i18n.t('Failed to capture frame'));
    }
  }, [addFileAsCoverArt, captureFormat, captureFrameFromFfmpeg, captureFrameQuality, customOutDir, filePath, getRelevantTime, hideAllNotifications]);

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

  const userOpenFiles = useCallback(async (filePathsIn) => {
    let filePaths = filePathsIn;
    if (!filePaths || filePaths.length < 1) return;

    console.log('userOpenFiles');
    console.log(filePaths.join('\n'));

    [lastOpenedPathRef.current] = filePaths;

    // https://en.wikibooks.org/wiki/Inside_DVD-Video/Directory_Structure
    if (filePaths.length === 1 && /^VIDEO_TS$/i.test(basename(filePaths[0]))) {
      if (mustDisallowVob()) return;
      filePaths = await readVideoTs(filePaths[0]);
    }


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

    if (workingRef.current) return;
    try {
      setWorking({ text: i18n.t('Loading file') });

      // Import segments for for already opened file
      const matchingImportProjectType = getImportProjectType(firstFilePath);
      if (matchingImportProjectType) {
        if (!checkFileOpened()) return;
        await loadEdlFile({ path: firstFilePath, type: matchingImportProjectType, append: true });
        return;
      }

      const filePathLowerCase = firstFilePath.toLowerCase();
      const isLlcProject = filePathLowerCase.endsWith('.llc');

      // Need to ask the user what to do if more than one option
      const inputOptions = {
        open: isFileOpened ? i18n.t('Open the file instead of the current one') : i18n.t('Open the file'),
      };

      if (isFileOpened) {
        if (isLlcProject) inputOptions.project = i18n.t('Load segments from the new file, but keep the current media');
        else if (filePathLowerCase.endsWith('.srt')) inputOptions.subtitles = i18n.t('Convert subtitiles into segments');
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
        if (openFileResponse === 'subtitles') {
          await loadEdlFile({ path: firstFilePath, type: 'srt' });
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
    const { canceled, filePaths } = await showOpenDialog({ properties: ['openFile', 'multiSelections'], defaultPath: lastOpenedPathRef.current });
    if (canceled) return;
    userOpenFiles(filePaths);
  }, [userOpenFiles]);

  const concatBatch = useCallback(() => {
    if (batchFiles.length < 2) {
      openFilesDialog();
      return;
    }

    setConcatDialogVisible(true);
  }, [batchFiles.length, openFilesDialog]);

  const toggleLoopSelectedSegments = useCallback(() => togglePlay({ resetPlaybackRate: true, playbackMode: 'loop-selected-segments' }), [togglePlay]);

  const copySegmentsToClipboard = useCallback(async () => {
    if (!isFileOpened) return;
    electron.clipboard.writeText(await formatTsv(selectedSegments));
  }, [isFileOpened, selectedSegments]);

  const showIncludeExternalStreamsDialog = useCallback(async () => {
    try {
      const { canceled, filePaths } = await showOpenDialog({ properties: ['openFile'] });
      if (canceled || filePaths.length < 1) return;
      await addStreamSourceFile(filePaths[0]);
    } catch (err) {
      handleError(err);
    }
  }, [addStreamSourceFile]);

  const toggleFullscreenVideo = useCallback(async () => {
    if (!screenfull.isEnabled) {
      console.warn('Fullscreen not allowed');
      return;
    }
    try {
      if (videoRef.current == null) {
        console.warn('No video tag to full screen');
        return;
      }
      await screenfull.toggle(videoContainerRef.current, { navigationUI: 'hide' });
    } catch (err) {
      console.error('Failed to toggle fullscreen', err);
    }
  }, []);

  const onEditSegmentTags = useCallback((index) => {
    setEditingSegmentTagsSegmentIndex(index);
    setEditingSegmentTags(getSegmentTags(apparentCutSegments[index]));
  }, [apparentCutSegments]);

  const editCurrentSegmentTags = useCallback(() => {
    onEditSegmentTags(currentSegIndexSafe);
  }, [currentSegIndexSafe, onEditSegmentTags]);

  const mainActions = useMemo(() => {
    async function exportYouTube() {
      if (!checkFileOpened()) return;

      await openYouTubeChaptersDialog(formatYouTube(apparentCutSegments));
    }

    function seekReset() {
      seekAccelerationRef.current = 1;
    }

    return {
      // NOTE: Do not change these keys because users have bound keys by these names in their config files
      // For actions, see also KeyboardShortcuts.jsx
      togglePlayNoResetSpeed: () => togglePlay(),
      togglePlayResetSpeed: () => togglePlay({ resetPlaybackRate: true }),
      togglePlayOnlyCurrentSegment: () => togglePlay({ resetPlaybackRate: true, playbackMode: 'play-segment-once' }),
      toggleLoopOnlyCurrentSegment: () => togglePlay({ resetPlaybackRate: true, playbackMode: 'loop-segment' }),
      toggleLoopStartEndOnlyCurrentSegment: () => togglePlay({ resetPlaybackRate: true, playbackMode: 'loop-segment-start-end' }),
      toggleLoopSelectedSegments,
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
      seekBackwards({ keyup }) {
        if (keyup) {
          seekReset();
          return;
        }
        seekRel(keyboardNormalSeekSpeed * seekAccelerationRef.current * -1);
        seekAccelerationRef.current *= keyboardSeekAccFactor;
      },
      seekForwards({ keyup }) {
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
      duplicateCurrentSegment,
      toggleLastCommands: () => { toggleLastCommands(); return false; },
      export: onExportPress,
      extractCurrentSegmentFramesAsImages,
      extractSelectedSegmentsFramesAsImages,
      reorderSegsByStartTime,
      invertAllSegments,
      fillSegmentsGaps,
      combineOverlappingSegments,
      combineSelectedSegments,
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
      concatBatch,
      toggleKeyframeCutMode: () => toggleKeyframeCut(true),
      toggleCaptureFormat,
      toggleStripAudio,
      toggleStripThumbnail,
      setStartTimeOffset: askStartTimeOffset,
      deselectAllSegments,
      selectAllSegments,
      selectOnlyCurrentSegment,
      editCurrentSegmentTags,
      toggleCurrentSegmentSelected,
      invertSelectedSegments,
      removeSelectedSegments,
      fixInvalidDuration: tryFixInvalidDuration,
      shiftAllSegmentTimes,
      increaseVolume: () => setPlaybackVolume((val) => Math.min(1, val + 0.07)),
      decreaseVolume: () => setPlaybackVolume((val) => Math.max(0, val - 0.07)),
      copySegmentsToClipboard,
      reloadFile: () => setCacheBuster((v) => v + 1),
      quit: () => quitApp(),
      closeCurrentFile: () => { closeFileWithConfirm(); },
      exportYouTube,
      showStreamsSelector: handleShowStreamsSelectorClick,
      html5ify: () => userHtml5ifyCurrentFile({ ignoreRememberedValue: true }),
      openFilesDialog,
      toggleKeyboardShortcuts,
      toggleSettings,
      openSendReportDialog: () => { openSendReportDialogWithState(); },
      detectBlackScenes,
      detectSilentScenes,
      detectSceneChanges,
      createSegmentsFromKeyframes,
      toggleWaveformMode,
      toggleShowThumbnails,
      toggleShowKeyframes,
      showIncludeExternalStreamsDialog,
      toggleFullscreenVideo,
    };
  }, [addSegment, alignSegmentTimesToKeyframes, apparentCutSegments, askStartTimeOffset, batchFileJump, batchOpenSelectedFile, captureSnapshot, captureSnapshotAsCoverArt, changePlaybackRate, checkFileOpened, cleanupFilesDialog, clearSegments, closeBatch, closeFileWithConfirm, combineOverlappingSegments, combineSelectedSegments, concatBatch, convertFormatBatch, copySegmentsToClipboard, createFixedDurationSegments, createNumSegments, createRandomSegments, createSegmentsFromKeyframes, currentSegIndexSafe, cutSegmentsHistory, deselectAllSegments, detectBlackScenes, detectSceneChanges, detectSilentScenes, duplicateCurrentSegment, editCurrentSegmentTags, extractAllStreams, extractCurrentSegmentFramesAsImages, extractSelectedSegmentsFramesAsImages, fillSegmentsGaps, goToTimecode, handleShowStreamsSelectorClick, increaseRotation, invertAllSegments, invertSelectedSegments, jumpCutEnd, jumpCutStart, jumpSeg, jumpTimelineEnd, jumpTimelineStart, keyboardNormalSeekSpeed, keyboardSeekAccFactor, onExportPress, onLabelSegment, openFilesDialog, openSendReportDialogWithState, pause, play, removeCutSegment, removeSelectedSegments, reorderSegsByStartTime, seekClosestKeyframe, seekRel, seekRelPercent, selectAllSegments, selectOnlyCurrentSegment, setCutEnd, setCutStart, setPlaybackVolume, shiftAllSegmentTimes, shortStep, showIncludeExternalStreamsDialog, shuffleSegments, splitCurrentSegment, timelineToggleComfortZoom, toggleCaptureFormat, toggleCurrentSegmentSelected, toggleFullscreenVideo, toggleKeyboardShortcuts, toggleKeyframeCut, toggleLastCommands, toggleLoopSelectedSegments, togglePlay, toggleSegmentsList, toggleSettings, toggleShowKeyframes, toggleShowThumbnails, toggleStreamsSelector, toggleStripAudio, toggleStripThumbnail, toggleWaveformMode, tryFixInvalidDuration, userHtml5ifyCurrentFile, zoomRel]);

  const getKeyboardAction = useCallback((action) => mainActions[action], [mainActions]);

  const onKeyPress = useCallback(({ action, keyup }) => {
    function tryMainActions() {
      const fn = getKeyboardAction(action);
      if (!fn) return { match: false };
      const bubble = fn({ keyup });
      return { match: true, bubble };
    }

    if (isDev) console.log('key event', action);

    // always allow
    if (action === 'closeActiveScreen') {
      closeExportConfirm();
      setLastCommandsVisible(false);
      setSettingsVisible(false);
      setStreamsSelectorShown(false);
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
  }, [closeExportConfirm, concatDialogVisible, exportConfirmVisible, getKeyboardAction, keyboardShortcutsVisible, onExportConfirm, toggleKeyboardShortcuts]);

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
      setWorking({ text: i18n.t('Extracting track') });
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

      // this error can happen half way into playback if the file has some corruption
      // example: "DEMUXER_ERROR_COULD_NOT_PARSE: FFmpegDemuxer: PTS is not defined 4"
      if (error.code === MEDIA_ERR_SRC_NOT_SUPPORTED && error.message?.startsWith('DEMUXER_ERROR_COULD_NOT_PARSE')) return;

      if (workingRef.current) return;
      try {
        setWorking({ text: i18n.t('Converting to supported format') });

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

  const onVideoFocus = useCallback((e) => {
    // prevent video element from stealing focus in fullscreen mode https://github.com/mifi/lossless-cut/issues/543#issuecomment-1868167775
    e.target.blur();
  }, []);

  const onVideoClick = useCallback(() => togglePlay(), [togglePlay]);

  useEffect(() => {
    async function tryExportEdlFile(type) {
      if (!checkFileOpened()) return;
      try {
        await exportEdlFile({ type, cutSegments: selectedSegments, customOutDir, filePath, getFrameCount });
      } catch (err) {
        errorToast(i18n.t('Failed to export project'));
        console.error('Failed to export project', type, err);
      }
    }

    async function importEdlFile(type) {
      if (!checkFileOpened()) return;

      try {
        const edl = await askForEdlImport({ type, fps: detectedFps });
        if (edl.length > 0) loadCutSegments(edl, true);
      } catch (err) {
        handleError(err);
      }
    }

    async function tryApiKeyboardAction(event, { id, action }) {
      console.log('API keyboard action:', action);
      try {
        const fn = getKeyboardAction(action);
        if (!fn) throw new Error(`Action not found: ${action}`);
        await fn({ keyup: false });
      } catch (err) {
        handleError(err);
      } finally {
        // todo correlation ids
        event.sender.send('apiKeyboardActionResponse', { id });
      }
    }

    const actionsWithArgs = {
      openFiles: (filePaths) => { userOpenFiles(filePaths.map(resolvePathIfNeeded)); },
      // todo separate actions per type and move them into mainActions? https://github.com/mifi/lossless-cut/issues/254#issuecomment-932649424
      importEdlFile,
      exportEdlFile: tryExportEdlFile,
    };

    async function actionWithCatch(fn) {
      try {
        await fn();
      } catch (err) {
        handleError(err);
      }
    }

    const actionsWithCatch = [
      // actions with arguments:
      ...Object.entries(actionsWithArgs).map(([key, fn]) => [
        key,
        async (event, ...args) => actionWithCatch(() => fn(...args)),
      ]),
      // all main actions (no arguments, except keyup which we don't support):
      ...Object.entries(mainActions).map(([key, fn]) => [
        key,
        async () => actionWithCatch(() => fn({ keyup: false })),
      ]),
    ];

    actionsWithCatch.forEach(([key, action]) => electron.ipcRenderer.on(key, action));
    electron.ipcRenderer.on('apiKeyboardAction', tryApiKeyboardAction);

    return () => {
      actionsWithCatch.forEach(([key, action]) => electron.ipcRenderer.off(key, action));
      electron.ipcRenderer.off('apiKeyboardAction', tryApiKeyboardAction);
    };
  }, [checkFileOpened, customOutDir, detectedFps, filePath, getFrameCount, getKeyboardAction, loadCutSegments, mainActions, selectedSegments, userOpenFiles]);

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
    if (!isStoreBuild && !hasDisabledNetworking()) loadMifiLink().then(setMifiLink);
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
    <SegColorsContext.Provider value={segColorsContext}>
      <UserSettingsContext.Provider value={userSettingsContext}>
        <ThemeProvider value={theme}>
          <div className={darkMode ? 'dark-theme' : undefined} style={{ display: 'flex', flexDirection: 'column', height: '100vh', color: 'var(--gray12)', background: 'var(--gray1)', transition: darkModeTransition }}>
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
                    batchListRemoveFile={batchListRemoveFile}
                    closeBatch={closeBatch}
                    onMergeFilesClick={concatBatch}
                    onBatchConvertToSupportedFormatClick={convertFormatBatch}
                  />
                )}
              </AnimatePresence>

              {/* Middle part: */}
              <div style={{ position: 'relative', flexGrow: 1, overflow: 'hidden' }} ref={videoContainerRef}>
                {!isFileOpened && <NoFileLoaded mifiLink={mifiLink} currentCutSeg={currentCutSeg} onClick={openFilesDialog} darkMode={darkMode} />}

                <div className="no-user-select" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, visibility: !isFileOpened || !hasVideo || bigWaveformEnabled ? 'hidden' : undefined }} onWheel={onTimelineWheel}>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video
                    className="main-player"
                    tabIndex={-1}
                    muted={playbackVolume === 0}
                    ref={videoRef}
                    style={videoStyle}
                    src={fileUri}
                    onPlay={onSartPlaying}
                    onPause={onStopPlaying}
                    onAbort={onVideoAbort}
                    onDurationChange={onDurationChange}
                    onTimeUpdate={onTimeUpdate}
                    onError={onVideoError}
                    onClick={onVideoClick}
                    onDoubleClick={toggleFullscreenVideo}
                    onFocusCapture={onVideoFocus}
                  >
                    {renderSubtitles()}
                  </video>

                  {canvasPlayerEnabled && <Canvas rotate={effectiveRotation} filePath={filePath} width={mainVideoStream.width} height={mainVideoStream.height} streamIndex={mainVideoStream.index} playerTime={playerTime} commandedTime={commandedTime} playing={playing} eventId={canvasPlayerEventId} />}
                </div>

                {bigWaveformEnabled && <BigWaveform waveforms={waveforms} relevantTime={relevantTime} playing={playing} durationSafe={durationSafe} zoom={zoomUnrounded} seekRel={seekRel} />}

                {isRotationSet && !hideCanvasPreview && (
                  <div style={{ position: 'absolute', top: 0, right: 0, left: 0, marginTop: '1em', marginLeft: '1em', color: 'white', opacity: 0.7, display: 'flex', alignItems: 'center' }}>
                    <MdRotate90DegreesCcw size={26} style={{ marginRight: 5 }} />
                    {t('Rotation preview')}
                    {!canvasPlayerRequired && <FaWindowClose role="button" style={{ cursor: 'pointer', verticalAlign: 'middle', padding: 10 }} onClick={() => setHideCanvasPreview(true)} />}
                  </div>
                )}

                {isFileOpened && (
                  <div className="no-user-select" style={{ position: 'absolute', right: 0, bottom: 0, marginBottom: 10, display: 'flex', alignItems: 'center' }}>
                    <VolumeControl playbackVolume={playbackVolume} setPlaybackVolume={setPlaybackVolume} usingDummyVideo={usingDummyVideo} />

                    {subtitleStreams.length > 0 && <SubtitleControl subtitleStreams={subtitleStreams} activeSubtitleStreamIndex={activeSubtitleStreamIndex} onActiveSubtitleChange={onActiveSubtitleChange} />}

                    {!showRightBar && (
                      <FaAngleLeft
                        title={t('Show sidebar')}
                        size={30}
                        role="button"
                        style={{ marginRight: 10, color: 'var(--gray12)', opacity: 0.7 }}
                        onClick={toggleSegmentsList}
                      />
                    )}
                  </div>
                )}

                <AnimatePresence>
                  {working && <Working text={working.text} cutProgress={cutProgress} onAbortClick={handleAbortWorkingClick} />}
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
                    onDuplicateSegmentClick={duplicateSegment}
                    removeCutSegment={removeCutSegment}
                    onRemoveSelected={removeSelectedSegments}
                    toggleSegmentsList={toggleSegmentsList}
                    splitCurrentSegment={splitCurrentSegment}
                    isSegmentSelected={isSegmentSelected}
                    selectedSegments={selectedSegmentsOrInverse}
                    onSelectSingleSegment={selectOnlySegment}
                    onToggleSegmentSelected={toggleSegmentSelected}
                    onDeselectAllSegments={deselectAllSegments}
                    onSelectAllSegments={selectAllSegments}
                    onInvertSelectedSegments={invertSelectedSegments}
                    onExtractSegmentFramesAsImages={extractSegmentFramesAsImages}
                    jumpSegStart={jumpSegStart}
                    jumpSegEnd={jumpSegEnd}
                    onSelectSegmentsByLabel={onSelectSegmentsByLabel}
                    onSelectSegmentsByTag={onSelectSegmentsByTag}
                    onLabelSelectedSegments={onLabelSelectedSegments}
                    updateSegAtIndex={updateSegAtIndex}
                    editingSegmentTags={editingSegmentTags}
                    editingSegmentTagsSegmentIndex={editingSegmentTagsSegmentIndex}
                    setEditingSegmentTags={setEditingSegmentTags}
                    setEditingSegmentTagsSegmentIndex={setEditingSegmentTagsSegmentIndex}
                    onEditSegmentTags={onEditSegmentTags}
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
                showThumbnails={showThumbnails}
                neighbouringKeyFrames={neighbouringKeyFrames}
                thumbnails={thumbnailsSorted}
                playerTime={playerTime}
                commandedTime={commandedTime}
                relevantTime={relevantTime}
                getRelevantTime={getRelevantTime}
                commandedTimeRef={commandedTimeRef}
                startTimeOffset={startTimeOffset}
                zoom={zoom}
                seekAbs={userSeekAbs}
                durationSafe={durationSafe}
                apparentCutSegments={apparentCutSegments}
                setCurrentSegIndex={setCurrentSegIndex}
                currentSegIndexSafe={currentSegIndexSafe}
                inverseCutSegments={inverseCutSegments}
                formatTimecode={formatTimecode}
                formatTimeAndFrames={formatTimeAndFrames}
                onZoomWindowStartTimeChange={setZoomWindowStartTime}
                playing={playing}
                isFileOpened={isFileOpened}
                onWheel={onTimelineWheel}
                goToTimecode={goToTimecode}
                isSegmentSelected={isSegmentSelected}
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
                seekAbs={userSeekAbs}
                currentSegIndexSafe={currentSegIndexSafe}
                cutSegments={cutSegments}
                currentCutSeg={currentCutSeg}
                selectedSegments={selectedSegments}
                setCutStart={setCutStart}
                setCutEnd={setCutEnd}
                setCurrentSegIndex={setCurrentSegIndex}
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
                showThumbnails={showThumbnails}
                toggleShowThumbnails={toggleShowThumbnails}
                toggleWaveformMode={toggleWaveformMode}
                waveformMode={waveformMode}
                hasAudio={hasAudio}
                keyframesEnabled={keyframesEnabled}
                toggleShowKeyframes={toggleShowKeyframes}
                detectedFps={detectedFps}
                toggleLoopSelectedSegments={toggleLoopSelectedSegments}
                isFileOpened={isFileOpened}
                darkMode={darkMode}
                setDarkMode={setDarkMode}
                outputPlaybackRate={outputPlaybackRate}
                setOutputPlaybackRate={setOutputPlaybackRate}
              />
            </div>

            <Sheet visible={streamsSelectorShown} onClosePress={() => setStreamsSelectorShown(false)} style={{ padding: '1em 0' }}>
              {mainStreams && (
                <StreamsSelector
                  mainFilePath={filePath}
                  mainFileFormatData={mainFileFormatData}
                  mainFileChapters={mainFileChapters}
                  allFilesMeta={allFilesMeta}
                  externalFilesMeta={externalFilesMeta}
                  setExternalFilesMeta={setExternalFilesMeta}
                  showAddStreamSourceDialog={showIncludeExternalStreamsDialog}
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
                  paramsByStreamId={paramsByStreamId}
                  updateStreamParams={updateStreamParams}
                />
              )}
            </Sheet>

            <ExportConfirm filePath={filePath} areWeCutting={areWeCutting} nonFilteredSegmentsOrInverse={nonFilteredSegmentsOrInverse} selectedSegments={selectedSegmentsOrInverse} segmentsToExport={segmentsToExport} willMerge={willMerge} visible={exportConfirmVisible} onClosePress={closeExportConfirm} onExportConfirm={onExportConfirm} renderOutFmt={renderOutFmt} outputDir={outputDir} numStreamsTotal={numStreamsTotal} numStreamsToCopy={numStreamsToCopy} onShowStreamsSelectorClick={handleShowStreamsSelectorClick} outFormat={fileFormat} setOutSegTemplate={setOutSegTemplate} outSegTemplate={outSegTemplateOrDefault} generateOutSegFileNames={generateOutSegFileNames} currentSegIndexSafe={currentSegIndexSafe} mainCopiedThumbnailStreams={mainCopiedThumbnailStreams} needSmartCut={needSmartCut} mergedOutFileName={mergedOutFileName} setMergedOutFileName={setMergedOutFileName} />

            <LastCommandsSheet
              visible={lastCommandsVisible}
              onTogglePress={toggleLastCommands}
              ffmpegCommandLog={ffmpegCommandLog}
            />

            <Sheet visible={settingsVisible} onClosePress={toggleSettings} style={{ padding: '1em 0' }}>
              <Settings
                onTunerRequested={onTunerRequested}
                onKeyboardShortcutsDialogRequested={toggleKeyboardShortcuts}
                askForCleanupChoices={askForCleanupChoices}
                toggleStoreProjectInWorkingDir={toggleStoreProjectInWorkingDir}
                simpleMode={simpleMode}
              />
            </Sheet>

            <ConcatDialog isShown={batchFiles.length > 0 && concatDialogVisible} onHide={() => setConcatDialogVisible(false)} paths={batchFilePaths} onConcat={userConcatFiles} setAlwaysConcatMultipleFiles={setAlwaysConcatMultipleFiles} alwaysConcatMultipleFiles={alwaysConcatMultipleFiles} />

            <KeyboardShortcuts isShown={keyboardShortcutsVisible} onHide={() => setKeyboardShortcutsVisible(false)} keyBindings={keyBindings} setKeyBindings={setKeyBindings} currentCutSeg={currentCutSeg} resetKeyBindings={resetKeyBindings} mainActions={mainActions} />
          </div>
        </ThemeProvider>
      </UserSettingsContext.Provider>
    </SegColorsContext.Provider>
  );
}

export default memo(App);
