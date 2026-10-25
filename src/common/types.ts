import { z } from 'zod';

import { langNames, type SupportedLanguage } from './i18n.ts';

export const keyboardActionSchema = z.enum(['addSegment', 'togglePlayResetSpeed', 'togglePlayNoResetSpeed', 'reducePlaybackRate', 'reducePlaybackRateMore', 'increasePlaybackRate', 'increasePlaybackRateMore', 'togglePlaybackRate', 'timelineToggleComfortZoom', 'seekPreviousFrame', 'seekNextFrame', 'captureSnapshot', 'captureSnapshotToClipboard', 'setCutStart', 'setCutEnd', 'removeCurrentSegment', 'removeCurrentCutpoint', 'cleanupFilesDialog', 'splitCurrentSegment', 'focusSegmentAtCursor', 'selectSegmentsAtCursor', 'increaseRotation', 'goToTimecode', 'seekBackwards', 'seekBackwards2', 'seekBackwards3', 'seekBackwardsPercent', 'seekBackwardsKeyframe', 'jumpCutStart', 'seekForwards', 'seekForwards2', 'seekForwards3', 'seekForwardsPercent', 'seekForwardsKeyframe', 'jumpCutEnd', 'jumpTimelineStart', 'jumpTimelineEnd', 'jumpFirstSegment', 'jumpPrevSegment', 'jumpSeekFirstSegment', 'jumpSeekPrevSegment', 'timelineZoomIn', 'batchPreviousFile', 'jumpLastSegment', 'jumpNextSegment', 'jumpSeekLastSegment', 'jumpSeekNextSegment', 'timelineZoomOut', 'batchNextFile', 'batchOpenSelectedFile', 'batchOpenPreviousFile', 'batchOpenNextFile', 'undo', 'redo', 'copySegmentsToClipboard', 'toggleFullscreenVideo', 'labelCurrentSegment', 'export', 'toggleKeyboardShortcuts', 'increaseVolume', 'decreaseVolume', 'toggleMuted', 'detectBlackScenes', 'detectSilentScenes', 'detectSceneChanges', 'toggleLastCommands', 'play', 'pause', 'reloadFile', 'html5ify', 'makeCursorTimeZero', 'togglePlayOnlyCurrentSegment', 'toggleLoopOnlyCurrentSegment', 'toggleLoopStartEndOnlyCurrentSegment', 'togglePlaySelectedSegments', 'toggleLoopSelectedSegments', 'editCurrentSegmentTags', 'duplicateCurrentSegment', 'reorderSegsByStartTime', 'invertAllSegments', 'fillSegmentsGaps', 'shiftAllSegmentTimes', 'alignSegmentTimesToKeyframes', 'readAllKeyframes', 'createSegmentsFromKeyframes', 'createFixedDurationSegments', 'createNumSegments', 'createFixedByteSizedSegments', 'createRandomSegments', 'shuffleSegments', 'combineOverlappingSegments', 'combineSelectedSegments', 'clearSegments', 'toggleSegmentsList', 'selectOnlyCurrentSegment', 'deselectAllSegments', 'selectAllSegments', 'toggleCurrentSegmentSelected', 'invertSelectedSegments', 'removeSelectedSegments', 'toggleStreamsSelector', 'extractAllStreams', 'showStreamsSelector', 'showIncludeExternalStreamsDialog', 'captureSnapshotAsCoverArt', 'extractCurrentSegmentFramesAsImages', 'extractSelectedSegmentsFramesAsImages', 'convertFormatBatch', 'convertFormatCurrentFile', 'fixInvalidDuration', 'decimate', 'closeBatch', 'concatBatch', 'toggleKeyframeCutMode', 'toggleCaptureFormat', 'toggleStripAudio', 'toggleStripVideo', 'toggleStripSubtitle', 'toggleStripThumbnail', 'toggleStripCurrentFilter', 'toggleStripAll', 'toggleDarkMode', 'setStartTimeOffset', 'toggleWaveformMode', 'toggleShowThumbnails', 'toggleShowKeyframes', 'toggleSettings', 'openSendReportDialog', 'openFilesDialog', 'openDirDialog', 'exportYouTube', 'closeCurrentFile', 'quit', 'selectAllMarkers', 'generateOverviewWaveform', 'selectSegmentsByLabel', 'selectSegmentsByExpr', 'labelSelectedSegments', 'mutateSegmentsByExpr']);
export type KeyboardAction = z.infer<typeof keyboardActionSchema>;

export const keyBindingSchema = z.object({
  keys: z.string(),
  action: keyboardActionSchema,
});
export type KeyBinding = z.infer<typeof keyBindingSchema>;

export const ffmpegHwAccelSchema = z.enum(['none', 'auto', 'vdpau', 'dxva2', 'd3d11va', 'vaapi', 'qsv', 'videotoolbox']);
export type FfmpegHwAccel = z.infer<typeof ffmpegHwAccelSchema>;

/**
 * The parts of an audio stream's ffprobe data needed to decide whether its channel layout
 * has to be fixed up before ffmpeg can resample or downmix it. See `getFixChannelLayoutFilter`.
 */
export interface AudioChannelInfo {
  channels?: number | undefined,
  channelLayout?: string | undefined,
}

export interface AudioStreamInfo extends AudioChannelInfo {
  index: number,
}

export const captureFormatSchema = z.enum(['jpeg', 'png', 'webp']);
export type CaptureFormat = z.infer<typeof captureFormatSchema>;

export const timecodeFormatSchema = z.enum(['timecodeWithDecimalFraction', 'frameCount', 'seconds', 'timecodeWithFramesFraction']);
export type TimecodeFormat = z.infer<typeof timecodeFormatSchema>;

export const avoidNegativeTsSchema = z.enum(['make_zero', 'auto', 'make_non_negative', 'disabled']);
export type AvoidNegativeTs = z.infer<typeof avoidNegativeTsSchema>;

export const modifierKeySchema = z.enum(['ctrl', 'shift', 'alt', 'meta']);
export type ModifierKey = z.infer<typeof modifierKeySchema>;

export const preserveMetadataSchema = z.enum(['default', 'nonglobal', 'none']);
export type PreserveMetadata = z.infer<typeof preserveMetadataSchema>;
export const waveformModeSchema = z.enum(['big-waveform', 'waveform']);
export type WaveformMode = z.infer<typeof waveformModeSchema>;

export const enableImportChaptersSchema = z.enum(['always', 'never', 'ask']);
export type EnableImportChapters = z.infer<typeof enableImportChaptersSchema>;
export const configSchema = z.object({
  version: z.number(),
  lastAppVersion: z.string(),
  captureFormat: captureFormatSchema,
  enableCustomOutDir: z.boolean(),
  recentCustomOutDirs: z.string().array(),
  keyframeCut: z.boolean(),
  autoMerge: z.boolean(),
  autoDeleteMergedSegments: z.boolean(),
  segmentsToChaptersOnly: z.boolean(),
  enableSmartCut: z.boolean(),
  timecodeFormat: timecodeFormatSchema,
  invertCutSegments: z.boolean(),
  autoExportExtraStreams: z.boolean(),
  exportConfirmEnabled: z.boolean(),
  askBeforeClose: z.boolean(),
  enableImportChapters: enableImportChaptersSchema,
  enableAskForFileOpenAction: z.boolean(),
  playbackVolume: z.number(),
  autoSaveProjectFile: z.boolean(),
  wheelSensitivity: z.number(),
  waveformHeight: z.number(),
  language: z.custom<SupportedLanguage>((v) => typeof v === 'string' && Object.hasOwn(langNames, v)).nullable(),
  ffmpegExperimental: z.boolean(),
  preserveChapters: z.boolean(),
  preserveMetadata: preserveMetadataSchema,
  preserveMetadataOnMerge: z.boolean(),
  preserveMovData: z.boolean(),
  movFastStart: z.boolean(),
  avoidNegativeTs: avoidNegativeTsSchema,
  hideNotifications: z.literal('all').or(z.undefined()),
  hideOsNotifications: z.literal('all').or(z.undefined()),
  autoLoadTimecode: z.boolean(),
  segmentsToChapters: z.boolean(),
  simpleMode: z.boolean(),
  /** todo: rename to cutFileTemplate */
  outSegTemplate: z.string().or(z.undefined()),
  /** todo: rename to cutMergedFileTemplate */
  mergedFileTemplate: z.string().or(z.undefined()),
  /** todo: rename to mergedFileTemplate */
  mergedFilesTemplate: z.string().or(z.undefined()),
  keyboardSeekAccFactor: z.number(),
  keyboardNormalSeekSpeed: z.number(),
  keyboardSeekSpeed2: z.number(),
  keyboardSeekSpeed3: z.number(),
  treatInputFileModifiedTimeAsStart: z.boolean(),
  treatOutputFileModifiedTimeAsStart: z.boolean().nullable().or(z.undefined()),
  outFormatLocked: z.string().or(z.undefined()),
  safeOutputFileName: z.boolean(),
  windowBounds: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number(), isMaximized: z.boolean().exactOptional() }).or(z.undefined()),
  storeWindowBounds: z.boolean(),
  enableAutoHtml5ify: z.boolean(),
  keyBindings: keyBindingSchema.array(),
  customFfPath: z.string().or(z.undefined()),
  storeProjectInWorkingDir: z.boolean(),
  enableOverwriteOutput: z.boolean(),
  mouseWheelZoomModifierKey: modifierKeySchema,
  mouseWheelFrameSeekModifierKey: modifierKeySchema,
  mouseWheelKeyframeSeekModifierKey: modifierKeySchema,
  segmentMouseModifierKey: modifierKeySchema,
  captureFrameMethod: z.enum(['videotag', 'ffmpeg']),
  captureFrameQuality: z.number(),
  captureFrameFileNameFormat: z.enum(['timestamp', 'index']),
  enableNativeHevc: z.boolean(),
  enableUpdateCheck: z.boolean(),
  cleanupChoices: z.object({
    trashTmpFiles: z.boolean(), askForCleanup: z.boolean(), closeFile: z.boolean(), cleanupAfterExport: z.boolean().or(z.undefined()).exactOptional(),
  }),
  allowMultipleInstances: z.boolean(),
  theme: z.enum(['dark', 'light', 'system']),
  videoFit: z.enum(['contain', 'scale-down', 'cover', 'fill', 'none']),
  preferStrongColors: z.boolean(),
  outputFileNameMinZeroPadding: z.number(),
  cutFromAdjustmentFrames: z.number(),
  cutToAdjustmentFrames: z.number(),
  invertTimelineScroll: z.boolean().or(z.undefined()),
  waveformMode: waveformModeSchema.or(z.undefined()),
  thumbnailsEnabled: z.boolean(),
  keyframesEnabled: z.boolean(),
  reducedMotion: z.enum(['always', 'never', 'user']),
  ffmpegHwaccel: ffmpegHwAccelSchema,
});
export type Config = z.infer<typeof configSchema>;

export interface ApiActionRequest {
  id: number
  action: string
  args?: unknown[] | undefined,
}

export type Html5ifyMode = 'fastest' | 'fast-audio-remux' | 'fast-audio' | 'fast' | 'slow' | 'slow-audio' | 'slowest';

export const openFilesActionArgsSchema = z.tuple([z.string().array()]);
