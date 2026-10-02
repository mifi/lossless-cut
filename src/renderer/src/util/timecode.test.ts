import { describe, expect, it } from 'vitest';
import {
  calculateSegmentTimecode,
  getEffectiveSourceTimecode,
  getSourceTimecode,
  getTimecodeTag,
  normalizeTimecodeStr,
  parseTimecode,
  secondsToTimecode,
} from './timecode';
import type { FFprobeStream } from '../../../common/ffprobe';

describe('timecode utilities', () => {
  it('getTimecodeTag extracts timecode case-insensitively', () => {
    expect(getTimecodeTag({ timecode: '00:01:23:00' })).toBe('00:01:23:00');
    expect(getTimecodeTag({ TIMECODE: '00:01:23:00' })).toBe('00:01:23:00');
    expect(getTimecodeTag({ other: '123' })).toBeUndefined();
    expect(getTimecodeTag(undefined)).toBeUndefined();
  });

  it('normalizeTimecodeStr normalizes various timecode representations', () => {
    expect(normalizeTimecodeStr('00:01:23:00')).toBe('00:01:23:00');
    expect(normalizeTimecodeStr('0:01:23')).toBe('00:01:23:00');
    expect(normalizeTimecodeStr('00:01:23;00')).toBe('00:01:23;00');
    expect(normalizeTimecodeStr('1:23')).toBe('00:01:23:00');
    expect(normalizeTimecodeStr('invalid')).toBeUndefined();
  });

  it('parseTimecode converts timecode to seconds', () => {
    expect(parseTimecode('00:01:23:00', 25)).toBe(83);
    expect(parseTimecode('0:01:23', 25)).toBe(83);
    expect(parseTimecode('01:00:00:00', 25)).toBe(3600);
  });

  it('secondsToTimecode converts seconds to SMPTE timecode', () => {
    expect(secondsToTimecode(83, 25)).toBe('00:01:23:00');
    expect(secondsToTimecode(3600, 25)).toBe('01:00:00:00');
  });

  it('calculateSegmentTimecode advances timecode according to cut point (user scenario)', () => {
    // Starting at 00:01:23:00, cut 5 minutes (300s) off -> 00:06:23:00
    const result = calculateSegmentTimecode({
      initialTimecodeStr: '0:01:23',
      cutFrom: 300,
      fps: 25,
    });
    expect(result).toBe('00:06:23:00');

    // Starting at 00:01:23:00, cut 1 minute (60s) off -> 00:02:23:00
    const seg1 = calculateSegmentTimecode({
      initialTimecodeStr: '00:01:23:00',
      cutFrom: 60,
      fps: 25,
    });
    expect(seg1).toBe('00:02:23:00');

    // Starting at 00:01:23:00, cut 5 minutes (300s) off -> 00:06:23:00
    const seg2 = calculateSegmentTimecode({
      initialTimecodeStr: '00:01:23:00',
      cutFrom: 300,
      fps: 25,
    });
    expect(seg2).toBe('00:06:23:00');

    // Starting at 00:01:23:00, cut 10 minutes (600s) off -> 00:11:23:00
    const seg3 = calculateSegmentTimecode({
      initialTimecodeStr: '00:01:23:00',
      cutFrom: 600,
      fps: 25,
    });
    expect(seg3).toBe('00:11:23:00');
  });

  it('calculateSegmentTimecode handles drop-frame timecode', () => {
    const result = calculateSegmentTimecode({
      initialTimecodeStr: '00:01:23;00',
      cutFrom: 300,
      fps: 29.97,
    });
    expect(result).toBe('00:06:23;01');
  });

  it('calculateSegmentTimecode handles fractional frame rates (23.976 / 29.97)', () => {
    // smpte-timecode snaps 23.976 to 23.98, so adding 600s drifts slightly by design
    expect(calculateSegmentTimecode({ initialTimecodeStr: '01:00:00:00', cutFrom: 600, fps: 23.976 })).toBe('01:09:59:12');
    expect(secondsToTimecode(600, 23.976)).toBe('00:09:59:10');
    expect(secondsToTimecode(600, 29.97)).toBe('00:09:59:12');
  });

  it('getEffectiveSourceTimecode handles detected timecode and custom start offsets', () => {
    expect(getEffectiveSourceTimecode({ startTimeOffset: 0 })).toBeUndefined();

    // No detected timecode: the offset itself is the source start timecode
    expect(getEffectiveSourceTimecode({ startTimeOffset: 83, detectedFps: 25 })).toBe('00:01:23:00');

    // Detected timecode with no offset is used as-is
    expect(getEffectiveSourceTimecode({ fileTimecode: '01:00:00:00', startTimeOffset: 0, detectedFps: 25 })).toBe('01:00:00:00');

    // Auto-loaded offset (equal to the file timecode) must not be added on top of the detected timecode
    expect(getEffectiveSourceTimecode({ fileTimecode: '01:00:00:00', startTimeOffset: 3600, detectedFps: 25 })).toBe('01:00:00:00');

    // A manual start offset that differs from the file timecode replaces the source start timecode
    expect(getEffectiveSourceTimecode({ fileTimecode: '01:00:00:00', startTimeOffset: 3723, detectedFps: 25 })).toBe('01:02:03:00');

    // Negative offsets (preview-only, e.g. "make cursor time zero") are ignored
    expect(getEffectiveSourceTimecode({ fileTimecode: '01:00:00:00', startTimeOffset: -5, detectedFps: 25 })).toBe('01:00:00:00');
    expect(getEffectiveSourceTimecode({ startTimeOffset: -5, detectedFps: 25 })).toBeUndefined();
  });

  it('getSourceTimecode extracts timecode from streams and format tags', () => {
    const stream = {
      index: 0,
      codec_type: 'video',
      tags: { timecode: '00:01:23:00' },
    } as unknown as FFprobeStream;

    const fromStream = getSourceTimecode({
      streams: [stream],
      detectedFps: 25,
    });
    expect(fromStream).toEqual({
      timecodeStr: '00:01:23:00',
      seconds: 83,
      fps: 25,
      isDropFrame: false,
    });

    const fromFormat = getSourceTimecode({
      formatTags: { TIMECODE: '01:00:00:00' },
      detectedFps: 25,
    });
    expect(fromFormat).toEqual({
      timecodeStr: '01:00:00:00',
      seconds: 3600,
      fps: 25,
      isDropFrame: false,
    });
  });
});
