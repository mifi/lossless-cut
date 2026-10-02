import type { FRAMERATE } from 'smpte-timecode';
import Timecode from 'smpte-timecode';
import type { FFprobeStream } from '../../../common/ffprobe';

export function getTimecodeTag(tags?: Record<string, string | undefined> | undefined): string | undefined {
  if (!tags) return undefined;
  for (const [key, val] of Object.entries(tags)) {
    if (key.toLowerCase() === 'timecode' && typeof val === 'string') return val;
  }
  return undefined;
}

export function normalizeTimecodeStr(str: string): string | undefined {
  if (!str) return undefined;
  const isDropFrame = str.includes(';');
  const delim = isDropFrame ? ';' : ':';
  const parts = str.trim().split(/[:;]/);
  if (parts.length === 3) {
    parts.push('00');
  } else if (parts.length === 2) {
    parts.unshift('00');
    parts.push('00');
  }
  if (parts.length !== 4) return undefined;
  const [h, m, s, f] = parts.map((p) => p.padStart(2, '0'));
  return `${h}:${m}:${s}${delim}${f}`;
}

export function parseTimecode(str: string, frameRate?: number | undefined): number | undefined {
  const normalized = normalizeTimecodeStr(str);
  if (!normalized) return undefined;
  try {
    const isDropFrame = normalized.includes(';');
    const t = Timecode(normalized, frameRate ? (parseFloat(frameRate.toFixed(3)) as FRAMERATE) : undefined, isDropFrame);
    if (!t) return undefined;
    const seconds = ((t.hours * 60) + t.minutes) * 60 + t.seconds + (t.frames / t.frameRate);
    return Number.isFinite(seconds) ? seconds : undefined;
  } catch {
    return undefined;
  }
}

export function secondsToTimecode(seconds: number, fps = 29.97, isDropFrame = false): string {
  const roundedFps = parseFloat(fps.toFixed(3)) as FRAMERATE;
  const frameCount = Math.round(seconds * fps);
  const tc = Timecode(frameCount, roundedFps, isDropFrame);
  return tc.toString();
}

export function calculateSegmentTimecode({
  initialTimecodeStr,
  cutFrom,
  fps,
}: {
  initialTimecodeStr: string,
  cutFrom: number,
  fps?: number | undefined,
}): string | undefined {
  const normalizedStr = normalizeTimecodeStr(initialTimecodeStr);
  if (!normalizedStr) return undefined;
  try {
    const isDropFrame = normalizedStr.includes(';');
    const roundedFps = fps ? (parseFloat(fps.toFixed(3)) as FRAMERATE) : undefined;
    const tc = Timecode(normalizedStr, roundedFps, isDropFrame);
    const framesToAdd = Math.round(cutFrom * tc.frameRate);
    const updatedTc = Timecode(tc).add(framesToAdd);
    return updatedTc.toString();
  } catch {
    return undefined;
  }
}

/**
 * Determines the timecode that segment timecodes should be offset from.
 *
 * `startTimeOffset` is the timecode shown at the start of the timeline (see `displayTime = relevantTime + startTimeOffset`),
 * i.e. it is the source start timecode itself, not an amount to add on top of the file's timecode. It is loaded from
 * the file's timecode by the "auto load timecode" feature, or set manually via the custom start offset dialog.
 *
 * So we use the offset when it is set, otherwise the detected file timecode. When the offset was auto-loaded from the
 * file timecode we prefer the file timecode string directly, so that drop-frame notation and frame rounding are kept.
 * Negative offsets (preview-only, e.g. "make cursor time zero") are ignored, since a timecode cannot be negative.
 */
export function getEffectiveSourceTimecode({ fileTimecode, startTimeOffset, detectedFps }: {
  fileTimecode?: string | undefined,
  startTimeOffset: number,
  detectedFps?: number | undefined,
}): string | undefined {
  if (startTimeOffset > 0 && detectedFps) {
    // The offset may have been auto-loaded from the file timecode - don't treat it as an additional offset
    if (fileTimecode) {
      const fileTimecodeSeconds = parseTimecode(fileTimecode, detectedFps);
      if (fileTimecodeSeconds != null && Math.abs(fileTimecodeSeconds - startTimeOffset) < 1 / detectedFps) return fileTimecode;
    }
    return secondsToTimecode(startTimeOffset, detectedFps);
  }
  return fileTimecode;
}

export interface DetectedTimecode {
  timecodeStr: string;
  seconds: number;
  fps?: number | undefined;
  isDropFrame: boolean;
}

export function getSourceTimecode({
  streams,
  formatTags,
  detectedFps,
}: {
  streams?: FFprobeStream[] | undefined,
  formatTags?: Record<string, string | undefined> | undefined,
  detectedFps?: number | undefined,
}): DetectedTimecode | undefined {
  // 1. Try streams (video or tmcd streams first)
  if (streams) {
    for (const stream of streams) {
      const tag = getTimecodeTag(stream.tags);
      if (tag) {
        const streamFps = detectedFps;
        const normalized = normalizeTimecodeStr(tag);
        if (normalized) {
          const seconds = parseTimecode(normalized, streamFps);
          if (seconds != null) {
            return {
              timecodeStr: normalized,
              seconds,
              fps: streamFps,
              isDropFrame: normalized.includes(';'),
            };
          }
        }
      }
    }
  }

  // 2. Try format tags
  if (formatTags) {
    const tag = getTimecodeTag(formatTags);
    if (tag) {
      const normalized = normalizeTimecodeStr(tag);
      if (normalized) {
        const seconds = parseTimecode(normalized, detectedFps);
        if (seconds != null) {
          return {
            timecodeStr: normalized,
            seconds,
            fps: detectedFps,
            isDropFrame: normalized.includes(';'),
          };
        }
      }
    }
  }

  return undefined;
}
