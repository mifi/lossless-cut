import { useEffect, useState, useRef, useCallback } from 'react';
import i18n from 'i18next';

import { errorToast } from '../util';
import isDev from '../isDev';

const remote = window.require('@electron/remote');

const configStore = remote.require('./configStore');

export default () => {
  const firstUpdateRef = useRef(true);

  function safeSetConfig(key, value) {
    // Prevent flood-saving all config during mount
    if (firstUpdateRef.current) return;

    if (isDev) console.log('save', key, value);
    try {
      configStore.set(key, value);
    } catch (err) {
      console.error('Failed to set config', key, err);
      errorToast(i18n.t('Unable to save your preferences. Try to disable any anti-virus'));
    }
  }

  function safeGetConfig(key) {
    const rawVal = configStore.get(key);
    if (rawVal === undefined) return undefined;
    // NOTE: Need to clone any non-primitive in renderer, or it will become very slow
    // I think because Electron is proxying objects over the bridge
    return JSON.parse(JSON.stringify(rawVal));
  }

  // From https://reactjs.org/docs/hooks-reference.html#lazy-initial-state
  // If the initial state is the result of an expensive computation, you may provide a function instead, which will be executed only on the initial render
  // Without this there was a huge performance issue https://github.com/mifi/lossless-cut/issues/1097
  const safeGetConfigInitial = (...args) => () => safeGetConfig(...args);

  const [captureFormat, setCaptureFormat] = useState(safeGetConfigInitial('captureFormat'));
  useEffect(() => safeSetConfig('captureFormat', captureFormat), [captureFormat]);
  const [customOutDir, setCustomOutDir] = useState(safeGetConfigInitial('customOutDir'));
  useEffect(() => safeSetConfig('customOutDir', customOutDir), [customOutDir]);
  const [keyframeCut, setKeyframeCut] = useState(safeGetConfigInitial('keyframeCut'));
  useEffect(() => safeSetConfig('keyframeCut', keyframeCut), [keyframeCut]);
  const [preserveMovData, setPreserveMovData] = useState(safeGetConfigInitial('preserveMovData'));
  useEffect(() => safeSetConfig('preserveMovData', preserveMovData), [preserveMovData]);
  const [movFastStart, setMovFastStart] = useState(safeGetConfigInitial('movFastStart'));
  useEffect(() => safeSetConfig('movFastStart', movFastStart), [movFastStart]);
  const [avoidNegativeTs, setAvoidNegativeTs] = useState(safeGetConfigInitial('avoidNegativeTs'));
  useEffect(() => safeSetConfig('avoidNegativeTs', avoidNegativeTs), [avoidNegativeTs]);
  const [autoMerge, setAutoMerge] = useState(safeGetConfigInitial('autoMerge'));
  useEffect(() => safeSetConfig('autoMerge', autoMerge), [autoMerge]);
  const [timecodeFormat, setTimecodeFormat] = useState(safeGetConfigInitial('timecodeFormat'));
  useEffect(() => safeSetConfig('timecodeFormat', timecodeFormat), [timecodeFormat]);
  const [invertCutSegments, setInvertCutSegments] = useState(safeGetConfigInitial('invertCutSegments'));
  useEffect(() => safeSetConfig('invertCutSegments', invertCutSegments), [invertCutSegments]);
  const [autoExportExtraStreams, setAutoExportExtraStreams] = useState(safeGetConfigInitial('autoExportExtraStreams'));
  useEffect(() => safeSetConfig('autoExportExtraStreams', autoExportExtraStreams), [autoExportExtraStreams]);
  const [askBeforeClose, setAskBeforeClose] = useState(safeGetConfigInitial('askBeforeClose'));
  useEffect(() => safeSetConfig('askBeforeClose', askBeforeClose), [askBeforeClose]);
  const [enableAskForImportChapters, setEnableAskForImportChapters] = useState(safeGetConfigInitial('enableAskForImportChapters'));
  useEffect(() => safeSetConfig('enableAskForImportChapters', enableAskForImportChapters), [enableAskForImportChapters]);
  const [enableAskForFileOpenAction, setEnableAskForFileOpenAction] = useState(safeGetConfigInitial('enableAskForFileOpenAction'));
  useEffect(() => safeSetConfig('enableAskForFileOpenAction', enableAskForFileOpenAction), [enableAskForFileOpenAction]);
  const [playbackVolume, setPlaybackVolume] = useState(safeGetConfigInitial('playbackVolume'));
  useEffect(() => safeSetConfig('playbackVolume', playbackVolume), [playbackVolume]);
  const [autoSaveProjectFile, setAutoSaveProjectFile] = useState(safeGetConfigInitial('autoSaveProjectFile'));
  useEffect(() => safeSetConfig('autoSaveProjectFile', autoSaveProjectFile), [autoSaveProjectFile]);
  const [wheelSensitivity, setWheelSensitivity] = useState(safeGetConfigInitial('wheelSensitivity'));
  useEffect(() => safeSetConfig('wheelSensitivity', wheelSensitivity), [wheelSensitivity]);
  const [invertTimelineScroll, setInvertTimelineScroll] = useState(safeGetConfigInitial('invertTimelineScroll'));
  useEffect(() => safeSetConfig('invertTimelineScroll', invertTimelineScroll), [invertTimelineScroll]);
  const [language, setLanguage] = useState(safeGetConfigInitial('language'));
  useEffect(() => safeSetConfig('language', language), [language]);
  const [ffmpegExperimental, setFfmpegExperimental] = useState(safeGetConfigInitial('ffmpegExperimental'));
  useEffect(() => safeSetConfig('ffmpegExperimental', ffmpegExperimental), [ffmpegExperimental]);
  const [hideNotifications, setHideNotifications] = useState(safeGetConfigInitial('hideNotifications'));
  useEffect(() => safeSetConfig('hideNotifications', hideNotifications), [hideNotifications]);
  const [autoLoadTimecode, setAutoLoadTimecode] = useState(safeGetConfigInitial('autoLoadTimecode'));
  useEffect(() => safeSetConfig('autoLoadTimecode', autoLoadTimecode), [autoLoadTimecode]);
  const [autoDeleteMergedSegments, setAutoDeleteMergedSegments] = useState(safeGetConfigInitial('autoDeleteMergedSegments'));
  useEffect(() => safeSetConfig('autoDeleteMergedSegments', autoDeleteMergedSegments), [autoDeleteMergedSegments]);
  const [exportConfirmEnabled, setExportConfirmEnabled] = useState(safeGetConfigInitial('exportConfirmEnabled'));
  useEffect(() => safeSetConfig('exportConfirmEnabled', exportConfirmEnabled), [exportConfirmEnabled]);
  const [segmentsToChapters, setSegmentsToChapters] = useState(safeGetConfigInitial('segmentsToChapters'));
  useEffect(() => safeSetConfig('segmentsToChapters', segmentsToChapters), [segmentsToChapters]);
  const [preserveMetadataOnMerge, setPreserveMetadataOnMerge] = useState(safeGetConfigInitial('preserveMetadataOnMerge'));
  useEffect(() => safeSetConfig('preserveMetadataOnMerge', preserveMetadataOnMerge), [preserveMetadataOnMerge]);
  const [simpleMode, setSimpleMode] = useState(safeGetConfigInitial('simpleMode'));
  useEffect(() => safeSetConfig('simpleMode', simpleMode), [simpleMode]);
  const [outSegTemplate, setOutSegTemplate] = useState(safeGetConfigInitial('outSegTemplate'));
  useEffect(() => safeSetConfig('outSegTemplate', outSegTemplate), [outSegTemplate]);
  const [keyboardSeekAccFactor, setKeyboardSeekAccFactor] = useState(safeGetConfigInitial('keyboardSeekAccFactor'));
  useEffect(() => safeSetConfig('keyboardSeekAccFactor', keyboardSeekAccFactor), [keyboardSeekAccFactor]);
  const [keyboardNormalSeekSpeed, setKeyboardNormalSeekSpeed] = useState(safeGetConfigInitial('keyboardNormalSeekSpeed'));
  useEffect(() => safeSetConfig('keyboardNormalSeekSpeed', keyboardNormalSeekSpeed), [keyboardNormalSeekSpeed]);
  const [enableTransferTimestamps, setEnableTransferTimestamps] = useState(safeGetConfigInitial('enableTransferTimestamps'));
  useEffect(() => safeSetConfig('enableTransferTimestamps', enableTransferTimestamps), [enableTransferTimestamps]);
  const [outFormatLocked, setOutFormatLocked] = useState(safeGetConfigInitial('outFormatLocked'));
  useEffect(() => safeSetConfig('outFormatLocked', outFormatLocked), [outFormatLocked]);
  const [safeOutputFileName, setSafeOutputFileName] = useState(safeGetConfigInitial('safeOutputFileName'));
  useEffect(() => safeSetConfig('safeOutputFileName', safeOutputFileName), [safeOutputFileName]);
  const [enableAutoHtml5ify, setEnableAutoHtml5ify] = useState(safeGetConfigInitial('enableAutoHtml5ify'));
  useEffect(() => safeSetConfig('enableAutoHtml5ify', enableAutoHtml5ify), [enableAutoHtml5ify]);
  const [segmentsToChaptersOnly, setSegmentsToChaptersOnly] = useState(safeGetConfigInitial('segmentsToChaptersOnly'));
  useEffect(() => safeSetConfig('segmentsToChaptersOnly', segmentsToChaptersOnly), [segmentsToChaptersOnly]);
  const [keyBindings, setKeyBindings] = useState(safeGetConfigInitial('keyBindings'));
  useEffect(() => safeSetConfig('keyBindings', keyBindings), [keyBindings]);
  const [enableSmartCut, setEnableSmartCut] = useState(safeGetConfigInitial('enableSmartCut'));
  useEffect(() => safeSetConfig('enableSmartCut', enableSmartCut), [enableSmartCut]);
  const [customFfPath, setCustomFfPath] = useState(safeGetConfigInitial('customFfPath'));
  useEffect(() => safeSetConfig('customFfPath', customFfPath), [customFfPath]);
  const [storeProjectInWorkingDir, setStoreProjectInWorkingDir] = useState(safeGetConfigInitial('storeProjectInWorkingDir'));
  useEffect(() => safeSetConfig('storeProjectInWorkingDir', storeProjectInWorkingDir), [storeProjectInWorkingDir]);
  const [enableOverwriteOutput, setEnableOverwriteOutput] = useState(safeGetConfigInitial('enableOverwriteOutput'));
  useEffect(() => safeSetConfig('enableOverwriteOutput', enableOverwriteOutput), [enableOverwriteOutput]);
  const [mouseWheelZoomModifierKey, setMouseWheelZoomModifierKey] = useState(safeGetConfigInitial('mouseWheelZoomModifierKey'));
  useEffect(() => safeSetConfig('mouseWheelZoomModifierKey', mouseWheelZoomModifierKey), [mouseWheelZoomModifierKey]);
  const [captureFrameMethod, setCaptureFrameMethod] = useState(safeGetConfigInitial('captureFrameMethod'));
  useEffect(() => safeSetConfig('captureFrameMethod', captureFrameMethod), [captureFrameMethod]);
  const [captureFrameQuality, setCaptureFrameQuality] = useState(safeGetConfigInitial('captureFrameQuality'));
  useEffect(() => safeSetConfig('captureFrameQuality', captureFrameQuality), [captureFrameQuality]);

  const resetKeyBindings = useCallback(() => {
    configStore.reset('keyBindings');
    setKeyBindings(safeGetConfig('keyBindings'));
  }, []);

  // NOTE! This useEffect must be placed after all usages of firstUpdateRef.current (safeSetConfig)
  useEffect(() => {
    firstUpdateRef.current = false;
    return () => {
      firstUpdateRef.current = true;
    };
  }, []);

  return {
    captureFormat,
    setCaptureFormat,
    customOutDir,
    setCustomOutDir,
    keyframeCut,
    setKeyframeCut,
    preserveMovData,
    setPreserveMovData,
    movFastStart,
    setMovFastStart,
    avoidNegativeTs,
    setAvoidNegativeTs,
    autoMerge,
    setAutoMerge,
    timecodeFormat,
    setTimecodeFormat,
    invertCutSegments,
    setInvertCutSegments,
    autoExportExtraStreams,
    setAutoExportExtraStreams,
    askBeforeClose,
    setAskBeforeClose,
    enableAskForImportChapters,
    setEnableAskForImportChapters,
    enableAskForFileOpenAction,
    setEnableAskForFileOpenAction,
    playbackVolume,
    setPlaybackVolume,
    autoSaveProjectFile,
    setAutoSaveProjectFile,
    wheelSensitivity,
    setWheelSensitivity,
    invertTimelineScroll,
    setInvertTimelineScroll,
    language,
    setLanguage,
    ffmpegExperimental,
    setFfmpegExperimental,
    hideNotifications,
    setHideNotifications,
    autoLoadTimecode,
    setAutoLoadTimecode,
    autoDeleteMergedSegments,
    setAutoDeleteMergedSegments,
    exportConfirmEnabled,
    setExportConfirmEnabled,
    segmentsToChapters,
    setSegmentsToChapters,
    preserveMetadataOnMerge,
    setPreserveMetadataOnMerge,
    simpleMode,
    setSimpleMode,
    outSegTemplate,
    setOutSegTemplate,
    keyboardSeekAccFactor,
    setKeyboardSeekAccFactor,
    keyboardNormalSeekSpeed,
    setKeyboardNormalSeekSpeed,
    enableTransferTimestamps,
    setEnableTransferTimestamps,
    outFormatLocked,
    setOutFormatLocked,
    safeOutputFileName,
    setSafeOutputFileName,
    enableAutoHtml5ify,
    setEnableAutoHtml5ify,
    segmentsToChaptersOnly,
    setSegmentsToChaptersOnly,
    keyBindings,
    setKeyBindings,
    resetKeyBindings,
    enableSmartCut,
    setEnableSmartCut,
    customFfPath,
    setCustomFfPath,
    storeProjectInWorkingDir,
    setStoreProjectInWorkingDir,
    enableOverwriteOutput,
    setEnableOverwriteOutput,
    mouseWheelZoomModifierKey,
    setMouseWheelZoomModifierKey,
    captureFrameMethod,
    setCaptureFrameMethod,
    captureFrameQuality,
    setCaptureFrameQuality,
  };
};
