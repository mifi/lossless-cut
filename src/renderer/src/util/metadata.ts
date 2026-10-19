import type { FFprobeStream } from '../../../common/ffprobe';
import type { Suggestion } from '../components/SuggestionTextField';
import { isMov } from './streams';


// Common metadata keys (as named by ffmpeg) that the MP4/MOV muxer stores natively (without `-movflags use_metadata_tags`)
export const fileMetadataKeys = ['title', 'artist', 'album_artist', 'album', 'composer', 'genre', 'date', 'track', 'comment', 'description', 'copyright', 'creation_time'] as const;
export const streamMetadataKeys = ['title', 'language', 'handler_name', 'creation_time'] as const;

export const getNonNativeMovMetadataKeys = (metadata: Record<string, string> | undefined, nativeKeys: readonly string[]) => (
  Object.entries(metadata ?? {}).filter(([key, value]) => value !== '' && !nativeKeys.includes(key)).map(([key]) => key)
);

// Common codec tags (FourCC) for use with `-tag` when outputting MP4/MOV
const codecTagsByCodec: Partial<Record<FFprobeStream['codec_name'], readonly string[]>> = {
  hevc: ['hvc1', 'hev1'],
  h264: ['avc1', 'avc3'],
  av1: ['av01'],
  vp9: ['vp09'],
  mpeg4: ['mp4v'],
  aac: ['mp4a'],
  ac3: ['ac-3'],
  eac3: ['ec-3'],
  opus: ['Opus'],
  flac: ['fLaC'],
};

export const getCodecTagSuggestions = (codecName: string | undefined) => (codecName != null && codecTagsByCodec[codecName]) || [];

// ffmpeg accepts a FourCC or a numeric tag like 0x31637668
export const isValidCodecTag = (tag: string) => tag.length === 4 || /^0x[\da-f]+$/i.test(tag);

// Apple devices (QuickTime, Safari, iOS) require hvc1 for HEVC in MP4/MOV, but ffmpeg defaults to hev1 (unless the source is already hvc1)
// https://developer.apple.com/documentation/http-live-streaming/hls-authoring-specification-for-apple-devices
export const needsHvc1Tag = ({ stream, outFormat, customTag }: { stream: Pick<FFprobeStream, 'codec_name' | 'codec_tag_string'>, outFormat: string | undefined, customTag: string | undefined }) => (
  stream.codec_name === 'hevc' && isMov(outFormat) && customTag == null && stream.codec_tag_string !== 'hvc1'
);

export const isValidCreationTime = (value: string) => !Number.isNaN(Date.parse(value));

// Common ISO 639-2/B codes (as used by Matroska and ffmpeg) mapped to BCP 47, for displaying localized names
const languages: [iso6392: string, bcp47: string][] = [
  ['ara', 'ar'], ['ben', 'bn'], ['bul', 'bg'], ['chi', 'zh'], ['cze', 'cs'], ['dan', 'da'], ['dut', 'nl'], ['eng', 'en'],
  ['fil', 'fil'], ['fin', 'fi'], ['fre', 'fr'], ['ger', 'de'], ['gre', 'el'], ['heb', 'he'], ['hin', 'hi'], ['hrv', 'hr'],
  ['hun', 'hu'], ['ice', 'is'], ['ind', 'id'], ['ita', 'it'], ['jpn', 'ja'], ['kor', 'ko'], ['may', 'ms'], ['nor', 'no'],
  ['per', 'fa'], ['pol', 'pl'], ['por', 'pt'], ['rum', 'ro'], ['rus', 'ru'], ['slo', 'sk'], ['slv', 'sl'], ['spa', 'es'],
  ['srp', 'sr'], ['swe', 'sv'], ['tam', 'ta'], ['tel', 'te'], ['tha', 'th'], ['tur', 'tr'], ['ukr', 'uk'], ['urd', 'ur'],
  ['vie', 'vi'], ['und', 'und'],
];

export function getLanguageSuggestions(uiLanguage: string): Suggestion[] {
  let displayNames: Intl.DisplayNames | undefined;
  try {
    displayNames = new Intl.DisplayNames([uiLanguage, 'en'], { type: 'language' });
  } catch {
    // ignore, fall back to codes only
  }
  return languages
    .map(([value, bcp47]) => ({ value, label: `${displayNames?.of(bcp47) ?? value} (${value})` }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export const isValidLanguageCode = (code: string) => /^[a-z]{3}$/.test(code);
