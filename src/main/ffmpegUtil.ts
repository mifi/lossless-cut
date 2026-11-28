/**
Convert 0-1 quality to ffmpeg jpeg quality scale
@param quality 0-1 where 1 is best quality
@returns ffmpeg jpeg quality value
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

// e.g. `[Parsed_blackdetect_0 @ 0x5581e0c2e540]`. On Windows, the address has no 0x: `[Parsed_blackdetect_0 @ 00000244af592040]`
const filterLogPrefix = (name: string) => `^\\[Parsed_${name}_\\d+ @ (?:0x)?[0-9a-fA-F]+\\]`;
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

/**
Turns scene changes detected in the range `from`-`to` into segments that cover the whole range:
from its start to the first change, between the changes, and from the last change to its end.
Scene change times are relative to `from`.
*/
export function createSceneChangeSegmenter({ from, to }: { from: number, to: number }) {
  let lastTime = 0;

  return {
    // returns the segment that ends at this scene change, if any
    addSceneChange(time: number) {
      // a change at the very start or end of the range (or out of order) doesn't make a new segment
      if (Number.isNaN(time) || time <= lastTime || from + time >= to) return undefined;
      const segment = { start: from + lastTime, end: from + time };
      lastTime = time;
      return segment;
    },
    // returns the segment from the last scene change to the end of the range
    finish() {
      const start = from + lastTime;
      if (start >= to) return undefined;
      return { start, end: to };
    },
  };
}
