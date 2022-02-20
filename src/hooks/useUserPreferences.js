import { useEffect, useState, useRef, useCallback } from 'react';
import i18n from 'i18next';

import { errorToast } from '../util';

const electron = window.require('electron'); // eslint-disable-line
const isDev = window.require('electron-is-dev');

const configStore = electron.remote.require('./configStore');

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

  const [captureFormat, setCaptureFormat] = useState(safeGetConfig('captureFormat'));
  useEffect(() => safeSetConfig('captureFormat', captureFormat), [captureFormat]);
  const [customOutDir, setCustomOutDir] = useState(safeGetConfig('customOutDir'));
  useEffect(() => safeSetConfig('customOutDir', customOutDir), [customOutDir]);
  const [keyframeCut, setKeyframeCut] = useState(safeGetConfig('keyframeCut'));
  useEffect(() => safeSetConfig('keyframeCut', keyframeCut), [keyframeCut]);
  const [preserveMovData, setPreserveMovData] = useState(safeGetConfig('preserveMovData'));
  useEffect(() => safeSetConfig('preserveMovData', preserveMovData), [preserveMovData]);
  const [movFastStart, setMovFastStart] = useState(safeGetConfig('movFastStart'));
  useEffect(() => safeSetConfig('movFastStart', movFastStart), [movFastStart]);
  const [avoidNegativeTs, setAvoidNegativeTs] = useState(safeGetConfig('avoidNegativeTs'));
  useEffect(() => safeSetConfig('avoidNegativeTs', avoidNegativeTs), [avoidNegativeTs]);
  const [autoMerge, setAutoMerge] = useState(safeGetConfig('autoMerge'));
  useEffect(() => safeSetConfig('autoMerge', autoMerge), [autoMerge]);
  const [timecodeFormat, setTimecodeFormat] = useState(safeGetConfig('timecodeFormat'));
  useEffect(() => safeSetConfig('timecodeFormat', timecodeFormat), [timecodeFormat]);
  const [invertCutSegments, setInvertCutSegments] = useState(safeGetConfig('invertCutSegments'));
  useEffect(() => safeSetConfig('invertCutSegments', invertCutSegments), [invertCutSegments]);
  const [autoExportExtraStreams, setAutoExportExtraStreams] = useState(safeGetConfig('autoExportExtraStreams'));
  useEffect(() => safeSetConfig('autoExportExtraStreams', autoExportExtraStreams), [autoExportExtraStreams]);
  const [askBeforeClose, setAskBeforeClose] = useState(safeGetConfig('askBeforeClose'));
  useEffect(() => safeSetConfig('askBeforeClose', askBeforeClose), [askBeforeClose]);
  const [enableAskForImportChapters, setEnableAskForImportChapters] = useState(safeGetConfig('enableAskForImportChapters'));
  useEffect(() => safeSetConfig('enableAskForImportChapters', enableAskForImportChapters), [enableAskForImportChapters]);
  const [enableAskForFileOpenAction, setEnableAskForFileOpenAction] = useState(safeGetConfig('enableAskForFileOpenAction'));
  useEffect(() => safeSetConfig('enableAskForFileOpenAction', enableAskForFileOpenAction), [enableAskForFileOpenAction]);
  const [playbackVolume, setPlaybackVolume] = useState(safeGetConfig('playbackVolume'));
  useEffect(() => safeSetConfig('playbackVolume', playbackVolume), [playbackVolume]);
  const [autoSaveProjectFile, setAutoSaveProjectFile] = useState(safeGetConfig('autoSaveProjectFile'));
  useEffect(() => safeSetConfig('autoSaveProjectFile', autoSaveProjectFile), [autoSaveProjectFile]);
  const [wheelSensitivity, setWheelSensitivity] = useState(safeGetConfig('wheelSensitivity'));
  useEffect(() => safeSetConfig('wheelSensitivity', wheelSensitivity), [wheelSensitivity]);
  const [invertTimelineScroll, setInvertTimelineScroll] = useState(safeGetConfig('invertTimelineScroll'));
  useEffect(() => safeSetConfig('invertTimelineScroll', invertTimelineScroll), [invertTimelineScroll]);
  const [language, setLanguage] = useState(safeGetConfig('language'));
  useEffect(() => safeSetConfig('language', language), [language]);
  const [ffmpegExperimental, setFfmpegExperimental] = useState(safeGetConfig('ffmpegExperimental'));
  useEffect(() => safeSetConfig('ffmpegExperimental', ffmpegExperimental), [ffmpegExperimental]);
  const [hideNotifications, setHideNotifications] = useState(safeGetConfig('hideNotifications'));
  useEffect(() => safeSetConfig('hideNotifications', hideNotifications), [hideNotifications]);
  const [autoLoadTimecode, setAutoLoadTimecode] = useState(safeGetConfig('autoLoadTimecode'));
  useEffect(() => safeSetConfig('autoLoadTimecode', autoLoadTimecode), [autoLoadTimecode]);
  const [autoDeleteMergedSegments, setAutoDeleteMergedSegments] = useState(safeGetConfig('autoDeleteMergedSegments'));
  useEffect(() => safeSetConfig('autoDeleteMergedSegments', autoDeleteMergedSegments), [autoDeleteMergedSegments]);
  const [exportConfirmEnabled, setExportConfirmEnabled] = useState(safeGetConfig('exportConfirmEnabled'));
  useEffect(() => safeSetConfig('exportConfirmEnabled', exportConfirmEnabled), [exportConfirmEnabled]);
  const [segmentsToChapters, setSegmentsToChapters] = useState(safeGetConfig('segmentsToChapters'));
  useEffect(() => safeSetConfig('segmentsToChapters', segmentsToChapters), [segmentsToChapters]);
  const [preserveMetadataOnMerge, setPreserveMetadataOnMerge] = useState(safeGetConfig('preserveMetadataOnMerge'));
  useEffect(() => safeSetConfig('preserveMetadataOnMerge', preserveMetadataOnMerge), [preserveMetadataOnMerge]);
  const [simpleMode, setSimpleMode] = useState(safeGetConfig('simpleMode'));
  useEffect(() => safeSetConfig('simpleMode', simpleMode), [simpleMode]);
  const [outSegTemplate, setOutSegTemplate] = useState(safeGetConfig('outSegTemplate'));
  useEffect(() => safeSetConfig('outSegTemplate', outSegTemplate), [outSegTemplate]);
  const [keyboardSeekAccFactor, setKeyboardSeekAccFactor] = useState(safeGetConfig('keyboardSeekAccFactor'));
  useEffect(() => safeSetConfig('keyboardSeekAccFactor', keyboardSeekAccFactor), [keyboardSeekAccFactor]);
  const [keyboardNormalSeekSpeed, setKeyboardNormalSeekSpeed] = useState(safeGetConfig('keyboardNormalSeekSpeed'));
  useEffect(() => safeSetConfig('keyboardNormalSeekSpeed', keyboardNormalSeekSpeed), [keyboardNormalSeekSpeed]);
  const [enableTransferTimestamps, setEnableTransferTimestamps] = useState(safeGetConfig('enableTransferTimestamps'));
  useEffect(() => safeSetConfig('enableTransferTimestamps', enableTransferTimestamps), [enableTransferTimestamps]);
  const [outFormatLocked, setOutFormatLocked] = useState(safeGetConfig('outFormatLocked'));
  useEffect(() => safeSetConfig('outFormatLocked', outFormatLocked), [outFormatLocked]);
  const [safeOutputFileName, setSafeOutputFileName] = useState(safeGetConfig('safeOutputFileName'));
  useEffect(() => safeSetConfig('safeOutputFileName', safeOutputFileName), [safeOutputFileName]);
  const [enableAutoHtml5ify, setEnableAutoHtml5ify] = useState(safeGetConfig('enableAutoHtml5ify'));
  useEffect(() => safeSetConfig('enableAutoHtml5ify', enableAutoHtml5ify), [enableAutoHtml5ify]);
  const [segmentsToChaptersOnly, setSegmentsToChaptersOnly] = useState(safeGetConfig('segmentsToChaptersOnly'));
  useEffect(() => safeSetConfig('segmentsToChaptersOnly', segmentsToChaptersOnly), [segmentsToChaptersOnly]);
  const [keyBindings, setKeyBindings] = useState(safeGetConfig('keyBindings'));
  useEffect(() => safeSetConfig('keyBindings', keyBindings), [keyBindings]);
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
  };
};
