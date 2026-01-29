/**
 * Convert 0-1 quality to ffmpeg jpeg quality scale
 * @param quality 0-1 where 1 is best quality
 * @returns ffmpeg jpeg quality value
 */
// eslint-disable-next-line import/prefer-default-export
export function getFfmpegJpegQuality(quality: number) {
  // Normal range for JPEG is 2-31 with 31 being the worst quality.
  const qMin = 2;
  const qMax = 31;
  const scaled = Math.round((1 - quality) * (qMax - qMin) + qMin);
  // now clamp:
  return Math.min(Math.max(qMin, scaled), qMax);
}
