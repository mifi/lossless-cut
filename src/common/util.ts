import type { AudioChannelInfo, FfmpegHwAccel } from './types.ts';

export const parseFfprobeDuration = (durationStr: string | undefined) => (
  durationStr != null ? parseFloat(durationStr) : undefined
);

export const getHwaccelArgs = (hwaccel: FfmpegHwAccel) => (hwaccel !== 'none' ? ['-hwaccel', hwaccel] : []);

// Used to be 5, but we recently increased to 6 because https://github.com/mifi/lossless-cut/issues/2838
// I don't remember why 5 was chosen initially, but if we don't truncate, ffmpeg can sometimes give an error when too many decimal places are used in the time argument, see:
export const formatFfmpegNumber = (time: number) => time.toFixed(6);

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
