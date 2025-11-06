export type KeyboardAction = 'addSegment' | 'togglePlayResetSpeed' | 'togglePlayNoResetSpeed' | 'reducePlaybackRate' | 'reducePlaybackRateMore' | 'increasePlaybackRate' | 'increasePlaybackRateMore' | 'timelineToggleComfortZoom' | 'seekPreviousFrame' | 'seekNextFrame' | 'captureSnapshot' | 'setCutStart' | 'setCutEnd' | 'removeCurrentSegment' | 'removeCurrentCutpoint' | 'cleanupFilesDialog' | 'splitCurrentSegment' | 'focusSegmentAtCursor' | 'selectSegmentsAtCursor' | 'increaseRotation' | 'goToTimecode' | 'seekBackwards' | 'seekBackwards2' | 'seekBackwards3' | 'seekBackwardsPercent' | 'seekBackwardsPercent' | 'seekBackwardsKeyframe' | 'jumpCutStart' | 'seekForwards' | 'seekForwards2' | 'seekForwards3' | 'seekForwardsPercent' | 'seekForwardsPercent' | 'seekForwardsKeyframe' | 'jumpCutEnd' | 'jumpTimelineStart' | 'jumpTimelineEnd' | 'jumpFirstSegment' | 'jumpPrevSegment' | 'jumpSeekFirstSegment' | 'jumpSeekPrevSegment' | 'timelineZoomIn' | 'timelineZoomIn' | 'batchPreviousFile' | 'jumpLastSegment' | 'jumpNextSegment' | 'jumpSeekLastSegment' | 'jumpSeekNextSegment' | 'timelineZoomOut' | 'timelineZoomOut' | 'batchNextFile' | 'batchOpenSelectedFile' | 'batchOpenPreviousFile' | 'batchOpenNextFile' | 'undo' | 'undo' | 'redo' | 'redo' | 'copySegmentsToClipboard' | 'copySegmentsToClipboard' | 'toggleFullscreenVideo' | 'labelCurrentSegment' | 'export' | 'toggleKeyboardShortcuts' | 'closeActiveScreen' | 'increaseVolume' | 'decreaseVolume' | 'toggleMuted' | 'detectBlackScenes' | 'detectSilentScenes' | 'detectSceneChanges' | 'toggleLastCommands' | 'play' | 'pause' | 'reloadFile' | 'html5ify' | 'makeCursorTimeZero' | 'togglePlayOnlyCurrentSegment' | 'toggleLoopOnlyCurrentSegment' | 'toggleLoopStartEndOnlyCurrentSegment' | 'togglePlaySelectedSegments' | 'toggleLoopSelectedSegments' | 'editCurrentSegmentTags' | 'duplicateCurrentSegment' | 'reorderSegsByStartTime' | 'invertAllSegments' | 'fillSegmentsGaps' | 'shiftAllSegmentTimes' | 'alignSegmentTimesToKeyframes' | 'readAllKeyframes' | 'createSegmentsFromKeyframes' | 'createFixedDurationSegments' | 'createNumSegments' | 'createFixedByteSizedSegments' | 'createRandomSegments' | 'shuffleSegments' | 'combineOverlappingSegments' | 'combineSelectedSegments' | 'clearSegments' | 'toggleSegmentsList' | 'selectOnlyCurrentSegment' | 'deselectAllSegments' | 'selectAllSegments' | 'toggleCurrentSegmentSelected' | 'invertSelectedSegments' | 'removeSelectedSegments' | 'toggleStreamsSelector' | 'extractAllStreams' | 'showStreamsSelector' | 'showIncludeExternalStreamsDialog' | 'captureSnapshotAsCoverArt' | 'extractCurrentSegmentFramesAsImages' | 'extractSelectedSegmentsFramesAsImages' | 'convertFormatBatch' | 'convertFormatCurrentFile' | 'fixInvalidDuration' | 'closeBatch' | 'concatBatch' | 'toggleKeyframeCutMode' | 'toggleCaptureFormat' | 'toggleStripAudio' | 'toggleStripVideo' | 'toggleStripSubtitle' | 'toggleStripThumbnail' | 'toggleStripCurrentFilter' | 'toggleStripAll' | 'toggleDarkMode' | 'setStartTimeOffset' | 'toggleWaveformMode' | 'toggleShowThumbnails' | 'toggleShowKeyframes' | 'toggleSettings' | 'openSendReportDialog' | 'openFilesDialog' | 'openDirDialog' | 'exportYouTube' | 'closeCurrentFile' | 'quit' | 'selectAllMarkers';

export interface KeyBinding {
  keys: string,
  action: KeyboardAction,
}

export type CaptureFormat = 'jpeg' | 'png' | 'webp';

// https://www.electronjs.org/docs/api/locales
// See i18n.js
export const langNames = {
  en: 'English',
  cs: 'Čeština',
  de: 'Deutsch',
  es: 'Español',
  fr: 'Français',
  it: 'Italiano',
  nl: 'Nederlands',
  nb: 'Norsk (bokmål)',
  nn: 'Norsk (nynorsk)',
  pl: 'Polski',
  pt: 'Português',
  pt_BR: 'Português do Brasil',
  sl: 'Slovenščina',
  sk: 'slovenčina',
  fi: 'Suomi',
  ru: 'Русский',
  uk: 'українська',
  // sr: 'Cрпски',
  tr: 'Türkçe',
  vi: 'Tiếng Việt',
  ja: '日本語',
  zh: '中文',
  zh_Hant: '繁體中文',
  zh_Hans: '简体中文',
  ko: '한국어',
};

export type LanguageKey = keyof typeof langNames;

export type TimecodeFormat = 'timecodeWithDecimalFraction' | 'frameCount' | 'seconds' | 'timecodeWithFramesFraction';

export type AvoidNegativeTs = 'make_zero' | 'auto' | 'make_non_negative' | 'disabled';

export type ModifierKey = 'ctrl' | 'shift' | 'alt' | 'meta';

export type PreserveMetadata = 'default' | 'nonglobal' | 'none'

export type WaveformMode = 'big-waveform' | 'waveform';


export interface Config {
  version: number,
  captureFormat: CaptureFormat,
  customOutDir: string | undefined,
  keyframeCut: boolean,
  autoMerge: boolean,
  autoDeleteMergedSegments: boolean,
  segmentsToChaptersOnly: boolean,
  enableSmartCut: boolean,
  timecodeFormat: TimecodeFormat,
  invertCutSegments: boolean,
  autoExportExtraStreams: boolean,
  exportConfirmEnabled: boolean,
  askBeforeClose: boolean,
  enableAskForImportChapters: boolean,
  enableAskForFileOpenAction: boolean,
  playbackVolume: number,
  autoSaveProjectFile: boolean,
  wheelSensitivity: number,
  waveformHeight: number,
  language: LanguageKey | undefined,
  ffmpegExperimental: boolean,
  preserveChapters: boolean,
  preserveMetadata: PreserveMetadata,
  preserveMetadataOnMerge: boolean,
  preserveMovData: boolean,
  movFastStart: boolean,
  avoidNegativeTs: AvoidNegativeTs,
  hideNotifications: 'all' | undefined,
  hideOsNotifications: 'all' | undefined,
  autoLoadTimecode: boolean,
  segmentsToChapters: boolean,
  simpleMode: boolean,
  /** todo: rename to cutFileTemplate */
  outSegTemplate: string | undefined
  /** todo: rename to cutMergedFileTemplate */
  mergedFileTemplate: string | undefined,
  /** todo: rename to mergedFileTemplate */
  mergedFilesTemplate: string | undefined,
  keyboardSeekAccFactor: number,
  keyboardNormalSeekSpeed: number,
  keyboardSeekSpeed2: number,
  keyboardSeekSpeed3: number,
  treatInputFileModifiedTimeAsStart: boolean,
  treatOutputFileModifiedTimeAsStart: boolean | undefined | null,
  outFormatLocked: string | undefined,
  safeOutputFileName: boolean,
  windowBounds: { x: number, y: number, width: number, height: number, isMaximized?: boolean } | undefined,
  storeWindowBounds: boolean,
  enableAutoHtml5ify: boolean,
  keyBindings: KeyBinding[],
  customFfPath: string | undefined,
  storeProjectInWorkingDir: boolean,
  enableOverwriteOutput: boolean,
  mouseWheelZoomModifierKey: ModifierKey,
  mouseWheelFrameSeekModifierKey: ModifierKey,
  mouseWheelKeyframeSeekModifierKey: ModifierKey,
  segmentMouseModifierKey: ModifierKey,
  captureFrameMethod: 'videotag' | 'ffmpeg',
  captureFrameQuality: number,
  captureFrameFileNameFormat: 'timestamp' | 'index',
  enableNativeHevc: boolean,
  enableUpdateCheck: boolean,
  cleanupChoices: {
    trashTmpFiles: boolean, askForCleanup: boolean, closeFile: boolean, cleanupAfterExport?: boolean | undefined,
  },
  allowMultipleInstances: boolean,
  darkMode: boolean,
  preferStrongColors: boolean,
  outputFileNameMinZeroPadding: number,
  cutFromAdjustmentFrames: number,
  cutToAdjustmentFrames: number,
  invertTimelineScroll: boolean | undefined,
  waveformMode: WaveformMode | undefined,
  thumbnailsEnabled: boolean,
  keyframesEnabled: boolean,
  reducedMotion: 'always' | 'never' | 'user',
}

export interface Waveform {
  buffer: Buffer,
}

export interface ApiActionRequest {
  id: number
  action: string
  args?: unknown[] | undefined,
}

export type Html5ifyMode = 'fastest' | 'fast-audio-remux' | 'fast-audio' | 'fast' | 'slow' | 'slow-audio' | 'slowest';

// This is the contract with the user, see https://github.com/mifi/lossless-cut/blob/master/expressions.md
export interface ScopeSegment {
  index: number,
  label: string,
  start: number,
  end?: number | undefined,
  duration: number,
  tags: Record<string, string>,
}
