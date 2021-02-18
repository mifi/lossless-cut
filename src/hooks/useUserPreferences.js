import { useEffect, useState, useRef } from 'react';
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

    if (isDev) console.log('save', key);
    try {
      configStore.set(key, value);
    } catch (err) {
      console.error('Failed to set config', key, err);
      errorToast(i18n.t('Unable to save your preferences. Try to disable any anti-virus'));
    }
  }

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
  const [outSegTemplate, setOutSegTemplate] = useState(configStore.get('outSegTemplate'));
  useEffect(() => safeSetConfig('outSegTemplate', outSegTemplate), [outSegTemplate]);
  const [keyboardSeekAccFactor, setKeyboardSeekAccFactor] = useState(configStore.get('keyboardSeekAccFactor'));
  useEffect(() => safeSetConfig('keyboardSeekAccFactor', keyboardSeekAccFactor), [keyboardSeekAccFactor]);
  const [keyboardNormalSeekSpeed, setKeyboardNormalSeekSpeed] = useState(configStore.get('keyboardNormalSeekSpeed'));
  useEffect(() => safeSetConfig('keyboardNormalSeekSpeed', keyboardNormalSeekSpeed), [keyboardNormalSeekSpeed]);
  const [enableTransferTimestamps, setEnableTransferTimestamps] = useState(configStore.get('enableTransferTimestamps'));
  useEffect(() => safeSetConfig('enableTransferTimestamps', enableTransferTimestamps), [enableTransferTimestamps]);


  // NOTE! This useEffect must be placed after all usages of firstUpdateRef.current (safeSetConfig)
  useEffect(() => {
    firstUpdateRef.current = false;
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
    timecodeShowFrames,
    setTimecodeShowFrames,
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
    muted,
    setMuted,
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
  };
};
