import type { AudioChannelInfo, FfmpegHwAccel } from './types.ts';

export const parseFfprobeDuration = (durationStr: string | undefined) => (
  durationStr != null ? parseFloat(durationStr) : undefined
);

export const getHwaccelArgs = (hwaccel: FfmpegHwAccel) => (hwaccel !== 'none' ? ['-hwaccel', hwaccel] : []);

// Used to be 5, but we recently increased to 6 because https://github.com/mifi/lossless-cut/issues/2838
// I don't remember why 5 was chosen initially, but if we don't truncate, ffmpeg can sometimes give an error when too many decimal places are used in the time argument, see:
export const formatFfmpegNumber = (time: number) => time.toFixed(6);

function getCharUtf8Length(char: string) {
  const codePoint = char.codePointAt(0)!;
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
}

// File systems limit the length of file names in UTF-8 bytes (e.g. ext4, APFS) or UTF-16 code units (NTFS)
const getCharLength = (char: string, utf16: boolean) => (utf16 ? char.length : getCharUtf8Length(char));

function takeChars(chars: string[], maxLength: number, utf16: boolean) {
  const ret: string[] = [];
  let length = 0;
  for (const char of chars) {
    length += getCharLength(char, utf16);
    if (length > maxLength) break;
    ret.push(char);
  }
  return ret;
}

const ellipsis = '…';

// Truncate a file name to `maxLength`, keeping its extension (if any), and without splitting characters.
// We cut out the middle, because the end of the name often has the parts that make it unique (e.g. cut times, segment number)
export function truncateFileName(name: string, maxLength: number, utf16 = false) {
  const getLength = (str: string) => [...str].reduce((acc, char) => acc + getCharLength(char, utf16), 0);
  if (getLength(name) <= maxLength) return name;

  const extIndex = name.lastIndexOf('.');
  // only treat a short suffix as an extension, so that a dot early in the name doesn't make us exceed the limit
  const ext = extIndex > 0 && name.length - extIndex <= 10 ? name.slice(extIndex) : '';
  const stem = name.slice(0, name.length - ext.length);
  const chars = [...stem];

  const budget = maxLength - getLength(ext) - getLength(ellipsis);
  const head = takeChars(chars, Math.floor(budget / 2), utf16);
  const tail = takeChars(chars.toReversed(), budget - getLength(head.join('')), utf16).reverse();
  return head.join('') + ellipsis + tail.join('') + ext;
}

export function parseRatio(str: string, char = '/') {
  const split = str.split(char);
  if (split.length !== 2) return undefined;
  const num = parseInt(split[0]!, 10);
  const den = parseInt(split[1]!, 10);
  if (Number.isNaN(num) || Number.isNaN(den)) return undefined;
  if (den <= 0) return undefined;
  return num / den;
}

// ffmpeg's swresample only accepts channel layouts that it considers "sane" (see sane_layout() in
// libswresample/rematrix.c): a native layout, or a custom one whose channels form a standard speaker
// set. Anything else is rejected outright when the resampler initializes, so any operation that
// resamples or downmixes such a stream fails with:
//   [SWR] Input channel layout '4 channels (UNSD+UNSD+UNSD+UNSD)' is not supported
// There is no flag to relax this check.
//
// ffprobe describes a layout it could not express natively as "N channels (A+B+...)", e.g.
// "4 channels (UNSD+UNSD+UNSD+UNSD)" for DV/DVCPRO .mov files, whose 'chan' atom labels every channel
// as unused, or "2 channels (BL+BR)" for a surround stem pair. Layouts that do form a standard set are
// reported under their native name instead ("stereo", "5.1"), and those always work.
// A plain "N channels" (no positions at all) is also fine, which is what the fix below produces.
const customChannelLayoutRegex = /^\d+ channels \(/;

export const hasCustomChannelLayout = (channelLayout: string | undefined) => (
  channelLayout != null && customChannelLayoutRegex.test(channelLayout)
);

// The `channelmap` filter re-labels the channels without touching the samples, which turns the layout
// into a plain "N channels" (unspecified) layout. swresample handles those by skipping the rematrixing
// step entirely, so the stream then behaves exactly as if it had carried no channel layout information.
export function getFixChannelLayoutFilter({ channels, channelLayout }: AudioChannelInfo) {
  if (channels == null || channels <= 0 || !hasCustomChannelLayout(channelLayout)) return undefined;
  return `channelmap=${Array.from({ length: channels }, (_, i) => i).join('|')}`;
}
