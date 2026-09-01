import type { FfmpegHwAccel } from './types.ts';

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

// ffmpeg's swresample cannot handle channel layouts that contain unknown ("UNK") or unused ("UNSD")
// channels, which ffprobe describes like "4 channels (UNSD+UNSD+UNSD+UNSD)". Such layouts occur in
// e.g. DV/DVCPRO .mov files, whose 'chan' atom labels every channel as "unused". Any operation that
// needs to resample or downmix such a stream then fails with:
//   [SWR] Input channel layout '4 channels (UNSD+UNSD+UNSD+UNSD)' is not supported
// (swresample only accepts native or fully-specified custom layouts, see swr_init in libswresample)
export const hasUnsupportedChannelLayout = (channelLayout: string | undefined) => (
  channelLayout != null && /\b(?:UNK|UNSD)\b/.test(channelLayout)
);

// The `channelmap` filter re-labels the channels without touching the samples, which turns the
// layout into a plain "N channels" (unspecified) layout that swresample does support. The stream
// then behaves exactly as if it had carried no channel layout information at all.
export function getFixChannelLayoutFilter({ channels, channelLayout }: {
  channels?: number | undefined,
  channelLayout?: string | undefined,
}) {
  if (channels == null || channels <= 0 || !hasUnsupportedChannelLayout(channelLayout)) return undefined;
  return `channelmap=${Array.from({ length: channels }, (_, i) => i).join('|')}`;
}
