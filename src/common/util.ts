import type { FfmpegHwAccel } from './types.ts';

export const parseFfprobeDuration = (durationStr: string | undefined) => (
  durationStr != null ? parseFloat(durationStr) : undefined
);

export const getHwaccelArgs = (hwaccel: FfmpegHwAccel) => (hwaccel !== 'none' ? ['-hwaccel', hwaccel] : []);

// Used to be 5, but we recently increased to 6 because https://github.com/mifi/lossless-cut/issues/2838
// I don't remember why 5 was chosen initially, but if we don't truncate, ffmpeg can sometimes give an error when too many decimal places are used in the time argument, see:
export const formatFfmpegTime = (time: number) => time.toFixed(6);
