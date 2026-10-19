/**
 * Convert 0-1 quality to ffmpeg jpeg quality scale
 * @param quality 0-1 where 1 is best quality
 * @returns ffmpeg jpeg quality value
 */
export function getFfmpegJpegQuality(quality: number) {
  // Normal range for JPEG is 2-31 with 31 being the worst quality.
  const qMin = 2;
  const qMax = 31;
  const scaled = Math.round((1 - quality) * (qMax - qMin) + qMin);
  // now clamp:
  return Math.min(Math.max(qMin, scaled), qMax);
}

function toInterval(start: number, end: number) {
  if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || end <= 0 || start >= end) return undefined;
  return { start, end };
}

// The log prefix is `[blackdetect @ 0x...]` before ffmpeg 8.1, and `[Parsed_blackdetect_0 @ 0x...]` since 8.1
const filterLogPrefix = (name: string) => `^\\[(?:Parsed_)?${name}(?:_\\d+)?\\s*@\\s*0x[0-9a-f]+\\]`;
const blackDetectRegex = new RegExp(`${filterLogPrefix('blackdetect')} black_start:([\\d.]+) black_end:([\\d.]+) black_duration:[\\d.]+`);
const silenceDetectRegex = new RegExp(`${filterLogPrefix('silencedetect')} silence_end: ([\\d.]+)[|\\s]+silence_duration: ([\\d.]+)`);

export function parseBlackDetectLine(line: string) {
  const match = line.match(blackDetectRegex);
  if (!match) return undefined;
  return toInterval(parseFloat(match[1]!), parseFloat(match[2]!));
}

export function parseSilenceDetectLine(line: string) {
  const match = line.match(silenceDetectRegex);
  if (!match) return undefined;
  const end = parseFloat(match[1]!);
  // start can be slightly negative if the audio timestamps start below 0
  return toInterval(Math.max(0, end - parseFloat(match[2]!)), end);
}
