import { memo, useEffect, useState, useCallback, useRef, useMemo, CSSProperties, ReactEventHandler, FocusEventHandler } from 'react';
import { FaAngleLeft, FaRegTimesCircle } from 'react-icons/fa';
import { MdRotate90DegreesCcw } from 'react-icons/md';
import { AnimatePresence } from 'framer-motion';
import { ThemeProvider } from 'evergreen-ui';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';
import { produce } from 'immer';
import screenfull from 'screenfull';
import { IpcRendererEvent } from 'electron';

import fromPairs from 'lodash/fromPairs';
import sum from 'lodash/sum';
import invariant from 'tiny-invariant';
import { SweetAlertOptions } from 'sweetalert2';

import theme from './theme';
import useTimelineScroll from './hooks/useTimelineScroll';
import useUserSettingsRoot from './hooks/useUserSettingsRoot';
import useFfmpegOperations, { OutputNotWritableError } from './hooks/useFfmpegOperations';
import useKeyframes from './hooks/useKeyframes';
import useWaveform from './hooks/useWaveform';
import useKeyboard from './hooks/useKeyboard';
import useFileFormatState from './hooks/useFileFormatState';
import useFrameCapture from './hooks/useFrameCapture';
import useSegments from './hooks/useSegments';
import useDirectoryAccess from './hooks/useDirectoryAccess';

import { UserSettingsContext, SegColorsContext, UserSettingsContextType } from './contexts';

import NoFileLoaded from './NoFileLoaded';
import MediaSourcePlayer from './MediaSourcePlayer';
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
import PlaybackStreamSelector from './components/PlaybackStreamSelector';
import BatchFilesList from './components/BatchFilesList';
import ConcatDialog from './components/ConcatDialog';
import KeyboardShortcuts from './components/KeyboardShortcuts';
import Working from './components/Working';
import OutputFormatSelect from './components/OutputFormatSelect';

import { loadMifiLink, runStartupCheck } from './mifi';
import { darkModeTransition } from './colors';
import { getSegColor } from './util/colors';
import {
  getStreamFps, isCuttingStart, isCuttingEnd,
  readFileMeta, getDefaultOutFormat,
  setCustomFfPath as ffmpegSetCustomFfPath,
  isIphoneHevc, isProblematicAvc1, tryMapChaptersToEdl,
  getDuration, getTimecodeFromStreams, createChaptersFromSegments,
  RefuseOverwriteError, extractSubtitleTrackToSegments,
  mapRecommendedDefaultFormat,
  getFfCommandLine,
} from './ffmpeg';
import { shouldCopyStreamByDefault, getAudioStreams, getRealVideoStreams, isAudioDefinitelyNotSupported, willPlayerProperlyHandleVideo, doesPlayerSupportHevcPlayback, getSubtitleStreams, enableVideoTrack, enableAudioTrack, canHtml5PlayerPlayStreams } from './util/streams';
import { exportEdlFile, readEdlFile, loadLlcProject, askForEdlImport } from './edlStore';
import { formatYouTube, getFrameCountRaw, formatTsv } from './edlFormats';
import {
  getOutPath, getSuffixedOutPath, handleError, getOutDir,
  isStoreBuild, dragPreventer,
  havePermissionToReadFile, resolvePathIfNeeded, getPathReadAccessError, html5ifiedPrefix, html5dummySuffix, findExistingHtml5FriendlyFile,
  deleteFiles, isOutOfSpaceError, readFileSize, readFileSizes, checkFileSizes, setDocumentTitle, mustDisallowVob, readVideoTs, readDirRecursively, getImportProjectType,
  calcShouldShowWaveform, calcShouldShowKeyframes, mediaSourceQualities, isExecaError, getStdioString,
  isMuxNotSupported,
  getDownloadMediaOutPath,
  isAbortedError,
  withErrorHandling,
} from './util';
import { toast, errorToast, showPlaybackFailedMessage } from './swal';
import { adjustRate } from './util/rate-calculator';
import { askExtractFramesAsImages } from './dialogs/extractFrames';
import { askForHtml5ifySpeed } from './dialogs/html5ify';
import { askForOutDir, askForImportChapters, promptTimecode, askForFileOpenAction, confirmExtractAllStreamsDialog, showCleanupFilesDialog, showDiskFull, showExportFailedDialog, showConcatFailedDialog, openYouTubeChaptersDialog, showRefuseToOverwrite, openDirToast, openExportFinishedToast, openConcatFinishedToast, showOpenDialog, showMuxNotSupported, promptDownloadMediaUrl, CleanupChoicesType, showOutputNotWritable } from './dialogs';
import { openSendReportDialog } from './reporting';
import { fallbackLng } from './i18n';
import { sortSegments, convertSegmentsToChapters, hasAnySegmentOverlap, isDurationValid, getPlaybackMode, getSegmentTags, filterNonMarkers } from './segments';
import { generateOutSegFileNames as generateOutSegFileNamesRaw, generateMergedFileNames as generateMergedFileNamesRaw, defaultOutSegTemplate, defaultCutMergedFileTemplate } from './util/outputNameTemplate';
import { rightBarWidth, leftBarWidth, ffmpegExtractWindow, zoomMax } from './util/constants';
import BigWaveform from './components/BigWaveform';

import isDev from './isDev';
import { BatchFile, Chapter, CustomTagsByFile, EdlExportType, EdlFileType, EdlImportType, FfmpegCommandLog, FilesMeta, goToTimecodeDirectArgsSchema, openFilesActionArgsSchema, ParamsByStreamId, PlaybackMode, SegmentBase, SegmentColorIndex, SegmentTags, StateSegment, TunerType } from './types';
import { CaptureFormat, KeyboardAction, Html5ifyMode, WaveformMode, ApiActionRequest, KeyBinding } from '../../../types';
import { FFprobeChapter, FFprobeFormat, FFprobeStream } from '../../../ffprobe';
import useLoading from './hooks/useLoading';
import useVideo from './hooks/useVideo';
import useTimecode from './hooks/useTimecode';
import useSegmentsAutoSave from './hooks/useSegmentsAutoSave';
import useThumbnails from './hooks/useThumbnails';
import useSubtitles from './hooks/useSubtitles';
import useStreamsMeta from './hooks/useStreamsMeta';
import { bottomStyle, videoStyle } from './styles';
import styles from './App.module.css';
import { DirectoryAccessDeclinedError } from '../errors';

const electron = window.require('electron');
const { exists } = window.require('fs-extra');
const { lstat } = window.require('fs/promises');
const { parse: parsePath, join: pathJoin, basename, dirname } = window.require('path');

const { focusWindow, hasDisabledNetworking, quitApp, pathToFileURL, setProgressBar, sendOsNotification } = window.require('@electron/remote').require('./index.js');


const hevcPlaybackSupportedPromise = doesPlayerSupportHevcPlayback();
// eslint-disable-next-line unicorn/prefer-top-level-await
hevcPlaybackSupportedPromise.catch((err) => console.error(err));


function App() {
  const { t } = useTranslation();

  // Per project state
  const [ffmpegCommandLog, setFfmpegCommandLog] = useState<FfmpegCommandLog>([]);
  const [previewFilePath, setPreviewFilePath] = useState<string>();
  const [usingDummyVideo, setUsingDummyVideo] = useState(false);
  const [rotation, setRotation] = useState(360);
  const [progress, setProgress] = useState<number>();
  const [startTimeOffset, setStartTimeOffset] = useState(0);
  const [filePath, setFilePath] = useState<string>();
  const [fileDuration, setFileDuration] = useState<number>();
  const [externalFilesMeta, setExternalFilesMeta] = useState<FilesMeta>({});
  const [customTagsByFile, setCustomTagsByFile] = useState<CustomTagsByFile>({});
  const [paramsByStreamId, setParamsByStreamId] = useState<ParamsByStreamId>(new Map());
  const [detectedFps, setDetectedFps] = useState<number>();
  const [mainFileMeta, setMainFileMeta] = useState<{ streams: FFprobeStream[], formatData: FFprobeFormat, chapters: FFprobeChapter[] }>();
  const [streamsSelectorShown, setStreamsSelectorShown] = useState(false);
  const [concatDialogVisible, setConcatDialogVisible] = useState(false);
  const [zoomUnrounded, setZoom] = useState(1);
  const [shortestFlag, setShortestFlag] = useState(false);
  const [zoomWindowStartTime, setZoomWindowStartTime] = useState(0);
  const [activeVideoStreamIndex, setActiveVideoStreamIndex] = useState<number>();
  const [activeAudioStreamIndexes, setActiveAudioStreamIndexes] = useState<Set<number>>(new Set());
  const [activeSubtitleStreamIndex, setActiveSubtitleStreamIndex] = useState<number>();
  const [hideMediaSourcePlayer, setHideMediaSourcePlayer] = useState(false);
  const [exportConfirmVisible, setExportConfirmVisible] = useState(false);
  const [cacheBuster, setCacheBuster] = useState(0);
  const [currentFileExportCount, setCurrentFileExportCount] = useState(0);

  const { fileFormat, setFileFormat, detectedFileFormat, setDetectedFileFormat, isCustomFormatSelected } = useFileFormatState();

  // State per application launch
  const lastOpenedPathRef = useRef<string>();
  const [waveformMode, setWaveformMode] = useState<WaveformMode>();
  const [thumbnailsEnabled, setThumbnailsEnabled] = useState(false);
  const [keyframesEnabled, setKeyframesEnabled] = useState(true);
  const [showRightBar, setShowRightBar] = useState(true);
  const [rememberConvertToSupportedFormat, setRememberConvertToSupportedFormat] = useState<Html5ifyMode>();
  const [lastCommandsVisible, setLastCommandsVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [tunerVisible, setTunerVisible] = useState<TunerType>();
  const [keyboardShortcutsVisible, setKeyboardShortcutsVisible] = useState(false);
  const [mifiLink, setMifiLink] = useState<unknown>();
  const [alwaysConcatMultipleFiles, setAlwaysConcatMultipleFiles] = useState(false);
  const [editingSegmentTagsSegmentIndex, setEditingSegmentTagsSegmentIndex] = useState<number>();
  const [editingSegmentTags, setEditingSegmentTags] = useState<SegmentTags>();
  const [mediaSourceQuality, setMediaSourceQuality] = useState(0);
  const [smartCutBitrate, setSmartCutBitrate] = useState<number | undefined>();
  const [exportCount, setExportCount] = useState(0);

  const incrementMediaSourceQuality = useCallback(() => setMediaSourceQuality((v) => (v + 1) % mediaSourceQualities.length), []);

  // Batch state / concat files
  const [batchFiles, setBatchFiles] = useState<BatchFile[]>([]);
  const [selectedBatchFiles, setSelectedBatchFiles] = useState<string[]>([]);

  const allUserSettings = useUserSettingsRoot();

  const {
    captureFormat, setCaptureFormat, customOutDir, setCustomOutDir, keyframeCut, setKeyframeCut, preserveMetadata, preserveChapters, preserveMovData, movFastStart, avoidNegativeTs, autoMerge, timecodeFormat, invertCutSegments, setInvertCutSegments, autoExportExtraStreams, askBeforeClose, enableAskForImportChapters, enableAskForFileOpenAction, playbackVolume, setPlaybackVolume, autoSaveProjectFile, wheelSensitivity, waveformHeight, invertTimelineScroll, language, ffmpegExperimental, hideNotifications, hideOsNotifications, autoLoadTimecode, autoDeleteMergedSegments, exportConfirmEnabled, setExportConfirmEnabled, segmentsToChapters, preserveMetadataOnMerge, simpleMode, setSimpleMode, outSegTemplate, setOutSegTemplate, mergedFileTemplate, setMergedFileTemplate, keyboardSeekAccFactor, keyboardNormalSeekSpeed, keyboardSeekSpeed2, keyboardSeekSpeed3, treatInputFileModifiedTimeAsStart, treatOutputFileModifiedTimeAsStart, outFormatLocked, setOutFormatLocked, safeOutputFileName, setSafeOutputFileName, enableAutoHtml5ify, segmentsToChaptersOnly, keyBindings, setKeyBindings, resetKeyBindings, enableSmartCut, customFfPath, storeProjectInWorkingDir, setStoreProjectInWorkingDir, enableOverwriteOutput, mouseWheelZoomModifierKey, mouseWheelFrameSeekModifierKey, mouseWheelKeyframeSeekModifierKey, captureFrameMethod, captureFrameQuality, captureFrameFileNameFormat, enableNativeHevc, cleanupChoices, setCleanupChoices, darkMode, toggleDarkMode, preferStrongColors, outputFileNameMinZeroPadding, cutFromAdjustmentFrames, cutToAdjustmentFrames,
  } = allUserSettings;

  // Note that each action may be multiple key bindings and this will only be the first binding for each action
  const keyBindingByAction = useMemo(() => Object.fromEntries(keyBindings.map((binding) => [binding.action, binding])) as Record<KeyboardAction, KeyBinding>, [keyBindings]);

  const { working, setWorking, workingRef, abortWorking } = useLoading();
  const { videoRef, videoContainerRef, playbackRate, setPlaybackRate, outputPlaybackRate, setOutputPlaybackRate, commandedTime, seekAbs, playingRef, getRelevantTime, setPlaying, onSeeked, relevantTime, onStartPlaying, setCommandedTime, setCompatPlayerEventId, compatPlayerEventId, setOutputPlaybackRateState, commandedTimeRef, onStopPlaying, onVideoAbort, playerTime, setPlayerTime, playbackModeRef, playing, play, pause, seekRel } = useVideo({ filePath });
  const { timecodePlaceholder, formatTimecode, formatTimeAndFrames, parseTimecode, getFrameCount } = useTimecode({ detectedFps, timecodeFormat });
  const { loadSubtitle, subtitlesByStreamId, setSubtitlesByStreamId } = useSubtitles();

  const fileDurationNonZero = isDurationValid(fileDuration) ? fileDuration : 1;
  const zoom = Math.floor(zoomUnrounded);
  const zoomedDuration = isDurationValid(fileDuration) ? fileDuration / zoom : undefined;
  const zoomWindowEndTime = useMemo(() => (zoomedDuration != null ? zoomWindowStartTime + zoomedDuration : undefined), [zoomedDuration, zoomWindowStartTime]);

  useEffect(() => setDocumentTitle({ filePath, working: working?.text, progress }), [progress, filePath, working?.text]);

  useEffect(() => setProgressBar(progress ?? -1), [progress]);

  useEffect(() => {
    ffmpegSetCustomFfPath(customFfPath);
  }, [customFfPath]);

  const outSegTemplateOrDefault = outSegTemplate || defaultOutSegTemplate;
  const mergedFileTemplateOrDefault = mergedFileTemplate || defaultCutMergedFileTemplate;

  useEffect(() => {
    const l = language || fallbackLng;
    i18n.changeLanguage(l).catch(console.error);
    electron.ipcRenderer.send('setLanguage', l);
  }, [language]);


  const isFileOpened = !!filePath;

  const onOutputFormatUserChange = useCallback((newFormat: string) => {
    setFileFormat(newFormat);
    if (outFormatLocked) {
      setOutFormatLocked(newFormat === detectedFileFormat ? undefined : newFormat);
    }
  }, [detectedFileFormat, outFormatLocked, setFileFormat, setOutFormatLocked]);

  const previousPlaybackVolume = useRef(playbackVolume);
  const toggleMuted = useCallback(() => {
    setPlaybackVolume((volume) => {
      if (volume === 0) {
        return previousPlaybackVolume.current || 1;
      }
      previousPlaybackVolume.current = volume;
      return 0;
    });
  }, [setPlaybackVolume]);

  const toggleShowThumbnails = useCallback(() => setThumbnailsEnabled((v) => !v), []);

  const hideAllNotifications = hideNotifications === 'all';

  const showNotification = useCallback((opts: SweetAlertOptions) => {
    if (!hideAllNotifications) {
      toast.fire(opts);
    }
  }, [hideAllNotifications]);

  const showOsNotification = useCallback((text: string) => {
    if (hideOsNotifications == null) {
      sendOsNotification({ title: text });
    }
  }, [hideOsNotifications]);

  const toggleExportConfirmEnabled = useCallback(() => setExportConfirmEnabled((v) => {
    const newVal = !v;
    showNotification({ text: newVal ? i18n.t('Export options will be shown before exporting.') : i18n.t('Export options will not be shown before exporting.') });
    return newVal;
  }), [setExportConfirmEnabled, showNotification]);

  const toggleShowKeyframes = useCallback(() => {
    setKeyframesEnabled((old) => {
      const enabled = !old;
      if (enabled && !calcShouldShowKeyframes(zoomedDuration)) {
        showNotification({ text: i18n.t('Key frames will show on the timeline. You need to zoom in to view them') });
      }
      return enabled;
    });
  }, [showNotification, zoomedDuration]);

  const appendLastCommandsLog = useCallback((command: string) => {
    setFfmpegCommandLog((old) => [...old, { command, time: new Date() }]);
  }, []);
  const appendFfmpegCommandLog = useCallback((args: string[]) => appendLastCommandsLog(getFfCommandLine('ffmpeg', args)), [appendLastCommandsLog]);

  const toggleSegmentsList = useCallback(() => setShowRightBar((v) => !v), []);

  const toggleWaveformMode = useCallback(() => {
    // eslint-disable-next-line unicorn/prefer-switch
    if (waveformMode === 'waveform') {
      setWaveformMode('big-waveform');
    } else if (waveformMode === 'big-waveform') {
      setWaveformMode(undefined);
    } else {
      showNotification({ text: i18n.t('Mini-waveform has been enabled. Click again to enable full-screen waveform') });
      setWaveformMode('waveform');
    }
  }, [showNotification, waveformMode]);

  const toggleSafeOutputFileName = useCallback(() => setSafeOutputFileName((v) => {
    if (v) showNotification({ icon: 'info', text: i18n.t('Output file name will not be sanitized, and any special characters will be preserved. This may cause the export to fail and can cause other funny issues. Use at your own risk!') });
    return !v;
  }), [setSafeOutputFileName, showNotification]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = playbackVolume;
  }, [playbackVolume, videoRef]);


  const mainStreams = useMemo(() => mainFileMeta?.streams ?? [], [mainFileMeta?.streams]);
  const mainFileFormatData = useMemo(() => mainFileMeta?.formatData, [mainFileMeta?.formatData]);
  const mainFileChapters = useMemo(() => mainFileMeta?.chapters, [mainFileMeta?.chapters]);

  const subtitleStreams = useMemo(() => getSubtitleStreams(mainStreams), [mainStreams]);
  const videoStreams = useMemo(() => getRealVideoStreams(mainStreams), [mainStreams]);
  const audioStreams = useMemo(() => getAudioStreams(mainStreams), [mainStreams]);

  const mainVideoStream = useMemo(() => videoStreams[0], [videoStreams]);
  const mainAudioStream = useMemo(() => audioStreams[0], [audioStreams]);

  const activeSubtitle = useMemo(() => (activeSubtitleStreamIndex != null ? subtitlesByStreamId[activeSubtitleStreamIndex] : undefined), [activeSubtitleStreamIndex, subtitlesByStreamId]);
  const activeVideoStream = useMemo(() => (activeVideoStreamIndex != null ? videoStreams.find((stream) => stream.index === activeVideoStreamIndex) : undefined) ?? mainVideoStream, [activeVideoStreamIndex, mainVideoStream, videoStreams]);
  const activeAudioStreams = useMemo(() => {
    let ret: FFprobeStream[] = [];
    if (activeAudioStreamIndexes.size > 0) ret = audioStreams.filter((stream) => activeAudioStreamIndexes.has(stream.index));
    if (ret.length === 0 && mainAudioStream != null) ret = [mainAudioStream];
    return ret;
  }, [activeAudioStreamIndexes, audioStreams, mainAudioStream]);

  // 360 means we don't modify rotation gtrgt
  const isRotationSet = rotation !== 360;
  const effectiveRotation = useMemo(() => (isRotationSet ? rotation : (activeVideoStream?.tags?.rotate ? parseInt(activeVideoStream.tags.rotate, 10) : undefined)), [isRotationSet, activeVideoStream, rotation]);

  const zoomAbs = useCallback((fn: (v: number) => number) => setZoom((z) => Math.min(Math.max(fn(z), 1), zoomMax)), []);
  const zoomRel = useCallback((rel: number) => zoomAbs((z) => z + (rel * (1 + (z / 10)))), [zoomAbs]);
  const compatPlayerRequired = (
    // when using html5ified dummy video, we *have* to use canvas player
    usingDummyVideo
    // or if user selected an explicit video or audio stream, and the html5 player does not have any track index corresponding to the selected stream index
    || (
      (activeVideoStreamIndex != null || activeAudioStreamIndexes.size === 1)
      && videoRef.current != null
      && !canHtml5PlayerPlayStreams(videoRef.current, activeVideoStreamIndex, [...activeAudioStreamIndexes][0])
    )
    // or if selected multiple audio streams (html5 video element doesn't support that)
    || activeAudioStreamIndexes.size > 1
  );
  // if user selected a rotation, but they might want to turn off the rotation preview
  // but allow the user to disable
  const compatPlayerWanted = isRotationSet && !hideMediaSourcePlayer;

  const compatPlayerEnabled = (compatPlayerRequired || compatPlayerWanted) && (activeVideoStream != null || activeAudioStreams.length > 0);

  const shouldShowPlaybackStreamSelector = videoStreams.length > 0 || audioStreams.length > 0 || (subtitleStreams.length > 0 && !compatPlayerEnabled);

  useEffect(() => {
    // Reset the user preference when we go from not having compat player to having it
    if (compatPlayerEnabled) setHideMediaSourcePlayer(false);
  }, [compatPlayerEnabled]);

  const comfortZoom = isDurationValid(fileDuration) ? Math.max(fileDuration / 100, 1) : undefined;
  const timelineToggleComfortZoom = useCallback(() => {
    if (!comfortZoom) return;

    zoomAbs((prevZoom) => {
      if (prevZoom === 1) return comfortZoom;
      return 1;
    });
  }, [comfortZoom, zoomAbs]);


  const maxLabelLength = safeOutputFileName ? 100 : 500;

  const checkFileOpened = useCallback(() => {
    if (isFileOpened) return true;
    toast.fire({ icon: 'info', title: i18n.t('You need to open a media file first') });
    return false;
  }, [isFileOpened]);

  const {
    cutSegments, cutSegmentsHistory, createSegmentsFromKeyframes, shuffleSegments, detectBlackScenes, detectSilentScenes, detectSceneChanges, removeSegment, invertAllSegments, fillSegmentsGaps, combineOverlappingSegments, combineSelectedSegments, shiftAllSegmentTimes, alignSegmentTimesToKeyframes, updateSegOrder, updateSegOrders, reorderSegsByStartTime, addSegment, setCutStart, setCutEnd, labelSegment, splitCurrentSegment, focusSegmentAtCursor, selectSegmentsAtCursor, createNumSegments, createFixedDurationSegments, createFixedByteSizedSegments, createRandomSegments, haveInvalidSegs, currentSegIndexSafe, currentCutSeg, inverseCutSegments, clearSegments, clearSegColorCounter, loadCutSegments, setCutTime, setCurrentSegIndex, labelSelectedSegments, deselectAllSegments, selectAllSegments, selectOnlyCurrentSegment, toggleCurrentSegmentSelected, invertSelectedSegments, removeSelectedSegments, selectSegmentsByLabel, selectSegmentsByExpr, selectAllMarkers, mutateSegmentsByExpr, toggleSegmentSelected, selectOnlySegment, selectedSegments, segmentsOrInverse, segmentsToExport, duplicateCurrentSegment, duplicateSegment, updateSegAtIndex, findSegmentsAtCursor, maybeCreateFullLengthSegment,
  } = useSegments({ filePath, workingRef, setWorking, setProgress, videoStream: activeVideoStream, fileDuration, getRelevantTime, maxLabelLength, checkFileOpened, invertCutSegments, segmentsToChaptersOnly, timecodePlaceholder, parseTimecode, appendFfmpegCommandLog, fileDurationNonZero, mainFileMeta, seekAbs, activeVideoStreamIndex, activeAudioStreamIndexes });

  const { getEdlFilePath, projectFileSavePath, getProjectFileSavePath } = useSegmentsAutoSave({ autoSaveProjectFile, storeProjectInWorkingDir, filePath, customOutDir, cutSegments });

  const { nonCopiedExtraStreams, exportExtraStreams, mainCopiedThumbnailStreams, numStreamsToCopy, toggleStripVideo, toggleStripAudio, toggleStripSubtitle, toggleStripThumbnail, toggleStripAll, copyStreamIdsByFile, setCopyStreamIdsByFile, copyFileStreams, mainCopiedStreams, setCopyStreamIdsForPath, toggleCopyStreamId, isCopyingStreamId, toggleCopyStreamIds, changeEnabledStreamsFilter, applyEnabledStreamsFilter, enabledStreamsFilter, toggleCopyAllStreamsForPath } = useStreamsMeta({ mainStreams, externalFilesMeta, filePath, autoExportExtraStreams });

  const onDurationChange = useCallback<ReactEventHandler<HTMLVideoElement>>((e) => {
    // Some files report duration infinity first, then proper duration later
    // Sometimes after seeking to end of file, duration might change
    const { duration: durationNew } = e.currentTarget;
    console.log('onDurationChange', durationNew);
    if (isDurationValid(durationNew)) {
      setFileDuration(durationNew);
      maybeCreateFullLengthSegment(durationNew);
    }
  }, [maybeCreateFullLengthSegment]);

  const segmentsAtCursor = useMemo(() => findSegmentsAtCursor(commandedTime).map((index) => cutSegments[index]), [commandedTime, cutSegments, findSegmentsAtCursor]);
  const firstSegmentAtCursor = useMemo(() => segmentsAtCursor[0], [segmentsAtCursor]);

  const segmentAtCursorRef = useRef<StateSegment>();
  useEffect(() => {
    segmentAtCursorRef.current = firstSegmentAtCursor;
  }, [firstSegmentAtCursor]);

  const seekRelPercent = useCallback((val: number) => {
    if (!isDurationValid(zoomedDuration)) return;
    seekRel(val * zoomedDuration);
  }, [seekRel, zoomedDuration]);

  const shortStep = useCallback((direction: number) => {
    // If we don't know fps, just assume 30 (for example if unknown audio file)
    const fps = detectedFps || 30;

    // try to align with frame
    const currentTimeNearestFrameNumber = getFrameCountRaw(fps, videoRef.current!.currentTime);
    invariant(currentTimeNearestFrameNumber != null);
    const nextFrame = currentTimeNearestFrameNumber + direction;
    seekAbs(nextFrame / fps);
  }, [detectedFps, seekAbs, videoRef]);

  const jumpSegStart = useCallback((index: number) => {
    const seg = cutSegments[index];
    if (seg != null) seekAbs(seg.start);
  }, [cutSegments, seekAbs]);
  const jumpSegEnd = useCallback((index: number) => {
    const seg = cutSegments[index];
    if (seg?.end != null) seekAbs(seg.end);
  }, [cutSegments, seekAbs]);
  const jumpCutStart = useCallback(() => jumpSegStart(currentSegIndexSafe), [currentSegIndexSafe, jumpSegStart]);
  const jumpCutEnd = useCallback(() => jumpSegEnd(currentSegIndexSafe), [currentSegIndexSafe, jumpSegEnd]);
  const jumpTimelineStart = useCallback(() => seekAbs(0), [seekAbs]);
  const jumpTimelineEnd = useCallback(() => seekAbs(fileDuration), [fileDuration, seekAbs]);

  // const getSafeCutTime = useCallback((cutTime, next) => ffmpeg.getSafeCutTime(neighbouringFrames, cutTime, next), [neighbouringFrames]);

  const outputDir = getOutDir(customOutDir, filePath);

  const usingPreviewFile = !!previewFilePath;
  const effectiveFilePath = previewFilePath || filePath;
  const fileUri = useMemo(() => {
    if (!effectiveFilePath) return ''; // Setting video src="" prevents memory leak in chromium
    const uri = pathToFileURL(effectiveFilePath).href;
    // https://github.com/mifi/lossless-cut/issues/1674
    if (cacheBuster !== 0) {
      const qs = new URLSearchParams();
      qs.set('t', String(cacheBuster));
      return `${uri}?${qs.toString()}`;
    }
    return uri;
  }, [cacheBuster, effectiveFilePath]);


  const increaseRotation = useCallback(() => {
    setRotation((r) => (r + 90) % 450);
    setHideMediaSourcePlayer(false);
    // Matroska is known not to work, so we warn user. See https://github.com/mifi/lossless-cut/discussions/661
    const supportsRotation = !(fileFormat != null && ['matroska', 'webm'].includes(fileFormat));
    if (!supportsRotation) showNotification({ text: i18n.t('Lossless rotation might not work with this file format. You may try changing to MP4') });
  }, [fileFormat, showNotification]);

  const { ensureWritableOutDir, ensureAccessToSourceDir } = useDirectoryAccess({ setCustomOutDir });

  const toggleCaptureFormat = useCallback(() => setCaptureFormat((f) => {
    const captureFormats: CaptureFormat[] = ['jpeg', 'png', 'webp'];
    let index = captureFormats.indexOf(f);
    if (index === -1) index = 0;
    index += 1;
    if (index >= captureFormats.length) index = 0;
    const newCaptureFormat = captureFormats[index];
    if (newCaptureFormat == null) throw new Error();
    return newCaptureFormat;
  }), [setCaptureFormat]);

  const toggleKeyframeCut = useCallback((showMessage?: boolean) => setKeyframeCut((val) => {
    const newVal = !val;
    if (showMessage) {
      if (newVal) showNotification({ title: i18n.t('Keyframe cut enabled'), text: i18n.t('Will now cut at the nearest keyframe before the desired start cutpoint. This is recommended for most files.') });
      else showNotification({ title: i18n.t('Keyframe cut disabled'), text: i18n.t('Will now cut at the exact position, but may leave an empty portion at the beginning of the file. You may have to set the cutpoint a few frames before the next keyframe to achieve a precise cut'), timer: 7000 });
    }
    return newVal;
  }), [showNotification, setKeyframeCut]);

  const toggleSimpleMode = useCallback(() => setSimpleMode((v) => {
    showNotification({ text: v ? i18n.t('Advanced view has been enabled. You will now also see non-essential buttons and functions') : i18n.t('Advanced view disabled. You will now see only the most essential buttons and functions') });
    const newValue = !v;
    if (newValue) setInvertCutSegments(false);
    return newValue;
  }), [setInvertCutSegments, setSimpleMode, showNotification]);

  const effectiveExportMode = useMemo(() => {
    if (segmentsToChaptersOnly) return 'segments_to_chapters';
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
      setCustomOutDir(undefined);
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

  const userSettingsContext = useMemo<UserSettingsContextType>(() => ({
    ...allUserSettings, toggleCaptureFormat, changeOutDir, toggleKeyframeCut, toggleExportConfirmEnabled, toggleSimpleMode, toggleSafeOutputFileName, effectiveExportMode,
  }), [allUserSettings, changeOutDir, effectiveExportMode, toggleCaptureFormat, toggleExportConfirmEnabled, toggleKeyframeCut, toggleSafeOutputFileName, toggleSimpleMode]);

  const segColorsContext = useMemo(() => ({
    getSegColor: (seg: SegmentColorIndex | undefined) => {
      const color = getSegColor(seg);
      return preferStrongColors ? color.desaturate(0.2) : color.desaturate(0.6);
    },
  }), [preferStrongColors]);

  const onActiveSubtitleChange = useCallback(async (index?: number) => {
    if (index == null) {
      setActiveSubtitleStreamIndex(undefined);
      return;
    }
    if (subtitlesByStreamId[index]) { // Already loaded
      setActiveSubtitleStreamIndex(index);
      return;
    }
    const subtitleStream = index != null && subtitleStreams.find((s) => s.index === index);
    if (!subtitleStream || workingRef.current) return;

    setWorking({ text: i18n.t('Loading subtitle') });
    try {
      await withErrorHandling(async () => {
        invariant(filePath != null);
        await loadSubtitle({ filePath, index, subtitleStream });
        setActiveSubtitleStreamIndex(index);
      }, i18n.t('Failed to load subtitles from track {{index}}', { index }));
    } finally {
      setWorking(undefined);
    }
  }, [subtitlesByStreamId, subtitleStreams, workingRef, setWorking, filePath, loadSubtitle]);

  const onActiveVideoStreamChange = useCallback((videoStreamIndex?: number) => {
    invariant(videoRef.current);
    setHideMediaSourcePlayer(false);
    enableVideoTrack(videoRef.current, videoStreamIndex);
    setActiveVideoStreamIndex(videoStreamIndex);
  }, [videoRef]);

  const onActiveAudioStreamsChange = useCallback((audioStreamIndexes: Set<number>) => {
    invariant(videoRef.current);
    setHideMediaSourcePlayer(false);
    enableAudioTrack(videoRef.current, [...audioStreamIndexes][0]);
    setActiveAudioStreamIndexes(audioStreamIndexes);
  }, [videoRef]);

  const allFilesMeta = useMemo(() => ({
    ...externalFilesMeta,
    ...(filePath && mainFileMeta != null ? { [filePath]: mainFileMeta } : {}),
  }), [externalFilesMeta, filePath, mainFileMeta]);

  // total number of streams for ALL files
  const numStreamsTotal = Object.values(allFilesMeta).flatMap(({ streams }) => streams).length;

  const hasAudio = activeAudioStreams.length > 0;
  const hasVideo = !!activeVideoStream;

  const waveformEnabled = hasAudio && waveformMode != null;
  const bigWaveformEnabled = waveformEnabled && waveformMode === 'big-waveform';
  const showThumbnails = thumbnailsEnabled && hasVideo;

  const { thumbnailsSorted, setThumbnails } = useThumbnails({ filePath, zoomedDuration, zoomWindowStartTime, showThumbnails });

  const { neighbouringKeyFrames, findNearestKeyFrameTime } = useKeyframes({ keyframesEnabled, filePath, commandedTime, videoStream: activeVideoStream, detectedFps, ffmpegExtractWindow });
  const { waveforms, overviewWaveform, renderOverviewWaveform } = useWaveform({ filePath, relevantTime, waveformEnabled, audioStream: activeAudioStreams[0], ffmpegExtractWindow, fileDuration });

  const onGenerateOverviewWaveformClick = useCallback(async () => {
    if (working) return;
    try {
      setWorking({ text: t('Generating full overview waveform, this may take a few minutes.') });
      await renderOverviewWaveform();
    } finally {
      setWorking();
    }
  }, [renderOverviewWaveform, setWorking, t, working]);

  const shouldShowKeyframes = keyframesEnabled && hasVideo && calcShouldShowKeyframes(zoomedDuration);
  const shouldShowWaveform = calcShouldShowWaveform(zoomedDuration) || overviewWaveform != null;

  const resetState = useCallback(() => {
    console.log('State reset');
    const video = videoRef.current;
    setCommandedTime(0);
    video!.currentTime = 0;
    setPlaybackRate(1);

    // setWorking();
    setPreviewFilePath(undefined);
    setUsingDummyVideo(false);
    setPlaying(false);
    playingRef.current = false;
    playbackModeRef.current = undefined;
    setCompatPlayerEventId(0);
    setFileDuration(undefined);
    cutSegmentsHistory.go(0);
    setFileFormat(undefined);
    setDetectedFileFormat(undefined);
    setRotation(360);
    setProgress(undefined);
    setStartTimeOffset(0);
    setFilePath(undefined);
    setExternalFilesMeta({});
    setCustomTagsByFile({});
    setParamsByStreamId(new Map());
    setDetectedFps(undefined);
    setMainFileMeta(undefined);
    setCopyStreamIdsByFile({});
    setStreamsSelectorShown(false);
    setZoom(1);
    setThumbnails([]);
    setShortestFlag(false);
    setZoomWindowStartTime(0);
    setSubtitlesByStreamId({});
    setActiveAudioStreamIndexes(new Set());
    setActiveVideoStreamIndex(undefined);
    setActiveSubtitleStreamIndex(undefined);
    setHideMediaSourcePlayer(false);
    setExportConfirmVisible(false);
    setOutputPlaybackRateState(1);
    setCurrentFileExportCount(0);
  }, [videoRef, setCommandedTime, setPlaybackRate, setPlaying, playingRef, playbackModeRef, setCompatPlayerEventId, setFileDuration, cutSegmentsHistory, setFileFormat, setDetectedFileFormat, setCopyStreamIdsByFile, setThumbnails, setSubtitlesByStreamId, setOutputPlaybackRateState]);


  const showUnsupportedFileMessage = useCallback(() => {
    showNotification({ timer: 13000, text: i18n.t('File is not natively supported. Preview playback may be slow and of low quality, but the final export will be lossless. You may convert the file from the menu for a better preview.') });
  }, [showNotification]);

  const showPreviewFileLoadedMessage = useCallback((fileName: string) => {
    showNotification({ icon: 'info', text: i18n.t('Loaded existing preview file: {{ fileName }}', { fileName }) });
  }, [showNotification]);

  const areWeCutting = useMemo(() => segmentsToExport.some(({ start, end }) => isCuttingStart(start) || isCuttingEnd(end, fileDuration)), [fileDuration, segmentsToExport]);
  const needSmartCut = !!(areWeCutting && enableSmartCut);

  const {
    concatFiles, html5ifyDummy, cutMultiple, autoConcatCutSegments, html5ify, fixInvalidDuration, extractStreams,
  } = useFfmpegOperations({ filePath, treatInputFileModifiedTimeAsStart, treatOutputFileModifiedTimeAsStart, needSmartCut, enableOverwriteOutput, outputPlaybackRate, cutFromAdjustmentFrames, cutToAdjustmentFrames, appendLastCommandsLog, smartCutCustomBitrate: smartCutBitrate, appendFfmpegCommandLog });

  const { captureFrameFromTag, captureFrameFromFfmpeg, captureFramesRange } = useFrameCapture({ appendFfmpegCommandLog, formatTimecode, treatOutputFileModifiedTimeAsStart });

  const html5ifyAndLoad = useCallback(async (cod: string | undefined, fp: string, speed: Html5ifyMode, hv: boolean, ha: boolean) => {
    const usesDummyVideo = speed === 'fastest';
    console.log('html5ifyAndLoad', { speed, hasVideo: hv, hasAudio: ha, usesDummyVideo });

    async function doHtml5ify() {
      if (speed == null) return undefined;
      if (speed === 'fastest') {
        const path = getSuffixedOutPath({ customOutDir: cod, filePath: fp, nameSuffix: `${html5ifiedPrefix}${html5dummySuffix}.mkv` });
        try {
          setProgress(0);
          await html5ifyDummy({ filePath: fp, outPath: path, onProgress: setProgress });
        } finally {
          setProgress(undefined);
        }
        return path;
      }

      try {
        const shouldIncludeVideo = !usesDummyVideo && hv;
        return await html5ify({ customOutDir: cod, filePath: fp, speed, hasAudio: ha, hasVideo: shouldIncludeVideo, onProgress: setProgress });
      } finally {
        setProgress(undefined);
      }
    }

    const path = await doHtml5ify();
    if (!path) return;

    setPreviewFilePath(path);
    setUsingDummyVideo(usesDummyVideo);
  }, [html5ify, html5ifyDummy]);

  const convertFormatBatch = useCallback(async () => {
    if (batchFiles.length === 0) return;
    const filePaths = batchFiles.map((f) => f.path);

    const failedFiles: string[] = [];
    let i = 0;
    const setTotalProgress = (fileProgress = 0) => setProgress((i + fileProgress) / filePaths.length);

    const { selectedOption: speed } = await askForHtml5ifySpeed({ allowedOptions: ['fast-audio-remux', 'fast-audio', 'fast', 'slow', 'slow-audio', 'slowest'] });
    if (!speed) return;

    if (workingRef.current) return;
    setWorking({ text: i18n.t('Batch converting to supported format') });
    setProgress(0);
    try {
      await withErrorHandling(async () => {
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

        if (failedFiles.length > 0) toast.fire({ title: `${i18n.t('Failed to convert files:')} ${failedFiles.join(' ')}`, timer: null as unknown as undefined, showConfirmButton: true });
      }, i18n.t('Failed to batch convert to supported format'));
    } finally {
      setWorking(undefined);
      setProgress(undefined);
    }
  }, [batchFiles, customOutDir, ensureWritableOutDir, html5ify, setWorking, workingRef]);

  const getConvertToSupportedFormat = useCallback((fallback: Html5ifyMode) => rememberConvertToSupportedFormat || fallback, [rememberConvertToSupportedFormat]);

  const html5ifyAndLoadWithPreferences = useCallback(async (cod: string | undefined, fp: string, speed: Html5ifyMode, hv: boolean, ha: boolean) => {
    if (!enableAutoHtml5ify) return;
    setWorking({ text: i18n.t('Converting to supported format') });
    await html5ifyAndLoad(cod, fp, getConvertToSupportedFormat(speed), hv, ha);
  }, [enableAutoHtml5ify, setWorking, html5ifyAndLoad, getConvertToSupportedFormat]);

  const getNewJumpIndex = (oldIndex: number, direction: -1 | 1) => Math.max(oldIndex + direction, 0);

  const jumpSeg = useCallback((params: ({ abs: number } | { rel: -1 | 1 }) & { seek?: true }) => {
    const clamp = (v: number) => Math.max(0, Math.min(v, cutSegments.length - 1));

    const seek = (index: number) => {
      if (params.seek && cutSegments[index]) seekAbs(cutSegments[index].start);
    };

    if ('abs' in params) {
      const index = clamp(params.abs);
      setCurrentSegIndex(index);
      seek(index);
    } else {
      setCurrentSegIndex((old) => {
        const index = clamp(getNewJumpIndex(old, params.rel));
        seek(index);
        return index;
      });
    }
  }, [cutSegments, seekAbs, setCurrentSegIndex]);

  const togglePlay = useCallback(({ resetPlaybackRate, requestPlaybackMode }: { resetPlaybackRate?: boolean, requestPlaybackMode?: PlaybackMode } | undefined = {}) => {
    playbackModeRef.current = requestPlaybackMode;

    if (playingRef.current) {
      pause();
      return;
    }

    // If we are using a special playback mode, we might need to do more:
    if (playbackModeRef.current != null) {
      const selectedSegmentsWithoutMarkers = filterNonMarkers(selectedSegments);
      const selectedSegmentAtCursor = selectedSegmentsWithoutMarkers.find((selectedSegment) => selectedSegment.segId === segmentAtCursorRef.current?.segId);
      const isSomeSegmentAtCursor = selectedSegmentAtCursor != null && commandedTimeRef.current != null && selectedSegmentAtCursor.end != null && selectedSegmentAtCursor.end - commandedTimeRef.current > 0.1;
      if (!isSomeSegmentAtCursor) { // if a segment is already at cursor, don't do anything
        // if no segment at cursor, and looping playback mode, continue looping
        if (playbackModeRef.current === 'loop-selected-segments') {
          const firstSelectedSegment = selectedSegmentsWithoutMarkers[0];
          if (firstSelectedSegment != null) {
            const index = cutSegments.findIndex((segment) => segment.segId === firstSelectedSegment.segId);
            if (index >= 0) setCurrentSegIndex(index);
            seekAbs(firstSelectedSegment.start);
          }
        } else if (currentCutSeg != null) {
          // for all other playback modes, seek to start of current segment
          seekAbs(currentCutSeg.start);
        }
      }
    }
    play(resetPlaybackRate);
  }, [playbackModeRef, playingRef, play, pause, selectedSegments, commandedTimeRef, cutSegments, setCurrentSegIndex, seekAbs, currentCutSeg]);

  const onTimeUpdate = useCallback<ReactEventHandler<HTMLVideoElement>>((e) => {
    const { currentTime } = e.currentTarget;
    if (playerTime === currentTime) return;
    setPlayerTime(currentTime);

    const playbackMode = playbackModeRef.current;

    const segmentsAtCursorIndexes = findSegmentsAtCursor(commandedTimeRef.current);
    const firstSegmentAtCursorIndex = segmentsAtCursorIndexes[0];
    const playingSegment = firstSegmentAtCursorIndex != null ? cutSegments[firstSegmentAtCursorIndex] : undefined;

    if (playbackMode != null && playingSegment && playingSegment.end != null) { // todo and is currently playing?
      const nextAction = getPlaybackMode({ playbackMode, currentTime, playingSegment: { start: playingSegment.start, end: playingSegment.end } });

      if (nextAction != null) {
        console.log(nextAction);
        if (nextAction.nextSegment) {
          const selectedSegmentsWithoutMarkers = filterNonMarkers(selectedSegments);

          const index = selectedSegmentsWithoutMarkers.findIndex((selectedSegment) => selectedSegment.segId === playingSegment.segId);
          let newIndex = getNewJumpIndex(index >= 0 ? index : 0, 1);
          if (newIndex > selectedSegmentsWithoutMarkers.length - 1) newIndex = 0; // have reached end of last segment, start over
          const nextSelectedSegment = selectedSegmentsWithoutMarkers[newIndex];
          if (nextSelectedSegment != null) seekAbs(nextSelectedSegment.start);
        }
        if (nextAction.seekTo != null) {
          seekAbs(nextAction.seekTo);
        }
        if (nextAction.exit) {
          playbackModeRef.current = undefined;
          pause();
        }
      }
    }
  }, [commandedTimeRef, cutSegments, findSegmentsAtCursor, pause, playbackModeRef, playerTime, seekAbs, selectedSegments, setPlayerTime]);

  const closeFileWithConfirm = useCallback(() => {
    if (!isFileOpened || workingRef.current) return;

    // eslint-disable-next-line no-alert
    if (askBeforeClose && !window.confirm(i18n.t('Are you sure you want to close the current file?'))) return;

    resetState();
    clearSegments();
  }, [isFileOpened, workingRef, askBeforeClose, resetState, clearSegments]);

  const closeBatch = useCallback(() => {
    // eslint-disable-next-line no-alert
    if (askBeforeClose && !window.confirm(i18n.t('Are you sure you want to close the loaded batch of files?'))) return;
    setBatchFiles([]);
    setSelectedBatchFiles([]);
  }, [askBeforeClose]);

  const batchListRemoveFile = useCallback((path: string | undefined) => {
    setBatchFiles((existingBatch) => {
      const index = existingBatch.findIndex((existingFile) => existingFile.path === path);
      if (index < 0) return existingBatch;
      const newBatch = [...existingBatch];
      newBatch.splice(index, 1);
      const newItemAtIndex = newBatch[index];
      if (newItemAtIndex != null) setSelectedBatchFiles([newItemAtIndex.path]);
      else if (newBatch.length > 0) setSelectedBatchFiles([newBatch[0]!.path]);
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

  const openSendReportDialogWithState = useCallback(async (err?: unknown) => {
    const state = {
      ...commonSettings,

      filePath,
      fileFormat,
      externalFilesMeta,
      mainStreams,
      copyStreamIdsByFile,
      cutSegments: cutSegments.map((s) => ({ start: s.start, end: s.end })),
      mainFileFormatData,
      rotation,
      shortestFlag,
      effectiveExportMode,
      outSegTemplate,
      mergedFileTemplate,
      preserveMetadata,
      preserveChapters,
    };

    openSendReportDialog(err, state);
  }, [commonSettings, copyStreamIdsByFile, cutSegments, effectiveExportMode, externalFilesMeta, fileFormat, filePath, mainFileFormatData, mainStreams, mergedFileTemplate, outSegTemplate, preserveChapters, preserveMetadata, rotation, shortestFlag]);

  const openSendConcatReportDialogWithState = useCallback(async (err: unknown, reportState?: object) => {
    const state = { ...commonSettings, ...reportState };
    openSendReportDialog(err, state);
  }, [commonSettings]);

  const handleExportFailed = useCallback(async (err: unknown) => {
    const sendErrorReport = await showExportFailedDialog({ fileFormat, safeOutputFileName });
    if (sendErrorReport) openSendReportDialogWithState(err);
  }, [fileFormat, safeOutputFileName, openSendReportDialogWithState]);

  const handleConcatFailed = useCallback(async (err: unknown, reportState: object) => {
    const sendErrorReport = await showConcatFailedDialog({ fileFormat });
    if (sendErrorReport) openSendConcatReportDialogWithState(err, reportState);
  }, [fileFormat, openSendConcatReportDialogWithState]);

  const userConcatFiles = useCallback(async ({ paths, includeAllStreams, streams, fileFormat: outFormat, outFileName, clearBatchFilesAfterConcat }: {
    paths: string[], includeAllStreams: boolean, streams: FFprobeStream[], fileFormat: string, outFileName: string, clearBatchFilesAfterConcat: boolean,
  }) => {
    if (workingRef.current) return;
    try {
      setConcatDialogVisible(false);
      setWorking({ text: i18n.t('Merging') });

      const firstPath = paths[0];
      if (!firstPath) return;

      const newCustomOutDir = await ensureWritableOutDir({ inputPath: firstPath, outDir: customOutDir });

      const outDir = getOutDir(newCustomOutDir, firstPath);

      const outPath = getOutPath({ customOutDir: newCustomOutDir, filePath: firstPath, fileName: outFileName });

      let chaptersFromSegments: Awaited<ReturnType<typeof createChaptersFromSegments>>;
      if (segmentsToChapters) {
        const chapterNames = paths.map((path) => parsePath(path).name);
        chaptersFromSegments = await createChaptersFromSegments({ segmentPaths: paths, chapterNames });
      }

      const inputSize = sum(await readFileSizes(paths));

      // console.log('merge', paths);
      const metadataFromPath = paths[0];
      invariant(metadataFromPath != null);
      const { haveExcludedStreams } = await concatFiles({ paths, outPath, outDir, outFormat, metadataFromPath, includeAllStreams, streams, ffmpegExperimental, onProgress: setProgress, preserveMovData, movFastStart, preserveMetadataOnMerge, chapters: chaptersFromSegments });

      const warnings: string[] = [];
      const notices: string[] = [];

      const outputSize = await readFileSize(outPath); // * 1.06; // testing:)
      const sizeCheckResult = checkFileSizes(inputSize, outputSize);
      if (sizeCheckResult != null) warnings.push(sizeCheckResult);

      if (clearBatchFilesAfterConcat) closeBatch();
      if (!includeAllStreams && haveExcludedStreams) notices.push(i18n.t('Some extra tracks have been discarded. You can change this option before merging.'));

      if (!hideAllNotifications) {
        showOsNotification(i18n.t('Merge finished'));
        openConcatFinishedToast({ filePath: outPath, notices, warnings });
      }
    } catch (err) {
      if (err instanceof DirectoryAccessDeclinedError || isAbortedError(err)) return;

      showOsNotification(i18n.t('Failed to merge'));

      if (isExecaError(err)) {
        console.log('stdout:', getStdioString(err.stdout));
        console.error('stderr:', getStdioString(err.stderr));

        if (isOutOfSpaceError(err)) {
          showDiskFull();
          return;
        }
        if (isMuxNotSupported(err)) {
          showMuxNotSupported();
          return;
        }
      }

      if (err instanceof OutputNotWritableError) {
        showOutputNotWritable();
        return;
      }

      const reportState = { includeAllStreams, streams, outFormat, outFileName, segmentsToChapters };
      handleConcatFailed(err, reportState);
    } finally {
      setWorking(undefined);
      setProgress(undefined);
    }
  }, [workingRef, setWorking, ensureWritableOutDir, customOutDir, segmentsToChapters, concatFiles, ffmpegExperimental, preserveMovData, movFastStart, preserveMetadataOnMerge, closeBatch, hideAllNotifications, showOsNotification, handleConcatFailed]);

  const cleanupFiles = useCallback(async (cleanupChoices2: CleanupChoicesType) => {
    // Store paths before we reset state
    const savedPaths = { previewFilePath, sourceFilePath: filePath, projectFilePath: projectFileSavePath };

    if (cleanupChoices2.closeFile) {
      batchListRemoveFile(savedPaths.sourceFilePath);

      // close the file
      resetState();
      clearSegments();
    }

    await withErrorHandling(async () => {
      const abortController = new AbortController();
      setWorking({ text: i18n.t('Cleaning up'), abortController });
      console.log('Cleaning up files', cleanupChoices2);

      const pathsToDelete: string[] = [];
      if (cleanupChoices2.trashTmpFiles && savedPaths.previewFilePath) pathsToDelete.push(savedPaths.previewFilePath);
      if (cleanupChoices2.trashProjectFile && savedPaths.projectFilePath) pathsToDelete.push(savedPaths.projectFilePath);
      if (cleanupChoices2.trashSourceFile && savedPaths.sourceFilePath) pathsToDelete.push(savedPaths.sourceFilePath);

      await deleteFiles({ paths: pathsToDelete, deleteIfTrashFails: cleanupChoices2.deleteIfTrashFails, signal: abortController.signal });
    }, (err) => i18n.t('Unable to delete file: {{message}}', { message: err instanceof Error ? err.message : String(err) }));
  }, [batchListRemoveFile, clearSegments, filePath, previewFilePath, projectFileSavePath, resetState, setWorking]);

  const askForCleanupChoices = useCallback(async () => {
    const trashResponse = await showCleanupFilesDialog(cleanupChoices);
    if (!trashResponse) return undefined; // Canceled
    setCleanupChoices(trashResponse); // Store for next time
    return trashResponse;
  }, [cleanupChoices, setCleanupChoices]);

  const cleanupFilesWithDialog = useCallback(async () => {
    let response: CleanupChoicesType | undefined = cleanupChoices;
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
      setWorking(undefined);
    }
  }, [cleanupFilesWithDialog, isFileOpened, setWorking, workingRef]);

  const generateOutSegFileNames = useCallback(async (template: string) => {
    invariant(fileFormat != null && outputDir != null && filePath != null);
    return generateOutSegFileNamesRaw({ fileDuration, exportCount, currentFileExportCount, segmentsToExport, template, formatTimecode, isCustomFormatSelected, fileFormat, filePath, outputDir, safeOutputFileName, maxLabelLength, outputFileNameMinZeroPadding });
  }, [currentFileExportCount, exportCount, fileDuration, fileFormat, filePath, formatTimecode, isCustomFormatSelected, maxLabelLength, outputDir, outputFileNameMinZeroPadding, safeOutputFileName, segmentsToExport]);

  const generateMergedFileNames = useCallback(async (template: string) => {
    invariant(fileFormat != null && filePath != null);
    return generateMergedFileNamesRaw({ template, isCustomFormatSelected, fileFormat, filePath, outputDir, safeOutputFileName, maxLabelLength, exportCount, currentFileExportCount, segmentsToExport });
  }, [currentFileExportCount, exportCount, fileFormat, filePath, isCustomFormatSelected, maxLabelLength, outputDir, safeOutputFileName, segmentsToExport]);

  const closeExportConfirm = useCallback(() => setExportConfirmVisible(false), []);

  const willMerge = segmentsToExport.length > 1 && autoMerge;

  const onExportConfirm = useCallback(async () => {
    invariant(filePath != null);

    if (numStreamsToCopy === 0) {
      errorToast(i18n.t('No tracks selected for export'));
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
      let chaptersToAdd: Chapter[] | undefined;
      if (segmentsToChaptersOnly) {
        const sortedSegments = sortSegments(segmentsOrInverse.selected);
        if (hasAnySegmentOverlap(sortedSegments)) {
          errorToast(i18n.t('Make sure you have no overlapping segments.'));
          return;
        }
        chaptersToAdd = convertSegmentsToChapters(sortedSegments);
      }

      console.log('outSegTemplateOrDefault', outSegTemplateOrDefault);

      const notices: string[] = [];
      const warnings: string[] = [];

      const { fileNames: outSegFileNames, problems: outSegProblems } = await generateOutSegFileNames(outSegTemplateOrDefault);
      if (outSegProblems.error != null) {
        console.warn('Output segments file name invalid, using default instead', outSegFileNames);
        warnings.push(t('Fell back to default output file name'), outSegProblems.error);
      }

      // throw (() => { const err = new Error('test'); err.code = 'ENOENT'; return err; })();
      const outFiles = await cutMultiple({
        outputDir,
        customOutDir,
        outFormat: fileFormat,
        fileDuration,
        rotation: isRotationSet ? effectiveRotation : undefined,
        copyFileStreams,
        allFilesMeta,
        keyframeCut,
        segments: segmentsToExport,
        outSegFileNames,
        onProgress: setProgress,
        shortestFlag,
        ffmpegExperimental,
        preserveMetadata,
        preserveMetadataOnMerge,
        preserveMovData,
        preserveChapters,
        movFastStart,
        avoidNegativeTs,
        customTagsByFile,
        paramsByStreamId,
        chapters: chaptersToAdd,
        detectedFps,
      });

      let mergedOutFilePath: string | undefined;

      if (willMerge) {
        console.log('mergedFileTemplateOrDefault', mergedFileTemplateOrDefault);

        setProgress(0);
        setWorking({ text: i18n.t('Merging') });

        const chapterNames = segmentsToChapters && !invertCutSegments ? segmentsToExport.map((s) => s.name) : undefined;

        const { fileNames, problems } = await generateMergedFileNames(mergedFileTemplateOrDefault);
        if (problems.error != null) {
          console.warn('Merged file name invalid, using default instead', fileNames[0]);
          warnings.push(t('Fell back to default output file name'), problems.error);
        }

        const [fileName] = fileNames;
        invariant(fileName != null);
        mergedOutFilePath = getOutPath({ customOutDir, filePath, fileName });

        await autoConcatCutSegments({
          customOutDir,
          outFormat: fileFormat,
          segmentPaths: outFiles,
          ffmpegExperimental,
          preserveMovData,
          movFastStart,
          onProgress: setProgress,
          chapterNames,
          autoDeleteMergedSegments,
          preserveMetadataOnMerge,
          mergedOutFilePath,
        });
      }

      if (!enableOverwriteOutput) warnings.push(i18n.t('Overwrite output setting is disabled and some files might have been skipped.'));

      if (!exportConfirmEnabled) notices.push(i18n.t('Export options are not shown. You can enable export options by clicking the icon right next to the export button.'));

      invariant(mainFileFormatData != null);
      // https://github.com/mifi/lossless-cut/issues/329
      if (isIphoneHevc(mainFileFormatData, mainStreams)) warnings.push(i18n.t('There is a known issue with cutting iPhone HEVC videos. The output file may not work in all players.'));

      // https://github.com/mifi/lossless-cut/issues/280
      if (!ffmpegExperimental && isProblematicAvc1(fileFormat, mainStreams)) warnings.push(i18n.t('There is a known problem with this file type, and the output might not be playable. You can work around this problem by enabling the "Experimental flag" under Settings.'));

      if (exportExtraStreams) {
        try {
          setProgress(undefined); // If extracting extra streams takes a long time, prevent loader from being stuck at 100%
          setWorking({ text: i18n.t('Extracting {{count}} unprocessable tracks', { count: nonCopiedExtraStreams.length }) });
          await extractStreams({ customOutDir, streams: nonCopiedExtraStreams });
          notices.push(i18n.t('Unprocessable streams were exported as separate files.'));
        } catch (err) {
          console.error('Extra stream export failed', err);
          warnings.push(i18n.t('Unable to export unprocessable streams.'));
        }
      }

      if (areWeCutting) notices.push(i18n.t('Cutpoints may be inaccurate.'));

      const revealPath = willMerge && mergedOutFilePath != null ? mergedOutFilePath : outFiles[0];
      invariant(revealPath != null);
      if (!hideAllNotifications) {
        showOsNotification(i18n.t('Export finished'));
        openExportFinishedToast({ filePath: revealPath, warnings, notices });
      }

      if (cleanupChoices.cleanupAfterExport) await cleanupFilesWithDialog();

      setExportCount((c) => c + 1);
      setCurrentFileExportCount((c) => c + 1);
    } catch (err) {
      if (isAbortedError(err)) return;

      showOsNotification(i18n.t('Failed to export'));

      if (isExecaError(err)) {
        console.log('stdout:', getStdioString(err.stdout));
        console.error('stderr:', getStdioString(err.stderr));

        if (isOutOfSpaceError(err)) {
          showDiskFull();
          return;
        }
        if (isMuxNotSupported(err)) {
          showMuxNotSupported();
          return;
        }
      }

      if (err instanceof OutputNotWritableError) {
        showOutputNotWritable();
        return;
      }

      handleExportFailed(err);
    } finally {
      setWorking(undefined);
      setProgress(undefined);
    }
  }, [filePath, numStreamsToCopy, segmentsToExport, haveInvalidSegs, workingRef, setWorking, segmentsToChaptersOnly, outSegTemplateOrDefault, generateOutSegFileNames, cutMultiple, outputDir, customOutDir, fileFormat, fileDuration, isRotationSet, effectiveRotation, copyFileStreams, allFilesMeta, keyframeCut, shortestFlag, ffmpegExperimental, preserveMetadata, preserveMetadataOnMerge, preserveMovData, preserveChapters, movFastStart, avoidNegativeTs, customTagsByFile, paramsByStreamId, detectedFps, willMerge, enableOverwriteOutput, exportConfirmEnabled, mainFileFormatData, mainStreams, exportExtraStreams, areWeCutting, hideAllNotifications, cleanupChoices.cleanupAfterExport, cleanupFilesWithDialog, segmentsOrInverse, t, mergedFileTemplateOrDefault, segmentsToChapters, invertCutSegments, generateMergedFileNames, autoConcatCutSegments, autoDeleteMergedSegments, nonCopiedExtraStreams, extractStreams, showOsNotification, handleExportFailed]);

  const onExportPress = useCallback(async () => {
    if (!filePath) return;

    if (!exportConfirmEnabled || exportConfirmVisible) {
      await onExportConfirm();
    } else {
      setExportConfirmVisible(true);
      setStreamsSelectorShown(false);
    }
  }, [filePath, exportConfirmEnabled, exportConfirmVisible, onExportConfirm]);

  const captureSnapshot = useCallback(async () => {
    if (!filePath) return;

    await withErrorHandling(async () => {
      const currentTime = getRelevantTime();
      const video = videoRef.current;
      if (video == null) throw new Error();
      const usingFfmpeg = usingPreviewFile || captureFrameMethod === 'ffmpeg';
      const outPath = usingFfmpeg
        ? await captureFrameFromFfmpeg({ customOutDir, filePath, time: currentTime, captureFormat, quality: captureFrameQuality })
        : await captureFrameFromTag({ customOutDir, filePath, time: currentTime, captureFormat, quality: captureFrameQuality, video });

      if (!hideAllNotifications) openDirToast({ icon: 'success', filePath: outPath, text: `${i18n.t('Screenshot captured to:')} ${outPath}` });
    }, i18n.t('Failed to capture frame'));
  }, [filePath, getRelevantTime, videoRef, usingPreviewFile, captureFrameMethod, captureFrameFromFfmpeg, customOutDir, captureFormat, captureFrameQuality, captureFrameFromTag, hideAllNotifications]);

  const extractSegmentsFramesAsImages = useCallback(async (segments: SegmentBase[]) => {
    if (!filePath || detectedFps == null || workingRef.current || segments.length === 0) return;
    const segmentsNumFrames = segments.reduce((acc, { start, end }) => acc + (end == null ? 1 : (getFrameCount(end - start) ?? 0)), 0);
    // If all segments are markers, we shall export every marker as a file and therefore we don't have to ask user
    const areAllSegmentsMarkers = segments.every((seg) => seg.end == null);
    const captureFramesResponse = areAllSegmentsMarkers
      ? { filter: undefined, estimatedMaxNumFiles: segmentsNumFrames }
      : await askExtractFramesAsImages({ segmentsNumFrames, plural: segments.length > 1, fps: detectedFps });

    if (captureFramesResponse == null) return;

    try {
      setWorking({ text: i18n.t('Extracting frames') });
      console.log('Extracting frames as images', { captureFramesResponse });

      setProgress(0);

      let lastOutPath: string | undefined;

      const segmentProgresses: Record<number, number> = {};
      const handleSegmentProgress = (segIndex: number, segmentProgress: number) => {
        segmentProgresses[segIndex] = segmentProgress;
        const totalProgress = segments.reduce((acc, _ignored, index) => acc + (segmentProgresses[index] ?? 0), 0);
        setProgress(totalProgress / segments.length);
      };

      // eslint-disable-next-line no-restricted-syntax
      for (const [index, segment] of segments.entries()) {
        const { start, end } = segment;
        invariant(filePath != null);
        // eslint-disable-next-line no-await-in-loop
        lastOutPath = await captureFramesRange({ customOutDir, filePath, fps: detectedFps, fromTime: start, toTime: end, estimatedMaxNumFiles: captureFramesResponse.estimatedMaxNumFiles, captureFormat, quality: captureFrameQuality, filter: captureFramesResponse.filter, outputTimestamps: captureFrameFileNameFormat === 'timestamp', onProgress: (segmentProgress) => handleSegmentProgress(index, segmentProgress) });
      }
      if (!hideAllNotifications && lastOutPath != null) {
        showOsNotification(i18n.t('Frames have been extracted'));
        openDirToast({ icon: 'success', filePath: lastOutPath, text: i18n.t('Frames extracted to: {{path}}', { path: outputDir }) });
      }
    } catch (err) {
      showOsNotification(i18n.t('Failed to extract frames'));
      handleError(err);
    } finally {
      setWorking(undefined);
      setProgress(undefined);
    }
  }, [filePath, detectedFps, workingRef, getFrameCount, setWorking, hideAllNotifications, captureFramesRange, customOutDir, captureFormat, captureFrameQuality, captureFrameFileNameFormat, showOsNotification, outputDir]);

  const extractCurrentSegmentFramesAsImages = useCallback(() => {
    if (currentCutSeg != null) extractSegmentsFramesAsImages([currentCutSeg]);
  }, [currentCutSeg, extractSegmentsFramesAsImages]);

  const extractSelectedSegmentsFramesAsImages = useCallback(() => extractSegmentsFramesAsImages(selectedSegments), [extractSegmentsFramesAsImages, selectedSegments]);

  const userChangePlaybackRate = useCallback((dir: number, rateMultiplier?: number) => {
    if (compatPlayerEnabled) {
      toast.fire({ title: i18n.t('Unable to change playback rate right now'), timer: 1000 });
      return;
    }

    const video = videoRef.current;
    if (!playingRef.current) {
      video!.play();
    } else {
      const newRate = adjustRate(video!.playbackRate, dir, rateMultiplier);
      setPlaybackRate(newRate);
    }
  }, [compatPlayerEnabled, playingRef, setPlaybackRate, videoRef]);

  const loadEdlFile = useCallback(async ({ path, type, append = false }: { path: string, type: EdlFileType, append?: boolean }) => {
    console.log('Loading EDL file', type, path, append);
    loadCutSegments(await readEdlFile({ type, path, fps: detectedFps }), append);
  }, [detectedFps, loadCutSegments]);

  const loadSubtitleTrackToSegments = useCallback(async (streamId: number) => {
    invariant(filePath != null);
    setWorking(true);
    try {
      setStreamsSelectorShown(false);
      loadCutSegments(await extractSubtitleTrackToSegments(filePath, streamId), true);
    } finally {
      setWorking(undefined);
    }
  }, [filePath, loadCutSegments, setWorking]);

  const loadMedia = useCallback(async ({ filePath: fp, projectPath }: { filePath: string, projectPath?: string | undefined }) => {
    async function tryOpenProjectPath(path: string) {
      if (!(await exists(path))) return false;
      await loadEdlFile({ path, type: 'llc' });
      return true;
    }

    const storeProjectInSourceDir = !storeProjectInWorkingDir;

    async function tryFindAndLoadProjectFile({ chapters, cod }: { chapters: FFprobeChapter[], cod: string | undefined }) {
      try {
        // First try to open from from working dir
        if (await tryOpenProjectPath(getEdlFilePath(fp, cod))) return;

        // then try to open project from source file dir
        const sameDirEdlFilePath = getEdlFilePath(fp);
        // MAS only allows fs.access (fs-extra.exists) if we don't have access to input dir yet, so check first if the file exists,
        // so we don't need to annoy the user by asking for permission if the project file doesn't exist
        if (await exists(sameDirEdlFilePath)) {
          // Ok, the file exists. now we have to ask the user, because we need to read that file
          await ensureAccessToSourceDir(fp);
          // Ok, we got access from the user (or already have access), now read the project file
          await loadEdlFile({ path: sameDirEdlFilePath, type: 'llc' });
        }

        // OK, we didn't find a project file, instead maybe try to create project (segments) from chapters
        const edl = tryMapChaptersToEdl(chapters);
        if (edl.length > 0 && enableAskForImportChapters && (await askForImportChapters())) {
          console.log('Convert chapters to segments', edl);
          loadCutSegments(edl, false);
        }
      } catch (err) {
        if (err instanceof DirectoryAccessDeclinedError) throw err;
        console.error('EDL load failed, but continuing', err);
        errorToast(`${i18n.t('Failed to load segments')} (${err instanceof Error && err.message})`);
      }
    }

    setWorking({ text: i18n.t('Loading file') });
    try {
      // Need to check if file is actually readable
      const pathReadAccessErrorCode = await getPathReadAccessError(fp);
      if (pathReadAccessErrorCode != null) {
        let errorMessage: string | undefined;
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

      const fileFormatNew = await getDefaultOutFormat({ filePath: fp, fileMeta });
      if (!fileFormatNew) throw new Error('Unable to determine file format');

      const timecode = autoLoadTimecode ? getTimecodeFromStreams(fileMeta.streams) : undefined;

      const [videoStream] = getRealVideoStreams(fileMeta.streams);
      const [audioStream] = getAudioStreams(fileMeta.streams);

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

      console.log('loadMedia', { filePath: fp, customOutDir: cod, projectPath });

      // BEGIN STATE UPDATES:

      resetState();
      clearSegColorCounter();

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

      // eslint-disable-next-line unicorn/prefer-ternary
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
      setCopyStreamIdsForPath(fp, () => copyStreamIdsForPathNew);
      setDetectedFileFormat(fileFormatNew);
      if (outFormatLocked) {
        setFileFormat(outFormatLocked);
      } else {
        const recommendedDefaultFormat = mapRecommendedDefaultFormat({ sourceFormat: fileFormatNew, streams: fileMeta.streams });
        if (recommendedDefaultFormat.message) showNotification({ icon: 'info', text: recommendedDefaultFormat.message });
        setFileFormat(recommendedDefaultFormat.format);
      }

      // only show one toast, or else we will only show the last one
      if (existingHtml5FriendlyFile) {
        showPreviewFileLoadedMessage(basename(existingHtml5FriendlyFile.path));
      } else if (needsAutoHtml5ify) {
        showUnsupportedFileMessage();
      } else if (isAudioDefinitelyNotSupported(fileMeta.streams)) {
        showNotification({ icon: 'info', text: i18n.t('The audio track is not supported. You can convert to a supported format from the menu') });
      } else if (!validDuration) {
        toast.fire({ icon: 'warning', timer: 10000, text: i18n.t('This file does not have a valid duration. This may cause issues. You can try to fix the file\'s duration from the File menu') });
      }

      // This needs to be last, because it triggers <video> to load the video
      // If not, onVideoError might be triggered before setWorking() has been cleared.
      // https://github.com/mifi/lossless-cut/issues/515
      setFilePath(fp);
    } catch (err) {
      if (err instanceof DirectoryAccessDeclinedError) return;
      resetState();
      throw err;
    }
  }, [storeProjectInWorkingDir, setWorking, loadEdlFile, getEdlFilePath, enableAskForImportChapters, ensureAccessToSourceDir, loadCutSegments, autoLoadTimecode, enableNativeHevc, ensureWritableOutDir, customOutDir, resetState, clearSegColorCounter, setCopyStreamIdsForPath, setDetectedFileFormat, outFormatLocked, html5ifyAndLoadWithPreferences, setFileFormat, showNotification, showPreviewFileLoadedMessage, showUnsupportedFileMessage]);

  const toggleLastCommands = useCallback(() => setLastCommandsVisible((val) => !val), []);
  const toggleSettings = useCallback(() => setSettingsVisible((val) => !val), []);

  const seekClosestKeyframe = useCallback((direction: number) => {
    const time = findNearestKeyFrameTime({ time: getRelevantTime(), direction });
    if (time == null) return;
    seekAbs(time);
  }, [findNearestKeyFrameTime, getRelevantTime, seekAbs]);

  const onTimelineWheel = useTimelineScroll({ wheelSensitivity, mouseWheelZoomModifierKey, mouseWheelFrameSeekModifierKey, mouseWheelKeyframeSeekModifierKey, invertTimelineScroll, zoomRel, seekRel, shortStep, seekClosestKeyframe });

  const seekAccelerationRef = useRef(1);

  const userOpenSingleFile = useCallback(async ({ path: pathIn, isLlcProject }: { path: string, isLlcProject?: boolean }) => {
    let path = pathIn;
    let projectPath: string | undefined;

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
  const batchOpenSingleFile = useCallback(async (path: string) => {
    if (workingRef.current) return;
    if (filePath === path) return;
    setWorking({ text: i18n.t('Loading file') });
    try {
      await withErrorHandling(async () => {
        await userOpenSingleFile({ path });
      }, i18n.t('Failed to open file'));
    } finally {
      setWorking(undefined);
    }
  }, [workingRef, filePath, setWorking, userOpenSingleFile]);

  const batchFileJump = useCallback((direction: number, alsoOpen: boolean) => {
    if (batchFiles.length === 0) return;

    let newSelectedBatchFiles: [string];
    if (selectedBatchFiles.length === 0) {
      newSelectedBatchFiles = [batchFiles[0]!.path];
    } else {
      const selectedFilePath = selectedBatchFiles[direction > 0 ? selectedBatchFiles.length - 1 : 0];
      const pathIndex = batchFiles.findIndex(({ path }) => path === selectedFilePath);
      if (pathIndex === -1) return;
      const nextFile = batchFiles[pathIndex + direction];
      if (!nextFile) return;
      newSelectedBatchFiles = [nextFile.path];
    }

    setSelectedBatchFiles(newSelectedBatchFiles);
    if (alsoOpen) batchOpenSingleFile(newSelectedBatchFiles[0]);
  }, [batchFiles, batchOpenSingleFile, selectedBatchFiles]);

  const batchOpenSelectedFile = useCallback(() => {
    const [firstSelectedBatchFile] = selectedBatchFiles;
    if (firstSelectedBatchFile == null) return;
    batchOpenSingleFile(firstSelectedBatchFile);
  }, [batchOpenSingleFile, selectedBatchFiles]);

  const onBatchFileSelect = useCallback((path: string) => {
    if (selectedBatchFiles.includes(path)) batchOpenSingleFile(path);
    else setSelectedBatchFiles([path]);
  }, [batchOpenSingleFile, selectedBatchFiles]);

  const goToTimecode = useCallback(async () => {
    if (!filePath) return;
    const timecode = await promptTimecode({
      initialValue: formatTimecode({ seconds: commandedTimeRef.current }),
      title: i18n.t('Seek to timecode'),
      text: i18n.t('Use + and - for relative seek'),
      allowRelative: true,
      inputPlaceholder: timecodePlaceholder,
      parseTimecode,
    });

    if (timecode === undefined) return;

    if (timecode.relDirection != null) seekRel(timecode.duration * timecode.relDirection);
    else seekAbs(timecode.duration);
  }, [filePath, formatTimecode, commandedTimeRef, timecodePlaceholder, parseTimecode, seekRel, seekAbs]);

  const goToTimecodeDirect = useCallback(async ({ time: timeStr }: { time: string }) => {
    if (!filePath) return;
    invariant(timeStr != null);
    const timecode = parseTimecode(timeStr);
    invariant(timecode != null);
    seekAbs(timecode);
  }, [filePath, parseTimecode, seekAbs]);

  const toggleStreamsSelector = useCallback(() => setStreamsSelectorShown((v) => !v), []);

  const handleShowStreamsSelectorClick = useCallback(() => {
    setStreamsSelectorShown(true);
  }, []);

  const extractAllStreams = useCallback(async () => {
    if (!filePath) return;

    if (!(await confirmExtractAllStreamsDialog())) return;

    if (workingRef.current) return;
    try {
      setWorking({ text: i18n.t('Extracting all streams') });
      setStreamsSelectorShown(false);
      const [firstExtractedPath] = await extractStreams({ customOutDir, streams: mainCopiedStreams });
      if (!hideAllNotifications && firstExtractedPath != null) {
        showOsNotification(i18n.t('All tracks have been extracted'));
        openDirToast({ icon: 'success', filePath: firstExtractedPath, text: i18n.t('All streams have been extracted as separate files') });
      }
    } catch (err) {
      showOsNotification(i18n.t('Failed to extract tracks'));

      if (err instanceof RefuseOverwriteError) {
        showRefuseToOverwrite();
      } else {
        errorToast(i18n.t('Failed to extract all streams'));
        console.error('Failed to extract all streams', err);
      }
    } finally {
      setWorking(undefined);
    }
  }, [customOutDir, extractStreams, filePath, hideAllNotifications, mainCopiedStreams, setWorking, showOsNotification, workingRef]);

  const userHtml5ifyCurrentFile = useCallback(async ({ ignoreRememberedValue }: { ignoreRememberedValue?: boolean } = {}) => {
    if (!filePath) return;

    let selectedOption = rememberConvertToSupportedFormat;
    if (selectedOption == null || ignoreRememberedValue) {
      let allowedOptions: Html5ifyMode[] = [];
      if (hasAudio && hasVideo) allowedOptions = ['fastest', 'fast-audio-remux', 'fast-audio', 'fast', 'slow', 'slow-audio', 'slowest'];
      else if (hasAudio) allowedOptions = ['fast-audio-remux', 'slow-audio', 'slowest'];
      else if (hasVideo) allowedOptions = ['fastest', 'fast', 'slow', 'slowest'];

      const userResponse = await askForHtml5ifySpeed({ allowedOptions, showRemember: true, initialOption: selectedOption });
      console.log('Choice', userResponse);
      ({ selectedOption } = userResponse);
      if (!selectedOption) return;

      const { remember } = userResponse;

      setRememberConvertToSupportedFormat(remember ? selectedOption : undefined);
    }

    if (workingRef.current) return;
    try {
      setWorking({ text: i18n.t('Converting to supported format') });
      await withErrorHandling(async () => {
        await html5ifyAndLoad(customOutDir, filePath, selectedOption, hasVideo, hasAudio);
      }, i18n.t('Failed to convert file. Try a different conversion'));
    } finally {
      setWorking(undefined);
    }
  }, [filePath, rememberConvertToSupportedFormat, workingRef, hasAudio, hasVideo, setWorking, html5ifyAndLoad, customOutDir]);

  const askStartTimeOffset = useCallback(async () => {
    const newStartTimeOffset = await promptTimecode({
      initialValue: startTimeOffset !== undefined ? formatTimecode({ seconds: startTimeOffset }) : undefined,
      title: i18n.t('Set custom start time offset'),
      text: i18n.t('Instead of video apparently starting at 0, you can offset by a specified value. This only applies to the preview inside LosslessCut and does not modify the file in any way. (Useful for viewing/cutting videos according to timecodes)'),
      inputPlaceholder: timecodePlaceholder,
      parseTimecode,
    });

    if (newStartTimeOffset === undefined || newStartTimeOffset.duration < 0) return;

    setStartTimeOffset(newStartTimeOffset.duration);
  }, [formatTimecode, parseTimecode, startTimeOffset, timecodePlaceholder]);

  const toggleKeyboardShortcuts = useCallback(() => setKeyboardShortcutsVisible((v) => !v), []);

  const tryFixInvalidDuration = useCallback(async () => {
    if (!checkFileOpened() || workingRef.current) return;
    try {
      setWorking({ text: i18n.t('Fixing file duration') });
      setProgress(0);
      await withErrorHandling(async () => {
        invariant(fileFormat != null);
        const path = await fixInvalidDuration({ fileFormat, customOutDir, onProgress: setProgress });
        showNotification({ icon: 'info', text: i18n.t('Duration has been fixed') });

        await loadMedia({ filePath: path });
      }, i18n.t('Failed to fix file duration'));
    } finally {
      setWorking(undefined);
      setProgress(undefined);
    }
  }, [checkFileOpened, customOutDir, fileFormat, fixInvalidDuration, loadMedia, setWorking, showNotification, workingRef]);

  const addStreamSourceFile = useCallback(async (path: string) => {
    if (allFilesMeta[path]) return undefined; // Already added?
    const fileMeta = await readFileMeta(path);
    // console.log('streams', fileMeta.streams);
    setExternalFilesMeta((old) => ({ ...old, [path]: { streams: fileMeta.streams, formatData: fileMeta.format, chapters: fileMeta.chapters } }));
    setCopyStreamIdsForPath(path, () => fromPairs(fileMeta.streams.map(({ index }) => [index, true])));
    return fileMeta;
  }, [allFilesMeta, setCopyStreamIdsForPath]);

  const updateStreamParams = useCallback<Parameters<typeof StreamsSelector>[0]['updateStreamParams']>((fileId, streamId, setter) => setParamsByStreamId(produce((draft) => {
    if (!draft.has(fileId)) draft.set(fileId, new Map());
    const fileMap = draft.get(fileId);
    invariant(fileMap != null);
    if (!fileMap.has(streamId)) fileMap.set(streamId, {});

    const params = fileMap.get(streamId);
    invariant(params != null);
    setter(params);
  })), [setParamsByStreamId]);

  const addFileAsCoverArt = useCallback(async (path: string) => {
    const fileMeta = await addStreamSourceFile(path);
    if (!fileMeta) return false;
    const firstIndex = fileMeta.streams[0]!.index;
    // eslint-disable-next-line no-param-reassign
    updateStreamParams(path, firstIndex, (params) => { params.disposition = 'attached_pic'; });
    return true;
  }, [addStreamSourceFile, updateStreamParams]);

  const captureSnapshotAsCoverArt = useCallback(async () => {
    if (!filePath) return;
    await withErrorHandling(async () => {
      const currentTime = getRelevantTime();
      const path = await captureFrameFromFfmpeg({ customOutDir, filePath, time: currentTime, captureFormat, quality: captureFrameQuality });
      if (!(await addFileAsCoverArt(path))) return;
      showNotification({ text: i18n.t('Current frame has been set as cover art') });
    }, i18n.t('Failed to capture frame'));
  }, [addFileAsCoverArt, captureFormat, captureFrameFromFfmpeg, captureFrameQuality, customOutDir, filePath, getRelevantTime, showNotification]);

  const batchLoadPaths = useCallback((newPaths: string[], append?: boolean) => {
    setBatchFiles((existingFiles) => {
      const mapPathsToFiles = (paths: string[]) => paths.map((path) => ({ path, name: basename(path) }));
      if (append) {
        const newUniquePaths = newPaths.filter((newPath) => !existingFiles.some(({ path: existingPath }) => newPath === existingPath));
        const [firstNewUniquePath] = newUniquePaths;
        if (firstNewUniquePath == null) return existingFiles;
        setSelectedBatchFiles([firstNewUniquePath]);
        return [...existingFiles, ...mapPathsToFiles(newUniquePaths)];
      }
      const [firstNewPath] = newPaths;
      if (firstNewPath == null) throw new Error();
      setSelectedBatchFiles([firstNewPath]);
      return mapPathsToFiles(newPaths);
    });
  }, []);

  const userOpenFiles = useCallback(async (filePathsIn?: string[]) => {
    await withErrorHandling(async () => {
      let filePaths = filePathsIn;
      if (!filePaths || filePaths.length === 0) return;

      console.log('userOpenFiles');
      console.log(filePaths.join('\n'));

      lastOpenedPathRef.current = filePaths[0]!;

      // first check if it is a single directory, and if so, read it recursively
      if (filePaths.length === 1) {
        const firstFilePath = filePaths[0]!;
        const firstFileStat = await lstat(firstFilePath);
        if (firstFileStat.isDirectory()) {
          console.log('Reading directory...');
          invariant(firstFilePath != null);
          filePaths = await readDirRecursively(firstFilePath);
        }
      }

      // Only allow opening regular files
      // eslint-disable-next-line no-restricted-syntax
      for (const path of filePaths) {
        // eslint-disable-next-line no-await-in-loop
        const fileStat = await lstat(path);

        if (!fileStat.isFile()) {
          errorToast(i18n.t('Cannot open anything else than regular files'));
          console.warn('Not a file:', path);
          return;
        }
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
      const [firstFilePath] = filePaths;
      invariant(firstFilePath != null);

      // https://en.wikibooks.org/wiki/Inside_DVD-Video/Directory_Structure
      if (/^video_ts$/i.test(basename(firstFilePath))) {
        if (mustDisallowVob()) return;
        filePaths = await readVideoTs(firstFilePath);
      }

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
        const inputOptions: { open: string, project?: string, tracks?: string, subtitles?: string, addToBatch?: string, mergeWithCurrentFile?: string } = {
          open: isFileOpened ? i18n.t('Open the file instead of the current one') : i18n.t('Open the file'),
        };

        if (isFileOpened) {
          if (isLlcProject) inputOptions.project = i18n.t('Load segments from the new file, but keep the current media');
          if (filePathLowerCase.endsWith('.srt')) inputOptions.subtitles = i18n.t('Convert subtitiles into segments');
          inputOptions.tracks = i18n.t('Include all tracks from the new file');
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
            const batchPaths = new Set<string>();
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
      } finally {
        setWorking(undefined);
      }
    }, i18n.t('Failed to open file'));
  }, [workingRef, alwaysConcatMultipleFiles, batchLoadPaths, setWorking, isFileOpened, batchFiles.length, userOpenSingleFile, checkFileOpened, loadEdlFile, enableAskForFileOpenAction, addStreamSourceFile, filePath]);

  const openFilesDialog = useCallback(async () => {
    // On Windows and Linux an open dialog can not be both a file selector and a directory selector, so if you set `properties` to `['openFile', 'openDirectory']` on these platforms, a directory selector will be shown. #1995
    const { canceled, filePaths } = await showOpenDialog({ properties: ['openFile', 'multiSelections'], defaultPath: lastOpenedPathRef.current!, title: t('Open file') });
    if (canceled) return;
    userOpenFiles(filePaths);
  }, [t, userOpenFiles]);

  const openDirDialog = useCallback(async () => {
    const { canceled, filePaths } = await showOpenDialog({ properties: ['openDirectory', 'multiSelections'], defaultPath: lastOpenedPathRef.current!, title: t('Open folder') });
    if (canceled) return;
    userOpenFiles(filePaths);
  }, [t, userOpenFiles]);

  const concatBatch = useCallback(() => {
    if (batchFiles.length < 2) {
      openFilesDialog();
      return;
    }

    setConcatDialogVisible(true);
  }, [batchFiles.length, openFilesDialog]);

  const toggleLoopSelectedSegments = useCallback(() => togglePlay({ resetPlaybackRate: true, requestPlaybackMode: 'loop-selected-segments' }), [togglePlay]);

  const copySegmentsToClipboard = useCallback(async () => {
    if (!isFileOpened || selectedSegments.length === 0) return;
    electron.clipboard.writeText(await formatTsv(selectedSegments));
  }, [isFileOpened, selectedSegments]);

  const showIncludeExternalStreamsDialog = useCallback(async () => {
    await withErrorHandling(async () => {
      const { canceled, filePaths } = await showOpenDialog({ properties: ['openFile'], title: t('Include more tracks from other file') });
      const [firstFilePath] = filePaths;
      if (canceled || firstFilePath == null) return;
      await addStreamSourceFile(firstFilePath);
    }, i18n.t('Failed to include track'));
  }, [addStreamSourceFile, t]);

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
      if (videoContainerRef.current == null) throw new Error('videoContainerRef.current == null');
      await screenfull.toggle(videoContainerRef.current, { navigationUI: 'hide' });
    } catch (err) {
      console.error('Failed to toggle fullscreen', err);
    }
  }, [videoContainerRef, videoRef]);

  const onEditSegmentTags = useCallback((index: number) => {
    setEditingSegmentTagsSegmentIndex(index);
    const seg = cutSegments[index];
    invariant(seg != null);
    setEditingSegmentTags(getSegmentTags(seg));
  }, [cutSegments]);

  const editCurrentSegmentTags = useCallback(() => {
    onEditSegmentTags(currentSegIndexSafe);
  }, [currentSegIndexSafe, onEditSegmentTags]);

  const promptDownloadMediaUrlWrapper = useCallback(async () => {
    try {
      setWorking({ text: t('Downloading URL') });
      await withErrorHandling(async () => {
        const newCustomOutDir = await ensureWritableOutDir({ outDir: customOutDir });
        if (newCustomOutDir == null) {
          errorToast(i18n.t('Please select a working directory first'));
          return;
        }
        const outPath = getDownloadMediaOutPath(newCustomOutDir, `downloaded-media-${Date.now()}.mkv`);
        const downloaded = await promptDownloadMediaUrl(outPath);
        if (downloaded) await loadMedia({ filePath: outPath });
      }, i18n.t('Failed to download URL'));
    } finally {
      setWorking();
    }
  }, [customOutDir, ensureWritableOutDir, loadMedia, setWorking, t]);

  type MainKeyboardAction = Exclude<KeyboardAction, 'closeActiveScreen' | 'toggleKeyboardShortcuts' | 'goToTimecodeDirect'>;

  const mainActions = useMemo(() => {
    async function exportYouTube() {
      if (!checkFileOpened()) return;
      await openYouTubeChaptersDialog(formatYouTube(cutSegments));
    }

    function seekReset() {
      seekAccelerationRef.current = 1;
    }

    function seekRel2({ keyup, amount }: { keyup: boolean | undefined, amount: number }) {
      if (keyup) {
        seekReset();
        return;
      }
      seekRel(seekAccelerationRef.current * amount);
      seekAccelerationRef.current *= keyboardSeekAccFactor;
    }

    const ret: Record<MainKeyboardAction, ((a: { keyup?: boolean | undefined }) => boolean) | ((a: { keyup?: boolean | undefined }) => void)> = {
      // NOTE: Do not change these keys because users have bound keys by these names in their config files
      // For actions, see also KeyboardShortcuts.jsx
      togglePlayNoResetSpeed: () => togglePlay(),
      togglePlayResetSpeed: () => togglePlay({ resetPlaybackRate: true }),
      togglePlayOnlyCurrentSegment: () => togglePlay({ resetPlaybackRate: true, requestPlaybackMode: 'play-segment-once' }),
      toggleLoopOnlyCurrentSegment: () => togglePlay({ resetPlaybackRate: true, requestPlaybackMode: 'loop-segment' }),
      toggleLoopStartEndOnlyCurrentSegment: () => togglePlay({ resetPlaybackRate: true, requestPlaybackMode: 'loop-segment-start-end' }),
      toggleLoopSelectedSegments,
      play: () => play(),
      pause,
      reducePlaybackRate: () => userChangePlaybackRate(-1),
      reducePlaybackRateMore: () => userChangePlaybackRate(-1, 2),
      increasePlaybackRate: () => userChangePlaybackRate(1),
      increasePlaybackRateMore: () => userChangePlaybackRate(1, 2),
      timelineToggleComfortZoom,
      captureSnapshot,
      captureSnapshotAsCoverArt,
      setCutStart,
      setCutEnd,
      cleanupFilesDialog,
      splitCurrentSegment,
      focusSegmentAtCursor,
      selectSegmentsAtCursor,
      increaseRotation,
      goToTimecode,
      seekBackwards: ({ keyup }) => seekRel2({ keyup, amount: -1 * keyboardNormalSeekSpeed }),
      seekBackwards2: ({ keyup }) => seekRel2({ keyup, amount: -1 * keyboardSeekSpeed2 }),
      seekBackwards3: ({ keyup }) => seekRel2({ keyup, amount: -1 * keyboardSeekSpeed3 }),
      seekForwards: ({ keyup }) => seekRel2({ keyup, amount: keyboardNormalSeekSpeed }),
      seekForwards2: ({ keyup }) => seekRel2({ keyup, amount: keyboardSeekSpeed2 }),
      seekForwards3: ({ keyup }) => seekRel2({ keyup, amount: keyboardSeekSpeed3 }),
      seekBackwardsPercent: () => { seekRelPercent(-0.01); return false; },
      seekForwardsPercent: () => { seekRelPercent(0.01); return false; },
      seekBackwardsKeyframe: () => seekClosestKeyframe(-1),
      seekForwardsKeyframe: () => seekClosestKeyframe(1),
      seekPreviousFrame: () => shortStep(-1),
      seekNextFrame: () => shortStep(1),
      jumpPrevSegment: () => jumpSeg({ rel: -1 }),
      jumpSeekPrevSegment: () => jumpSeg({ rel: -1, seek: true }),
      jumpNextSegment: () => jumpSeg({ rel: 1 }),
      jumpSeekNextSegment: () => jumpSeg({ rel: 1, seek: true }),
      jumpFirstSegment: () => jumpSeg({ abs: 0 }),
      jumpSeekFirstSegment: () => jumpSeg({ abs: 0, seek: true }),
      jumpLastSegment: () => jumpSeg({ abs: cutSegments.length - 1 }),
      jumpSeekLastSegment: () => jumpSeg({ abs: cutSegments.length - 1, seek: true }),
      jumpCutStart,
      jumpCutEnd,
      jumpTimelineStart,
      jumpTimelineEnd,
      timelineZoomIn: () => { zoomRel(1); return false; },
      timelineZoomOut: () => { zoomRel(-1); return false; },
      batchPreviousFile: () => batchFileJump(-1, false),
      batchNextFile: () => batchFileJump(1, false),
      batchOpenPreviousFile: () => batchFileJump(-1, true),
      batchOpenNextFile: () => batchFileJump(1, true),
      batchOpenSelectedFile,
      closeBatch,
      removeCurrentSegment: () => removeSegment(currentSegIndexSafe, true),
      removeCurrentCutpoint: () => removeSegment(currentSegIndexSafe),
      undo: () => cutSegmentsHistory.back(),
      redo: () => cutSegmentsHistory.forward(),
      labelCurrentSegment: () => { labelSegment(currentSegIndexSafe); return false; },
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
      createFixedByteSizedSegments,
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
      toggleStripVideo,
      toggleStripSubtitle,
      toggleStripThumbnail,
      toggleStripCurrentFilter: () => applyEnabledStreamsFilter(),
      toggleStripAll,
      toggleDarkMode,
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
      toggleMuted,
      copySegmentsToClipboard,
      reloadFile: () => setCacheBuster((v) => v + 1),
      quit: () => quitApp(),
      closeCurrentFile: () => { closeFileWithConfirm(); },
      exportYouTube,
      showStreamsSelector: handleShowStreamsSelectorClick,
      html5ify: () => userHtml5ifyCurrentFile({ ignoreRememberedValue: true }),
      openFilesDialog,
      openDirDialog,
      toggleSettings,
      openSendReportDialog: () => { openSendReportDialogWithState(); },
      detectBlackScenes: ({ keyup }) => {
        if (keyup) detectBlackScenes();
      },
      detectSilentScenes: ({ keyup }) => {
        if (keyup) detectSilentScenes();
      },
      detectSceneChanges: ({ keyup }) => {
        if (keyup) detectSceneChanges();
      },
      createSegmentsFromKeyframes,
      toggleWaveformMode,
      toggleShowThumbnails,
      toggleShowKeyframes,
      showIncludeExternalStreamsDialog,
      toggleFullscreenVideo,
      selectAllMarkers,
    };

    return ret;
  }, [toggleLoopSelectedSegments, pause, timelineToggleComfortZoom, captureSnapshot, captureSnapshotAsCoverArt, setCutStart, setCutEnd, cleanupFilesDialog, splitCurrentSegment, focusSegmentAtCursor, selectSegmentsAtCursor, increaseRotation, goToTimecode, jumpCutStart, jumpCutEnd, jumpTimelineStart, jumpTimelineEnd, batchOpenSelectedFile, closeBatch, addSegment, duplicateCurrentSegment, onExportPress, extractCurrentSegmentFramesAsImages, extractSelectedSegmentsFramesAsImages, reorderSegsByStartTime, invertAllSegments, fillSegmentsGaps, combineOverlappingSegments, combineSelectedSegments, createFixedDurationSegments, createNumSegments, createFixedByteSizedSegments, createRandomSegments, alignSegmentTimesToKeyframes, shuffleSegments, clearSegments, toggleSegmentsList, toggleStreamsSelector, extractAllStreams, convertFormatBatch, concatBatch, toggleCaptureFormat, toggleStripAudio, toggleStripVideo, toggleStripSubtitle, toggleStripThumbnail, toggleStripAll, toggleDarkMode, askStartTimeOffset, deselectAllSegments, selectAllSegments, selectOnlyCurrentSegment, editCurrentSegmentTags, toggleCurrentSegmentSelected, invertSelectedSegments, removeSelectedSegments, tryFixInvalidDuration, shiftAllSegmentTimes, toggleMuted, copySegmentsToClipboard, handleShowStreamsSelectorClick, openFilesDialog, openDirDialog, toggleSettings, createSegmentsFromKeyframes, toggleWaveformMode, toggleShowThumbnails, toggleShowKeyframes, showIncludeExternalStreamsDialog, toggleFullscreenVideo, selectAllMarkers, checkFileOpened, cutSegments, seekRel, keyboardSeekAccFactor, togglePlay, play, userChangePlaybackRate, keyboardNormalSeekSpeed, keyboardSeekSpeed2, keyboardSeekSpeed3, seekRelPercent, seekClosestKeyframe, shortStep, jumpSeg, zoomRel, batchFileJump, removeSegment, currentSegIndexSafe, cutSegmentsHistory, labelSegment, toggleLastCommands, userHtml5ifyCurrentFile, toggleKeyframeCut, applyEnabledStreamsFilter, setPlaybackVolume, closeFileWithConfirm, openSendReportDialogWithState, detectBlackScenes, detectSilentScenes, detectSceneChanges]);

  const getKeyboardAction = useCallback((action: MainKeyboardAction) => mainActions[action], [mainActions]);

  const onKeyPress = useCallback(({ action, keyup }: { action: KeyboardAction, keyup?: boolean | undefined }) => {
    function tryMainActions(mainAction: MainKeyboardAction) {
      const fn = getKeyboardAction(mainAction);
      if (!fn) return { match: false };
      const bubble = fn({ keyup });
      if (bubble === undefined) return { match: true };
      return { match: true, bubble };
    }

    if (isDev) console.log('key event', action);

    // always allow
    if (action === 'closeActiveScreen') {
      closeExportConfirm();
      setLastCommandsVisible(false);
      setSettingsVisible(false);
      setStreamsSelectorShown(false);
      setConcatDialogVisible(false);
      setKeyboardShortcutsVisible(false);
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
    const { match, bubble } = tryMainActions(action);
    if (match) return bubble;

    return true; // bubble the event
  }, [closeExportConfirm, concatDialogVisible, exportConfirmVisible, getKeyboardAction, keyboardShortcutsVisible, onExportConfirm, toggleKeyboardShortcuts]);

  useKeyboard({ keyBindings, onKeyPress });

  useEffect(() => {
    // eslint-disable-next-line unicorn/prefer-add-event-listener
    document.ondragover = dragPreventer;
    // eslint-disable-next-line unicorn/prefer-add-event-listener
    document.ondragend = dragPreventer;

    electron.ipcRenderer.send('renderer-ready');
  }, []);

  useEffect(() => {
    electron.ipcRenderer.send('setAskBeforeClose', askBeforeClose && isFileOpened);
  }, [askBeforeClose, isFileOpened]);

  const extractSingleStream = useCallback(async (index: number) => {
    if (!filePath) return;

    if (workingRef.current) return;
    try {
      setWorking({ text: i18n.t('Extracting track') });
      // setStreamsSelectorShown(false);
      const [firstExtractedPath] = await extractStreams({ customOutDir, streams: mainStreams.filter((s) => s.index === index) });
      if (!hideAllNotifications && firstExtractedPath != null) {
        showOsNotification(i18n.t('Track has been extracted'));
        openDirToast({ icon: 'success', filePath: firstExtractedPath, text: i18n.t('Track has been extracted') });
      }
    } catch (err) {
      showOsNotification(i18n.t('Failed to extract track'));

      if (err instanceof RefuseOverwriteError) {
        showRefuseToOverwrite();
      } else {
        errorToast(i18n.t('Failed to extract track'));
        console.error('Failed to extract track', err);
      }
    } finally {
      setWorking(undefined);
    }
  }, [customOutDir, extractStreams, filePath, hideAllNotifications, mainStreams, setWorking, showOsNotification, workingRef]);

  const batchFilePaths = useMemo(() => batchFiles.map((f) => f.path), [batchFiles]);

  const onVideoError = useCallback(async () => {
    const error = videoRef.current?.error;
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

        if (hasVideo || hasAudio) {
          await html5ifyAndLoadWithPreferences(customOutDir, filePath, 'fastest', hasVideo, hasAudio);
          showUnsupportedFileMessage();
        }
      } catch (err) {
        console.error(err);
        showPlaybackFailedMessage();
      } finally {
        setWorking(undefined);
      }
    } catch (err) {
      handleError(err);
    }
  }, [videoRef, fileUri, usingPreviewFile, filePath, workingRef, setWorking, hasVideo, hasAudio, html5ifyAndLoadWithPreferences, customOutDir, showUnsupportedFileMessage]);

  const onVideoFocus = useCallback<FocusEventHandler<HTMLVideoElement>>((e) => {
    // prevent video element from stealing focus in fullscreen mode https://github.com/mifi/lossless-cut/issues/543#issuecomment-1868167775
    e.target.blur();
  }, []);

  const onVideoClick = useCallback(() => togglePlay(), [togglePlay]);

  const tryExportEdlFile = useCallback(async (type: EdlExportType) => {
    if (!checkFileOpened() || selectedSegments.length === 0) return;
    await withErrorHandling(async () => {
      await exportEdlFile({ type, cutSegments: selectedSegments, customOutDir, filePath, getFrameCount });
    }, i18n.t('Failed to export project'));
  }, [checkFileOpened, customOutDir, filePath, getFrameCount, selectedSegments]);

  const importEdlFile = useCallback(async (type: EdlImportType) => {
    if (!checkFileOpened()) return;

    await withErrorHandling(async () => {
      const edl = await askForEdlImport({ type, fps: detectedFps });
      if (edl.length > 0) loadCutSegments(edl, true);
    }, i18n.t('Failed to import project file'));
  }, [checkFileOpened, detectedFps, loadCutSegments]);

  useEffect(() => {
    const openFiles = (filePaths: string[]) => { userOpenFiles(filePaths.map((p) => resolvePathIfNeeded(p))); };

    async function actionWithCatch(fn: () => Promise<void>) {
      try {
        await fn();
      } catch (err) {
        handleError(err);
      }
    }

    const allActions = [
      // actions with arguments:
      [
        'openFiles',
        async (...argsRaw: unknown[]) => {
          await openFiles(...openFilesActionArgsSchema.parse(argsRaw));
        },
      ] as const,
      [
        'goToTimecodeDirect',
        async (...argsRaw: unknown[]) => {
          await goToTimecodeDirect(...goToTimecodeDirectArgsSchema.parse(argsRaw));
        },
      ] as const,
      ...Object.entries({
        // todo separate actions per type and move them into mainActions? https://github.com/mifi/lossless-cut/issues/254#issuecomment-932649424
        importEdlFile,
        exportEdlFile: tryExportEdlFile,
        promptDownloadMediaUrl: promptDownloadMediaUrlWrapper,
      }).map(([key, fn]) => [
        key,
        async (...args: unknown[]) => {
          await (fn as (...args2: unknown[]) => Promise<void>)(...args);
        },
      ] as const),
      // all main actions (no arguments, so simulate keyup):
      ...Object.entries(mainActions).map(([key, fn]) => [
        key,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        async () => {
          fn({ keyup: true });
        },
      ] as const),
      // also called from menu:
      [
        'toggleKeyboardShortcuts',
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        async () => {
          toggleKeyboardShortcuts();
        },
      ] as const,
    ];

    const allActionsMap = Object.fromEntries(allActions);

    const actionsWithCatch = allActions.map(([key, fn]) => [
      key,
      (...args: Parameters<typeof fn>) => actionWithCatch(() => fn(...args)),
    ] as const);

    async function tryApiAction(event: IpcRendererEvent, { id, action, args }: ApiActionRequest) {
      console.log('API action:', action, args);
      try {
        const fn = allActionsMap[action];
        if (!fn) throw new Error(`Action not found: ${action}`);
        // todo validate arguments
        await (args != null ? fn(...args) : fn());
      } catch (err) {
        handleError(err);
      } finally {
        // todo correlation ids
        event.sender.send('apiActionResponse', { id });
      }
    }

    const ipcActions = actionsWithCatch.map(([key, fn]) => [
      key,
      (_event: IpcRendererEvent, ...args: Parameters<typeof fn>) => actionWithCatch(() => fn(...args)),
    ] as const);

    ipcActions.forEach(([key, action]) => electron.ipcRenderer.on(key, action));
    electron.ipcRenderer.on('apiAction', tryApiAction);

    return () => {
      ipcActions.forEach(([key, action]) => electron.ipcRenderer.off(key, action));
      electron.ipcRenderer.off('apiAction', tryApiAction);
    };
  }, [checkFileOpened, customOutDir, detectedFps, filePath, getFrameCount, getKeyboardAction, goToTimecodeDirect, importEdlFile, loadCutSegments, mainActions, promptDownloadMediaUrlWrapper, selectedSegments, toggleKeyboardShortcuts, tryExportEdlFile, userOpenFiles]);

  useEffect(() => {
    async function onDrop(ev: DragEvent) {
      ev.preventDefault();
      if (!ev.dataTransfer) return;
      const { files } = ev.dataTransfer;
      const filePaths = [...files].map((f) => electron.webUtils.getPathForFile(f));

      focusWindow();

      userOpenFiles(filePaths);
    }
    const element = videoContainerRef.current;
    element?.addEventListener('drop', onDrop);
    return () => element?.removeEventListener('drop', onDrop);
  }, [userOpenFiles, videoContainerRef]);

  useEffect(() => {
    function onDrop(ev: DragEvent) {
      // default drop handler to prevent new electron window from popping up https://github.com/electron/electron/issues/39839
      ev.preventDefault();
    }
    document.body.addEventListener('drop', onDrop);
    return () => document.body.removeEventListener('drop', onDrop);
  }, []);

  const renderOutFmt = useCallback((style: CSSProperties) => (
    <OutputFormatSelect style={style} detectedFileFormat={detectedFileFormat} fileFormat={fileFormat} onOutputFormatUserChange={onOutputFormatUserChange} />
  ), [detectedFileFormat, fileFormat, onOutputFormatUserChange]);

  const onTunerRequested = useCallback((type: TunerType) => {
    setSettingsVisible(false);
    setTunerVisible(type);
    if (type === 'waveformHeight') {
      setWaveformMode('waveform');
    }
  }, []);

  useEffect(() => {
    if (!isStoreBuild && !hasDisabledNetworking()) loadMifiLink().then(setMifiLink);
  }, []);

  useEffect(() => {
    runStartupCheck({ customFfPath });
  }, [customFfPath]);

  const haveBoundAlt = useMemo(() => keyBindings.some(({ keys }) => keys.split('+').includes('alt')), [keyBindings]);

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      // Keyboard scroll prevention:
      // https://stackoverflow.com/questions/8916620/disable-arrow-key-scrolling-in-users-browser
      if (e.target === document.body && [32, 37, 38, 39, 40].includes(e.keyCode)) {
        e.preventDefault();
      }

      // if the user has bound alt in any of their keybindings, prevent alt from triggering the menu https://github.com/mifi/lossless-cut/issues/2180
      if (haveBoundAlt && e.code === 'AltLeft') {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [haveBoundAlt]);

  const showLeftBar = batchFiles.length > 0;

  function renderSubtitles() {
    if (!activeSubtitle) return null;
    return <track default kind="subtitles" label={activeSubtitle.lang} srcLang="en" src={activeSubtitle.url} />;
  }

  // throw new Error('Test error boundary');

  const baseColorStyle = useMemo(() => ({ color: 'var(--gray-12)', background: 'var(--gray-1)', colorScheme: darkMode ? 'only dark' : 'only light' }), [darkMode]);

  return (
    <>
      <SegColorsContext.Provider value={segColorsContext}>
        <UserSettingsContext.Provider value={userSettingsContext}>
          <ThemeProvider value={theme}>
            <div className={darkMode ? 'dark-theme' : undefined} style={{ ...baseColorStyle, display: 'flex', flexDirection: 'column', height: '100vh', transition: darkModeTransition }}>
              <TopMenu
                filePath={filePath}
                fileFormat={fileFormat}
                changeEnabledStreamsFilter={changeEnabledStreamsFilter}
                applyEnabledStreamsFilter={applyEnabledStreamsFilter}
                enabledStreamsFilter={enabledStreamsFilter}
                clearOutDir={clearOutDir}
                isCustomFormatSelected={isCustomFormatSelected}
                renderOutFmt={renderOutFmt}
                toggleSettings={toggleSettings}
                numStreamsToCopy={numStreamsToCopy}
                numStreamsTotal={numStreamsTotal}
                setStreamsSelectorShown={setStreamsSelectorShown}
                selectedSegments={segmentsOrInverse.selected}
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

                {/* Middle part (also shown in fullscreen): */}
                <div style={{ position: 'relative', flexGrow: 1, overflow: 'hidden' }} ref={videoContainerRef}>
                  {!isFileOpened && <NoFileLoaded mifiLink={mifiLink} currentCutSeg={currentCutSeg} onClick={openFilesDialog} darkMode={darkMode} keyBindingByAction={keyBindingByAction} />}

                  <div className="no-user-select" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, visibility: !isFileOpened || !hasVideo || bigWaveformEnabled ? 'hidden' : undefined }} onWheel={onTimelineWheel}>
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <video
                      className={styles['video']}
                      tabIndex={-1}
                      muted={playbackVolume === 0 || compatPlayerEnabled}
                      ref={videoRef}
                      style={videoStyle}
                      src={fileUri}
                      onPlay={onStartPlaying}
                      onPause={onStopPlaying}
                      onAbort={onVideoAbort}
                      onDurationChange={onDurationChange}
                      onTimeUpdate={onTimeUpdate}
                      onError={onVideoError}
                      onClick={onVideoClick}
                      onDoubleClick={toggleFullscreenVideo}
                      onFocusCapture={onVideoFocus}
                      onSeeked={onSeeked}
                    >
                      {renderSubtitles()}
                    </video>

                    {filePath != null && compatPlayerEnabled && <MediaSourcePlayer rotate={effectiveRotation} filePath={filePath} videoStream={activeVideoStream} audioStreams={activeAudioStreams} playerTime={playerTime ?? 0} commandedTime={commandedTime} playing={playing} eventId={compatPlayerEventId} masterVideoRef={videoRef} mediaSourceQuality={mediaSourceQuality} playbackVolume={playbackVolume} />}
                  </div>

                  {bigWaveformEnabled && <BigWaveform waveforms={waveforms} relevantTime={relevantTime} playing={playing} fileDurationNonZero={fileDurationNonZero} zoom={zoomUnrounded} seekRel={seekRel} darkMode={darkMode} />}

                  {compatPlayerEnabled && (
                    <div style={{ position: 'absolute', top: 0, right: 0, left: 0, marginTop: '1em', marginLeft: '1em', color: 'white', opacity: 0.7, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                      {isRotationSet ? (
                        <>
                          <MdRotate90DegreesCcw size={26} style={{ marginRight: 5 }} />
                          {t('Rotation preview')}
                        </>
                      ) : (
                        <>
                          {t('FFmpeg-assisted playback')}
                        </>
                      )}

                      <div style={{ cursor: 'pointer', pointerEvents: 'initial', color: 'white', opacity: 0.7, padding: '.2em', marginLeft: '.5em' }} role="button" onClick={() => incrementMediaSourceQuality()} title={t('Select playback quality')}>{mediaSourceQualities[mediaSourceQuality]}</div>

                      {!compatPlayerRequired && <FaRegTimesCircle role="button" style={{ cursor: 'pointer', pointerEvents: 'initial', verticalAlign: 'middle', padding: '.2em' }} onClick={() => setHideMediaSourcePlayer(true)} />}
                    </div>
                  )}

                  {isFileOpened && (
                    <div className="no-user-select" style={{ position: 'absolute', right: 0, bottom: 0, marginBottom: 10, display: 'flex', alignItems: 'flex-end' }}>
                      <VolumeControl playbackVolume={playbackVolume} setPlaybackVolume={setPlaybackVolume} onToggleMutedClick={toggleMuted} />

                      {shouldShowPlaybackStreamSelector && (
                        <PlaybackStreamSelector subtitleStreams={subtitleStreams} videoStreams={videoStreams} audioStreams={audioStreams} activeSubtitleStreamIndex={activeSubtitleStreamIndex} activeVideoStreamIndex={activeVideoStreamIndex} activeAudioStreamIndexes={activeAudioStreamIndexes} onActiveSubtitleChange={onActiveSubtitleChange} onActiveVideoStreamChange={onActiveVideoStreamChange} onActiveAudioStreamsChange={onActiveAudioStreamsChange} />
                      )}

                      {!showRightBar && (
                        <FaAngleLeft
                          title={t('Show sidebar')}
                          size={30}
                          role="button"
                          style={{ marginRight: 10, color: 'var(--gray-12)', opacity: 0.7 }}
                          onClick={toggleSegmentsList}
                        />
                      )}
                    </div>
                  )}
                </div>

                <AnimatePresence>
                  {showRightBar && isFileOpened && filePath != null && (
                    <SegmentList
                      width={rightBarWidth}
                      currentSegIndex={currentSegIndexSafe}
                      cutSegments={cutSegments}
                      inverseCutSegments={inverseCutSegments}
                      getFrameCount={getFrameCount}
                      formatTimecode={formatTimecode}
                      onSegClick={setCurrentSegIndex}
                      updateSegOrder={updateSegOrder}
                      updateSegOrders={updateSegOrders}
                      onLabelSegment={labelSegment}
                      currentCutSeg={currentCutSeg}
                      firstSegmentAtCursor={firstSegmentAtCursor}
                      addSegment={addSegment}
                      onDuplicateSegmentClick={duplicateSegment}
                      removeSegment={removeSegment}
                      onRemoveSelected={removeSelectedSegments}
                      toggleSegmentsList={toggleSegmentsList}
                      splitCurrentSegment={splitCurrentSegment}
                      selectedSegments={segmentsOrInverse.selected}
                      onSelectSingleSegment={selectOnlySegment}
                      onToggleSegmentSelected={toggleSegmentSelected}
                      onDeselectAllSegments={deselectAllSegments}
                      onSelectAllSegments={selectAllSegments}
                      onInvertSelectedSegments={invertSelectedSegments}
                      onExtractSegmentsFramesAsImages={extractSegmentsFramesAsImages}
                      onExtractSelectedSegmentsFramesAsImages={extractSelectedSegmentsFramesAsImages}
                      jumpSegStart={jumpSegStart}
                      jumpSegEnd={jumpSegEnd}
                      onSelectSegmentsByLabel={selectSegmentsByLabel}
                      onSelectSegmentsByExpr={selectSegmentsByExpr}
                      onSelectAllMarkers={selectAllMarkers}
                      onMutateSegmentsByExpr={mutateSegmentsByExpr}
                      onLabelSelectedSegments={labelSelectedSegments}
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
                  overviewWaveform={overviewWaveform}
                  shouldShowWaveform={shouldShowWaveform}
                  waveformEnabled={waveformEnabled}
                  waveformHeight={waveformHeight}
                  showThumbnails={showThumbnails}
                  neighbouringKeyFrames={neighbouringKeyFrames}
                  thumbnails={thumbnailsSorted}
                  playerTime={playerTime}
                  commandedTime={commandedTime}
                  relevantTime={relevantTime}
                  commandedTimeRef={commandedTimeRef}
                  startTimeOffset={startTimeOffset}
                  zoom={zoom}
                  seekAbs={seekAbs}
                  fileDurationNonZero={fileDurationNonZero}
                  cutSegments={cutSegments}
                  setCurrentSegIndex={setCurrentSegIndex}
                  currentSegIndexSafe={currentSegIndexSafe}
                  inverseCutSegments={inverseCutSegments}
                  formatTimecode={formatTimecode}
                  formatTimeAndFrames={formatTimeAndFrames}
                  zoomWindowStartTime={zoomWindowStartTime}
                  zoomWindowEndTime={zoomWindowEndTime}
                  onZoomWindowStartTimeChange={setZoomWindowStartTime}
                  onGenerateOverviewWaveformClick={onGenerateOverviewWaveformClick}
                  playing={playing}
                  isFileOpened={isFileOpened}
                  onWheel={onTimelineWheel}
                  goToTimecode={goToTimecode}
                  darkMode={darkMode}
                />

                <BottomBar
                  zoom={zoom}
                  setZoom={zoomAbs}
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
                  toggleDarkMode={toggleDarkMode}
                  outputPlaybackRate={outputPlaybackRate}
                  setOutputPlaybackRate={setOutputPlaybackRate}
                  formatTimecode={formatTimecode}
                  parseTimecode={parseTimecode}
                  playbackRate={playbackRate}
                />
              </div>

              {tunerVisible != null && <ValueTuners type={tunerVisible} onFinished={() => setTunerVisible(undefined)} />}

              {/* Dialogs */}

              <ExportConfirm areWeCutting={areWeCutting} segmentsOrInverse={segmentsOrInverse} segmentsToExport={segmentsToExport} willMerge={willMerge} visible={exportConfirmVisible} onClosePress={closeExportConfirm} onExportConfirm={onExportConfirm} renderOutFmt={renderOutFmt} outputDir={outputDir} numStreamsTotal={numStreamsTotal} numStreamsToCopy={numStreamsToCopy} onShowStreamsSelectorClick={handleShowStreamsSelectorClick} outFormat={fileFormat} setOutSegTemplate={setOutSegTemplate} outSegTemplate={outSegTemplateOrDefault} mergedFileTemplate={mergedFileTemplateOrDefault} setMergedFileTemplate={setMergedFileTemplate} generateOutSegFileNames={generateOutSegFileNames} generateMergedFileNames={generateMergedFileNames} currentSegIndexSafe={currentSegIndexSafe} mainCopiedThumbnailStreams={mainCopiedThumbnailStreams} needSmartCut={needSmartCut} smartCutBitrate={smartCutBitrate} setSmartCutBitrate={setSmartCutBitrate} toggleSettings={toggleSettings} outputPlaybackRate={outputPlaybackRate} />

              <Sheet visible={streamsSelectorShown} onClosePress={() => setStreamsSelectorShown(false)} maxWidth={1000}>
                {mainStreams && filePath != null && (
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
                    shortestFlag={shortestFlag}
                    setShortestFlag={setShortestFlag}
                    nonCopiedExtraStreams={nonCopiedExtraStreams}
                    customTagsByFile={customTagsByFile}
                    setCustomTagsByFile={setCustomTagsByFile}
                    paramsByStreamId={paramsByStreamId}
                    updateStreamParams={updateStreamParams}
                    formatTimecode={formatTimecode}
                    loadSubtitleTrackToSegments={loadSubtitleTrackToSegments}
                    toggleCopyStreamIds={toggleCopyStreamIds}
                    changeEnabledStreamsFilter={changeEnabledStreamsFilter}
                    toggleCopyAllStreamsForPath={toggleCopyAllStreamsForPath}
                  />
                )}
              </Sheet>

              <LastCommandsSheet
                visible={lastCommandsVisible}
                onTogglePress={toggleLastCommands}
                ffmpegCommandLog={ffmpegCommandLog}
                setFfmpegCommandLog={setFfmpegCommandLog}
              />

              <Sheet visible={settingsVisible} onClosePress={toggleSettings}>
                <Settings
                  onTunerRequested={onTunerRequested}
                  onKeyboardShortcutsDialogRequested={toggleKeyboardShortcuts}
                  askForCleanupChoices={askForCleanupChoices}
                  toggleStoreProjectInWorkingDir={toggleStoreProjectInWorkingDir}
                  simpleMode={simpleMode}
                  clearOutDir={clearOutDir}
                />
              </Sheet>

              <ConcatDialog isShown={batchFiles.length > 0 && concatDialogVisible} onHide={() => setConcatDialogVisible(false)} paths={batchFilePaths} onConcat={userConcatFiles} setAlwaysConcatMultipleFiles={setAlwaysConcatMultipleFiles} alwaysConcatMultipleFiles={alwaysConcatMultipleFiles} exportCount={exportCount} maxLabelLength={maxLabelLength} />

              <KeyboardShortcuts isShown={keyboardShortcutsVisible} onHide={() => setKeyboardShortcutsVisible(false)} keyBindings={keyBindings} setKeyBindings={setKeyBindings} currentCutSeg={currentCutSeg} resetKeyBindings={resetKeyBindings} />

              {/* This should probably be last, so that it's always on top */}
              <AnimatePresence>
                {working && <Working text={working.text} progress={progress} onAbortClick={abortWorking} />}
              </AnimatePresence>
            </div>
          </ThemeProvider>
        </UserSettingsContext.Provider>
      </SegColorsContext.Provider>

      <div id="swal2-container-wrapper" className={darkMode ? 'dark-theme' : undefined} style={baseColorStyle} />
    </>
  );
}

export default memo(App);
