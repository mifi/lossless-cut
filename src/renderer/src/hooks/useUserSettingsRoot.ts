import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import i18n from 'i18next';
import { Transition } from 'framer-motion';

import { Config } from '../../../../types';

import { errorToast } from '../swal';
import isDev from '../isDev';
import { mySpring, setPrefersReducedMotion } from '../animations';

const { configStore } = window.require('@electron/remote').require('./index.js');
const { systemPreferences } = window.require('@electron/remote');

const animationSettings = systemPreferences.getAnimationSettings();

export default () => {
  const firstUpdateRef = useRef(true);

  function safeSetConfig<T extends keyof Config>(keyValue: Record<T, Config[T]>) {
    const entry = Object.entries(keyValue)[0]!;
    const key = entry[0] as T;
    const value = entry[1] as Config[T];

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

  function safeGetConfig<T extends keyof Config>(key: T) {
    const rawVal = configStore.get(key);
    // NOTE: Need to clone any non-primitive in renderer, or it will become very slow
    // I think because Electron is proxying objects over the bridge
    const cloned: typeof rawVal = rawVal === undefined
      ? undefined
      : JSON.parse(JSON.stringify(rawVal));

    return cloned;
  }

  // From https://reactjs.org/docs/hooks-reference.html#lazy-initial-state
  // If the initial state is the result of an expensive computation, you may provide a function instead, which will be executed only on the initial render
  // Without this there was a huge performance issue https://github.com/mifi/lossless-cut/issues/1097
  const safeGetConfigInitial = <T extends keyof Config>(key: T) => () => safeGetConfig(key);

  const [captureFormat, setCaptureFormat] = useState(safeGetConfigInitial('captureFormat'));
  useEffect(() => safeSetConfig({ captureFormat }), [captureFormat]);
  const [customOutDir, setCustomOutDir] = useState(safeGetConfigInitial('customOutDir'));
  useEffect(() => safeSetConfig({ customOutDir }), [customOutDir]);
  const [keyframeCut, setKeyframeCut] = useState(safeGetConfigInitial('keyframeCut'));
  useEffect(() => safeSetConfig({ keyframeCut }), [keyframeCut]);
  const [preserveMetadata, setPreserveMetadata] = useState(safeGetConfigInitial('preserveMetadata'));
  useEffect(() => safeSetConfig({ preserveMetadata }), [preserveMetadata]);
  const [preserveMetadataOnMerge, setPreserveMetadataOnMerge] = useState(safeGetConfigInitial('preserveMetadataOnMerge'));
  useEffect(() => safeSetConfig({ preserveMetadataOnMerge }), [preserveMetadataOnMerge]);
  const [preserveMovData, setPreserveMovData] = useState(safeGetConfigInitial('preserveMovData'));
  useEffect(() => safeSetConfig({ preserveMovData }), [preserveMovData]);
  const [preserveChapters, setPreserveChapters] = useState(safeGetConfigInitial('preserveChapters'));
  useEffect(() => safeSetConfig({ preserveChapters }), [preserveChapters]);
  const [movFastStart, setMovFastStart] = useState(safeGetConfigInitial('movFastStart'));
  useEffect(() => safeSetConfig({ movFastStart }), [movFastStart]);
  const [avoidNegativeTs, setAvoidNegativeTs] = useState(safeGetConfigInitial('avoidNegativeTs'));
  useEffect(() => safeSetConfig({ avoidNegativeTs }), [avoidNegativeTs]);
  const [autoMerge, setAutoMerge] = useState(safeGetConfigInitial('autoMerge'));
  useEffect(() => safeSetConfig({ autoMerge }), [autoMerge]);
  const [timecodeFormat, setTimecodeFormat] = useState(safeGetConfigInitial('timecodeFormat'));
  useEffect(() => safeSetConfig({ timecodeFormat }), [timecodeFormat]);
  const [invertCutSegments, setInvertCutSegments] = useState(safeGetConfigInitial('invertCutSegments'));
  useEffect(() => safeSetConfig({ invertCutSegments }), [invertCutSegments]);
  const [autoExportExtraStreams, setAutoExportExtraStreams] = useState(safeGetConfigInitial('autoExportExtraStreams'));
  useEffect(() => safeSetConfig({ autoExportExtraStreams }), [autoExportExtraStreams]);
  const [askBeforeClose, setAskBeforeClose] = useState(safeGetConfigInitial('askBeforeClose'));
  useEffect(() => safeSetConfig({ askBeforeClose }), [askBeforeClose]);
  const [enableAskForImportChapters, setEnableAskForImportChapters] = useState(safeGetConfigInitial('enableAskForImportChapters'));
  useEffect(() => safeSetConfig({ enableAskForImportChapters }), [enableAskForImportChapters]);
  const [enableAskForFileOpenAction, setEnableAskForFileOpenAction] = useState(safeGetConfigInitial('enableAskForFileOpenAction'));
  useEffect(() => safeSetConfig({ enableAskForFileOpenAction }), [enableAskForFileOpenAction]);
  const [playbackVolume, setPlaybackVolume] = useState(safeGetConfigInitial('playbackVolume'));
  useEffect(() => safeSetConfig({ playbackVolume }), [playbackVolume]);
  const [autoSaveProjectFile, setAutoSaveProjectFile] = useState(safeGetConfigInitial('autoSaveProjectFile'));
  useEffect(() => safeSetConfig({ autoSaveProjectFile }), [autoSaveProjectFile]);
  const [wheelSensitivity, setWheelSensitivity] = useState(safeGetConfigInitial('wheelSensitivity'));
  useEffect(() => safeSetConfig({ wheelSensitivity }), [wheelSensitivity]);
  const [waveformHeight, setWaveformHeight] = useState(safeGetConfigInitial('waveformHeight'));
  useEffect(() => safeSetConfig({ waveformHeight }), [waveformHeight]);
  const [invertTimelineScroll, setInvertTimelineScroll] = useState(safeGetConfigInitial('invertTimelineScroll'));
  useEffect(() => safeSetConfig({ invertTimelineScroll }), [invertTimelineScroll]);
  const [language, setLanguage] = useState(safeGetConfigInitial('language'));
  useEffect(() => safeSetConfig({ language }), [language]);
  const [ffmpegExperimental, setFfmpegExperimental] = useState(safeGetConfigInitial('ffmpegExperimental'));
  useEffect(() => safeSetConfig({ ffmpegExperimental }), [ffmpegExperimental]);
  const [hideNotifications, setHideNotifications] = useState(safeGetConfigInitial('hideNotifications'));
  useEffect(() => safeSetConfig({ hideNotifications }), [hideNotifications]);
  const [hideOsNotifications, setHideOsNotifications] = useState(safeGetConfigInitial('hideOsNotifications'));
  useEffect(() => safeSetConfig({ hideOsNotifications }), [hideOsNotifications]);
  const [autoLoadTimecode, setAutoLoadTimecode] = useState(safeGetConfigInitial('autoLoadTimecode'));
  useEffect(() => safeSetConfig({ autoLoadTimecode }), [autoLoadTimecode]);
  const [autoDeleteMergedSegments, setAutoDeleteMergedSegments] = useState(safeGetConfigInitial('autoDeleteMergedSegments'));
  useEffect(() => safeSetConfig({ autoDeleteMergedSegments }), [autoDeleteMergedSegments]);
  const [exportConfirmEnabled, setExportConfirmEnabled] = useState(safeGetConfigInitial('exportConfirmEnabled'));
  useEffect(() => safeSetConfig({ exportConfirmEnabled }), [exportConfirmEnabled]);
  const [segmentsToChapters, setSegmentsToChapters] = useState(safeGetConfigInitial('segmentsToChapters'));
  useEffect(() => safeSetConfig({ segmentsToChapters }), [segmentsToChapters]);
  const [simpleMode, setSimpleMode] = useState(safeGetConfigInitial('simpleMode'));
  useEffect(() => safeSetConfig({ simpleMode }), [simpleMode]);
  const [outSegTemplate, setOutSegTemplate] = useState(safeGetConfigInitial('outSegTemplate'));
  useEffect(() => safeSetConfig({ outSegTemplate }), [outSegTemplate]);
  const [mergedFileTemplate, setMergedFileTemplate] = useState(safeGetConfigInitial('mergedFileTemplate'));
  useEffect(() => safeSetConfig({ mergedFileTemplate }), [mergedFileTemplate]);
  const [keyboardSeekAccFactor, setKeyboardSeekAccFactor] = useState(safeGetConfigInitial('keyboardSeekAccFactor'));
  useEffect(() => safeSetConfig({ keyboardSeekAccFactor }), [keyboardSeekAccFactor]);
  const [keyboardNormalSeekSpeed, setKeyboardNormalSeekSpeed] = useState(safeGetConfigInitial('keyboardNormalSeekSpeed'));
  useEffect(() => safeSetConfig({ keyboardNormalSeekSpeed }), [keyboardNormalSeekSpeed]);
  const [keyboardSeekSpeed2, setKeyboardSeekSpeed2] = useState(safeGetConfigInitial('keyboardSeekSpeed2'));
  useEffect(() => safeSetConfig({ keyboardSeekSpeed2 }), [keyboardSeekSpeed2]);
  const [keyboardSeekSpeed3, setKeyboardSeekSpeed3] = useState(safeGetConfigInitial('keyboardSeekSpeed3'));
  useEffect(() => safeSetConfig({ keyboardSeekSpeed3 }), [keyboardSeekSpeed3]);

  const [treatInputFileModifiedTimeAsStart, setTreatInputFileModifiedTimeAsStart] = useState(safeGetConfigInitial('treatInputFileModifiedTimeAsStart'));
  useEffect(() => safeSetConfig({ treatInputFileModifiedTimeAsStart }), [treatInputFileModifiedTimeAsStart]);
  const [treatOutputFileModifiedTimeAsStart, setTreatOutputFileModifiedTimeAsStart] = useState(safeGetConfigInitial('treatOutputFileModifiedTimeAsStart'));
  useEffect(() => safeSetConfig({ treatOutputFileModifiedTimeAsStart }), [treatOutputFileModifiedTimeAsStart]);

  const [outFormatLocked, setOutFormatLocked] = useState(safeGetConfigInitial('outFormatLocked'));
  useEffect(() => safeSetConfig({ outFormatLocked }), [outFormatLocked]);
  const [safeOutputFileName, setSafeOutputFileName] = useState(safeGetConfigInitial('safeOutputFileName'));
  useEffect(() => safeSetConfig({ safeOutputFileName }), [safeOutputFileName]);
  const [enableAutoHtml5ify, setEnableAutoHtml5ify] = useState(safeGetConfigInitial('enableAutoHtml5ify'));
  useEffect(() => safeSetConfig({ enableAutoHtml5ify }), [enableAutoHtml5ify]);
  const [segmentsToChaptersOnly, setSegmentsToChaptersOnly] = useState(safeGetConfigInitial('segmentsToChaptersOnly'));
  useEffect(() => safeSetConfig({ segmentsToChaptersOnly }), [segmentsToChaptersOnly]);
  const [keyBindings, setKeyBindings] = useState(safeGetConfigInitial('keyBindings'));
  useEffect(() => safeSetConfig({ keyBindings }), [keyBindings]);
  const [enableSmartCut, setEnableSmartCut] = useState(safeGetConfigInitial('enableSmartCut'));
  useEffect(() => safeSetConfig({ enableSmartCut }), [enableSmartCut]);
  const [customFfPath, setCustomFfPath] = useState(safeGetConfigInitial('customFfPath'));
  useEffect(() => safeSetConfig({ customFfPath }), [customFfPath]);
  const [storeProjectInWorkingDir, setStoreProjectInWorkingDir] = useState(safeGetConfigInitial('storeProjectInWorkingDir'));
  useEffect(() => safeSetConfig({ storeProjectInWorkingDir }), [storeProjectInWorkingDir]);
  const [enableOverwriteOutput, setEnableOverwriteOutput] = useState(safeGetConfigInitial('enableOverwriteOutput'));
  useEffect(() => safeSetConfig({ enableOverwriteOutput }), [enableOverwriteOutput]);
  const [mouseWheelZoomModifierKey, setMouseWheelZoomModifierKey] = useState(safeGetConfigInitial('mouseWheelZoomModifierKey'));
  useEffect(() => safeSetConfig({ mouseWheelZoomModifierKey }), [mouseWheelZoomModifierKey]);
  const [mouseWheelFrameSeekModifierKey, setMouseWheelFrameSeekModifierKey] = useState(safeGetConfigInitial('mouseWheelFrameSeekModifierKey'));
  useEffect(() => safeSetConfig({ mouseWheelFrameSeekModifierKey }), [mouseWheelFrameSeekModifierKey]);
  const [mouseWheelKeyframeSeekModifierKey, setMouseWheelKeyframeSeekModifierKey] = useState(safeGetConfigInitial('mouseWheelKeyframeSeekModifierKey'));
  useEffect(() => safeSetConfig({ mouseWheelKeyframeSeekModifierKey }), [mouseWheelKeyframeSeekModifierKey]);
  const [captureFrameMethod, setCaptureFrameMethod] = useState(safeGetConfigInitial('captureFrameMethod'));
  useEffect(() => safeSetConfig({ captureFrameMethod }), [captureFrameMethod]);
  const [captureFrameQuality, setCaptureFrameQuality] = useState(safeGetConfigInitial('captureFrameQuality'));
  useEffect(() => safeSetConfig({ captureFrameQuality }), [captureFrameQuality]);
  const [captureFrameFileNameFormat, setCaptureFrameFileNameFormat] = useState(safeGetConfigInitial('captureFrameFileNameFormat'));
  useEffect(() => safeSetConfig({ captureFrameFileNameFormat }), [captureFrameFileNameFormat]);
  const [enableNativeHevc, setEnableNativeHevc] = useState(safeGetConfigInitial('enableNativeHevc'));
  useEffect(() => safeSetConfig({ enableNativeHevc }), [enableNativeHevc]);
  const [enableUpdateCheck, setEnableUpdateCheck] = useState(safeGetConfigInitial('enableUpdateCheck'));
  useEffect(() => safeSetConfig({ enableUpdateCheck }), [enableUpdateCheck]);
  const [cleanupChoices, setCleanupChoices] = useState(safeGetConfigInitial('cleanupChoices'));
  useEffect(() => safeSetConfig({ cleanupChoices }), [cleanupChoices]);
  const [allowMultipleInstances, setAllowMultipleInstances] = useState(safeGetConfigInitial('allowMultipleInstances'));
  useEffect(() => safeSetConfig({ allowMultipleInstances }), [allowMultipleInstances]);
  const [darkMode, setDarkMode] = useState(safeGetConfigInitial('darkMode'));
  useEffect(() => safeSetConfig({ darkMode }), [darkMode]);
  const [preferStrongColors, setPreferStrongColors] = useState(safeGetConfigInitial('preferStrongColors'));
  useEffect(() => safeSetConfig({ preferStrongColors }), [preferStrongColors]);
  const [outputFileNameMinZeroPadding, setOutputFileNameMinZeroPadding] = useState(safeGetConfigInitial('outputFileNameMinZeroPadding'));
  useEffect(() => safeSetConfig({ outputFileNameMinZeroPadding }), [outputFileNameMinZeroPadding]);
  const [cutFromAdjustmentFrames, setCutFromAdjustmentFrames] = useState(safeGetConfigInitial('cutFromAdjustmentFrames'));
  useEffect(() => safeSetConfig({ cutFromAdjustmentFrames }), [cutFromAdjustmentFrames]);
  const [cutToAdjustmentFrames, setCutToAdjustmentFrames] = useState(safeGetConfigInitial('cutToAdjustmentFrames'));
  useEffect(() => safeSetConfig({ cutToAdjustmentFrames }), [cutToAdjustmentFrames]);
  const [storeWindowBounds, setStoreWindowBounds] = useState(safeGetConfigInitial('storeWindowBounds'));
  useEffect(() => safeSetConfig({ storeWindowBounds }), [storeWindowBounds]);
  const [waveformMode, setWaveformMode] = useState(safeGetConfigInitial('waveformMode'));
  useEffect(() => safeSetConfig({ waveformMode }), [waveformMode]);
  const [thumbnailsEnabled, setThumbnailsEnabled] = useState(safeGetConfigInitial('thumbnailsEnabled'));
  useEffect(() => safeSetConfig({ thumbnailsEnabled }), [thumbnailsEnabled]);
  const [keyframesEnabled, setKeyframesEnabled] = useState(safeGetConfigInitial('keyframesEnabled'));
  useEffect(() => safeSetConfig({ keyframesEnabled }), [keyframesEnabled]);
  const [reducedMotion, setReducedMotion] = useState(safeGetConfigInitial('reducedMotion'));
  useEffect(() => safeSetConfig({ reducedMotion }), [reducedMotion]);


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

  const toggleDarkMode = useCallback(() => setDarkMode((v) => !v), []);

  const prefersReducedMotion = useMemo(() => {
    if (reducedMotion !== 'user') return reducedMotion === 'always';
    // fallback to electron detected system setting
    // note: user has to restart app for changes here to be detected
    return animationSettings.prefersReducedMotion;
  }, [reducedMotion]);

  useEffect(() => {
    setPrefersReducedMotion(prefersReducedMotion);
  }, [prefersReducedMotion]);

  const springAnimation = useMemo<Transition>(() => (prefersReducedMotion ? { duration: 0 } : mySpring), [prefersReducedMotion]);

  return {
    captureFormat,
    setCaptureFormat,
    customOutDir,
    setCustomOutDir,
    keyframeCut,
    setKeyframeCut,
    preserveMetadata,
    setPreserveMetadata,
    preserveMetadataOnMerge,
    setPreserveMetadataOnMerge,
    preserveMovData,
    setPreserveMovData,
    preserveChapters,
    setPreserveChapters,
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
    waveformHeight,
    setWaveformHeight,
    invertTimelineScroll,
    setInvertTimelineScroll,
    language,
    setLanguage,
    ffmpegExperimental,
    setFfmpegExperimental,
    hideNotifications,
    setHideNotifications,
    hideOsNotifications,
    setHideOsNotifications,
    autoLoadTimecode,
    setAutoLoadTimecode,
    autoDeleteMergedSegments,
    setAutoDeleteMergedSegments,
    exportConfirmEnabled,
    setExportConfirmEnabled,
    segmentsToChapters,
    setSegmentsToChapters,
    simpleMode,
    setSimpleMode,
    outSegTemplate,
    setOutSegTemplate,
    mergedFileTemplate,
    setMergedFileTemplate,
    keyboardSeekAccFactor,
    setKeyboardSeekAccFactor,
    keyboardNormalSeekSpeed,
    setKeyboardNormalSeekSpeed,
    keyboardSeekSpeed2,
    setKeyboardSeekSpeed2,
    keyboardSeekSpeed3,
    setKeyboardSeekSpeed3,
    treatInputFileModifiedTimeAsStart,
    setTreatInputFileModifiedTimeAsStart,
    treatOutputFileModifiedTimeAsStart,
    setTreatOutputFileModifiedTimeAsStart,
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
    mouseWheelFrameSeekModifierKey,
    setMouseWheelFrameSeekModifierKey,
    mouseWheelKeyframeSeekModifierKey,
    setMouseWheelKeyframeSeekModifierKey,
    captureFrameMethod,
    setCaptureFrameMethod,
    captureFrameQuality,
    setCaptureFrameQuality,
    captureFrameFileNameFormat,
    setCaptureFrameFileNameFormat,
    enableNativeHevc,
    setEnableNativeHevc,
    enableUpdateCheck,
    setEnableUpdateCheck,
    cleanupChoices,
    setCleanupChoices,
    allowMultipleInstances,
    setAllowMultipleInstances,
    darkMode,
    toggleDarkMode,
    preferStrongColors,
    setPreferStrongColors,
    outputFileNameMinZeroPadding,
    setOutputFileNameMinZeroPadding,
    cutFromAdjustmentFrames,
    setCutFromAdjustmentFrames,
    cutToAdjustmentFrames,
    setCutToAdjustmentFrames,
    storeWindowBounds,
    setStoreWindowBounds,
    waveformMode,
    setWaveformMode,
    thumbnailsEnabled,
    setThumbnailsEnabled,
    keyframesEnabled,
    setKeyframesEnabled,
    reducedMotion,
    prefersReducedMotion,
    setReducedMotion,
    springAnimation,
  };
};
