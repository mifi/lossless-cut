export type KeyboardAction = 'addSegment' | 'togglePlayResetSpeed' | 'togglePlayNoResetSpeed' | 'reducePlaybackRate' | 'reducePlaybackRateMore' | 'increasePlaybackRate' | 'increasePlaybackRateMore' | 'timelineToggleComfortZoom' | 'seekPreviousFrame' | 'seekNextFrame' | 'captureSnapshot' | 'setCutStart' | 'setCutEnd' | 'removeCurrentSegment' | 'removeCurrentCutpoint' | 'cleanupFilesDialog' | 'splitCurrentSegment' | 'focusSegmentAtCursor' | 'selectSegmentsAtCursor' | 'increaseRotation' | 'goToTimecode' | 'seekBackwards' | 'seekBackwards2' | 'seekBackwards3' | 'seekBackwardsPercent' | 'seekBackwardsPercent' | 'seekBackwardsKeyframe' | 'jumpCutStart' | 'seekForwards' | 'seekForwards2' | 'seekForwards3' | 'seekForwardsPercent' | 'seekForwardsPercent' | 'seekForwardsKeyframe' | 'jumpCutEnd' | 'jumpTimelineStart' | 'jumpTimelineEnd' | 'jumpFirstSegment' | 'jumpPrevSegment' | 'jumpSeekFirstSegment' | 'jumpSeekPrevSegment' | 'timelineZoomIn' | 'timelineZoomIn' | 'batchPreviousFile' | 'jumpLastSegment' | 'jumpNextSegment' | 'jumpSeekLastSegment' | 'jumpSeekNextSegment' | 'timelineZoomOut' | 'timelineZoomOut' | 'batchNextFile' | 'batchOpenSelectedFile' | 'batchOpenPreviousFile' | 'batchOpenNextFile' | 'undo' | 'undo' | 'redo' | 'redo' | 'copySegmentsToClipboard' | 'copySegmentsToClipboard' | 'toggleFullscreenVideo' | 'labelCurrentSegment' | 'export' | 'toggleKeyboardShortcuts' | 'increaseVolume' | 'decreaseVolume' | 'toggleMuted' | 'detectBlackScenes' | 'detectSilentScenes' | 'detectSceneChanges' | 'toggleLastCommands' | 'play' | 'pause' | 'reloadFile' | 'html5ify' | 'makeCursorTimeZero' | 'togglePlayOnlyCurrentSegment' | 'toggleLoopOnlyCurrentSegment' | 'toggleLoopStartEndOnlyCurrentSegment' | 'togglePlaySelectedSegments' | 'toggleLoopSelectedSegments' | 'editCurrentSegmentTags' | 'duplicateCurrentSegment' | 'reorderSegsByStartTime' | 'invertAllSegments' | 'fillSegmentsGaps' | 'shiftAllSegmentTimes' | 'alignSegmentTimesToKeyframes' | 'readAllKeyframes' | 'createSegmentsFromKeyframes' | 'createFixedDurationSegments' | 'createNumSegments' | 'createFixedByteSizedSegments' | 'createRandomSegments' | 'shuffleSegments' | 'combineOverlappingSegments' | 'combineSelectedSegments' | 'clearSegments' | 'toggleSegmentsList' | 'selectOnlyCurrentSegment' | 'deselectAllSegments' | 'selectAllSegments' | 'toggleCurrentSegmentSelected' | 'invertSelectedSegments' | 'removeSelectedSegments' | 'toggleStreamsSelector' | 'extractAllStreams' | 'showStreamsSelector' | 'showIncludeExternalStreamsDialog' | 'captureSnapshotAsCoverArt' | 'extractCurrentSegmentFramesAsImages' | 'extractSelectedSegmentsFramesAsImages' | 'convertFormatBatch' | 'convertFormatCurrentFile' | 'fixInvalidDuration' | 'closeBatch' | 'concatBatch' | 'toggleKeyframeCutMode' | 'toggleCaptureFormat' | 'toggleStripAudio' | 'toggleStripVideo' | 'toggleStripSubtitle' | 'toggleStripThumbnail' | 'toggleStripCurrentFilter' | 'toggleStripAll' | 'toggleDarkMode' | 'setStartTimeOffset' | 'toggleWaveformMode' | 'toggleShowThumbnails' | 'toggleShowKeyframes' | 'toggleSettings' | 'openSendReportDialog' | 'openFilesDialog' | 'openDirDialog' | 'exportYouTube' | 'closeCurrentFile' | 'quit' | 'selectAllMarkers';

export interface KeyBinding {
  keys: string,
  action: KeyboardAction,
}

export type CaptureFormat = 'jpeg' | 'png' | 'webp';

// returned from app.getLocale()
// https://www.electronjs.org/docs/api/app#appgetlocale
// https://source.chromium.org/chromium/chromium/src/+/master:ui/base/l10n/l10n_util.cc
export type ElectronLanguageKey =
'af' // Afrikaans
| 'ak' // Twi
| 'am' // Amharic
| 'an' // Aragonese
| 'ar' // Arabic
| 'as' // Assamese
| 'ast' // Asturian
| 'ay' // Aymara
| 'az' // Azerbaijani
| 'be' // Belarusian
| 'bg' // Bulgarian
| 'bho' // Bhojpuri
| 'bm' // Bambara
| 'bn' // Bengali
| 'br' // Breton
| 'bs' // Bosnian
| 'ca' // Catalan
| 'ceb' // Cebuano
| 'chr' // Cherokee
| 'ckb' // Kurdish (Arabic),  Sorani
| 'co' // Corsican
| 'cs' // Czech
| 'cy' // Welsh
| 'da' // Danish
| 'de' // German
| 'de-AT' // German (Austria)
| 'de-CH' // German (Switzerland)
| 'de-DE' // German (Germany)
| 'de-LI' // German (Liechtenstein)
| 'doi' // Dogri
| 'dv' // Dhivehi
| 'ee' // Ewe
| 'el' // Greek
| 'en' // English
| 'en-AU' // English (Australia)
| 'en-CA' // English (Canada)
| 'en-GB' // English (UK)
| 'en-GB-oxendict' // English (UK, OED spelling)
| 'en-IE' // English (Ireland)
| 'en-IN' // English (India)
| 'en-NZ' // English (New Zealand)
| 'en-US' // English (US)
| 'en-ZA' // English (South Africa)
| 'eo' // Esperanto
| 'es' // Spanish
| 'es-419' // Spanish (Latin America)
| 'es-AR' // Spanish (Argentina)
| 'es-CL' // Spanish (Chile)
| 'es-CO' // Spanish (Colombia)
| 'es-CR' // Spanish (Costa Rica)
| 'es-ES' // Spanish (Spain)
| 'es-HN' // Spanish (Honduras)
| 'es-MX' // Spanish (Mexico)
| 'es-PE' // Spanish (Peru)
| 'es-US' // Spanish (US)
| 'es-UY' // Spanish (Uruguay)
| 'es-VE' // Spanish (Venezuela)
| 'et' // Estonian
| 'eu' // Basque
| 'fa' // Persian
| 'fi' // Finnish
| 'fil' // Filipino
| 'fo' // Faroese
| 'fr' // French
| 'fr-CA' // French (Canada)
| 'fr-CH' // French (Switzerland)
| 'fr-FR' // French (France)
| 'fy' // Frisian
| 'ga' // Irish
| 'gd' // Scots Gaelic
| 'gl' // Galician
| 'gn' // Guarani
| 'gu' // Gujarati
| 'ha' // Hausa
| 'haw' // Hawaiian
| 'he' // Hebrew
| 'hi' // Hindi
| 'hmn' // Hmong
| 'hr' // Croatian
| 'ht' // Haitian Creole
| 'hu' // Hungarian
| 'hy' // Armenian
| 'ia' // Interlingua
| 'id' // Indonesian
| 'ig' // Igbo
| 'ilo' // Ilocano
| 'is' // Icelandic
| 'it' // Italian
| 'it-CH' // Italian (Switzerland)
| 'it-IT' // Italian (Italy)
| 'ja' // Japanese
| 'jv' // Javanese
| 'ka' // Georgian
| 'kk' // Kazakh
| 'km' // Cambodian
| 'kn' // Kannada
| 'ko' // Korean
| 'kok' // Konkani
| 'kri' // Krio
| 'ku' // Kurdish
| 'ky' // Kyrgyz
| 'la' // Latin
| 'lb' // Luxembourgish
| 'lg' // Luganda
| 'ln' // Lingala
| 'lo' // Laothian
| 'lt' // Lithuanian
| 'lus' // Mizo
| 'lv' // Latvian
| 'mai' // Maithili
| 'mg' // Malagasy
| 'mi' // Maori
| 'mk' // Macedonian
| 'ml' // Malayalam
| 'mn' // Mongolian
| 'mni-Mtei' // Manipuri (Meitei Mayek)
| 'mo' // Moldavian
| 'mr' // Marathi
| 'ms' // Malay
| 'mt' // Maltese
| 'my' // Burmese
| 'nb' // Norwegian (Bokmal)
| 'ne' // Nepali
| 'nl' // Dutch
| 'nn' // Norwegian (Nynorsk)
| 'no' // Norwegian
| 'nso' // Sepedi
| 'ny' // Nyanja
| 'oc' // Occitan
| 'om' // Oromo
| 'or' // Odia (Oriya)
| 'pa' // Punjabi
| 'pl' // Polish
| 'ps' // Pashto
| 'pt' // Portuguese
| 'pt-BR' // Portuguese (Brazil)
| 'pt-PT' // Portuguese (Portugal)
| 'qu' // Quechua
| 'rm' // Romansh
| 'ro' // Romanian
| 'ru' // Russian
| 'rw' // Kinyarwanda
| 'sa' // Sanskrit
| 'sd' // Sindhi
| 'sh' // Serbo-Croatian
| 'si' // Sinhalese
| 'sk' // Slovak
| 'sl' // Slovenian
| 'sm' // Samoan
| 'sn' // Shona
| 'so' // Somali
| 'sq' // Albanian
| 'sr' // Serbian
| 'st' // Sesotho
| 'su' // Sundanese
| 'sv' // Swedish
| 'sw' // Swahili
| 'ta' // Tamil
| 'te' // Telugu
| 'tg' // Tajik
| 'th' // Thai
| 'ti' // Tigrinya
| 'tk' // Turkmen
| 'tn' // Tswana
| 'to' // Tonga
| 'tr' // Turkish
| 'ts' // Tsonga
| 'tt' // Tatar
| 'tw' // Twi
| 'ug' // Uyghur
| 'uk' // Ukrainian
| 'ur' // Urdu
| 'uz' // Uzbek
| 'vi' // Vietnamese
| 'wa' // Walloon
| 'wo' // Wolof
| 'xh' // Xhosa
| 'yi' // Yiddish
| 'yo' // Yoruba
| 'zh' // Chinese
| 'zh-CN' // Chinese (China)
| 'zh-HK' // Chinese (Hong Kong)
| 'zh-TW' // Chinese (Taiwan)
| 'zu' // Zulu

// https://www.electronjs.org/docs/api/app#appgetlocale
// https://source.chromium.org/chromium/chromium/src/+/master:ui/base/l10n/l10n_util.cc
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
  'pt-BR': 'Português do Brasil',
  sl: 'Slovenščina',
  sk: 'Slovenčina',
  fi: 'Suomi',
  ru: 'Русский',
  uk: 'Українська',
  // sr: 'Cрпски',
  tr: 'Türkçe',
  vi: 'Tiếng Việt',
  ja: '日本語',
  zh: '中文',
  'zh-TW': '繁體中文',
  'zh-CN': '简体中文',
  ko: '한국어',
} satisfies Partial<Record<ElectronLanguageKey, string>>;

type ExtraLanguages = 'no';

export type SupportedLanguage = (keyof typeof langNames) | ExtraLanguages;

export type TimecodeFormat = 'timecodeWithDecimalFraction' | 'frameCount' | 'seconds' | 'timecodeWithFramesFraction';

export type AvoidNegativeTs = 'make_zero' | 'auto' | 'make_non_negative' | 'disabled';

export type ModifierKey = 'ctrl' | 'shift' | 'alt' | 'meta';

export type PreserveMetadata = 'default' | 'nonglobal' | 'none'

export type WaveformMode = 'big-waveform' | 'waveform';

export type FixCodecTagOption = 'always' | 'never' | 'auto';


export interface Config {
  version: number,
  lastAppVersion: string,
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
  language: SupportedLanguage | undefined,
  ffmpegExperimental: boolean,
  preserveChapters: boolean,
  preserveMetadata: PreserveMetadata,
  preserveMetadataOnMerge: boolean,
  preserveMovData: boolean,
  fixCodecTag: FixCodecTagOption,
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
