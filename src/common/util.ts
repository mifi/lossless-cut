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
