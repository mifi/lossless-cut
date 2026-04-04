import type { FfmpegHwAccel } from './types.ts';

export const parseFfprobeDuration = (durationStr: string | undefined) => (
  durationStr != null ? parseFloat(durationStr) : undefined
);

export const getHwaccelArgs = (hwaccel: FfmpegHwAccel) => (hwaccel !== 'none' ? ['-hwaccel', hwaccel] : []);
