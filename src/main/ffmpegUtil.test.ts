// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, test } from 'vitest';
import { getFfmpegJpegQuality, parseBlackDetectLine, parseSilenceDetectLine } from './ffmpegUtil';

describe('getFfmpegJpegQuality', () => {
  test('quality 1 -> best (2)', () => {
    expect(getFfmpegJpegQuality(1)).toBe(2);
  });

  test('quality 0 -> worst (31)', () => {
    expect(getFfmpegJpegQuality(0)).toBe(31);
  });

  test('mid quality 0.5 -> 17', () => {
    expect(getFfmpegJpegQuality(0.5)).toBe(17);
  });

  test('values below 0 are clamped to range (->31)', () => {
    expect(getFfmpegJpegQuality(-1)).toBe(31);
  });

  test('values above 1 are clamped to range', () => {
    // 2 is returned for small >1 values that are <= the internal qMin after rounding
    expect(getFfmpegJpegQuality(100)).toBe(2);
  });
});

describe('parseBlackDetectLine', () => {
  test('ffmpeg < 8.1', () => {
    expect(parseBlackDetectLine('[blackdetect @ 0x7f8b1c004a00] black_start:0 black_end:2.04 black_duration:2.04')).toEqual({ start: 0, end: 2.04 });
  });
  test('ffmpeg >= 8.1', () => {
    expect(parseBlackDetectLine('[Parsed_blackdetect_0 @ 0x5581e0c2e540] black_start:3.5 black_end:5 black_duration:1.5')).toEqual({ start: 3.5, end: 5 });
  });
  test('other lines', () => {
    expect(parseBlackDetectLine('[Parsed_blackdetect_0 @ 0x5581e0c2e540] something else')).toBeUndefined();
    expect(parseBlackDetectLine('frame=  100 fps=0.0 q=-0.0 size=N/A time=00:00:04.00')).toBeUndefined();
  });
});

describe('parseSilenceDetectLine', () => {
  test('ffmpeg < 8.1', () => {
    expect(parseSilenceDetectLine('[silencedetect @ 0x7f8b1c004a00] silence_end: 3.5 | silence_duration: 1.5')).toEqual({ start: 2, end: 3.5 });
  });
  test('ffmpeg >= 8.1', () => {
    expect(parseSilenceDetectLine('[Parsed_silencedetect_0 @ 0x5581e0c2e540] silence_end: 10 | silence_duration: 2.5')).toEqual({ start: 7.5, end: 10 });
  });
  test('silence_start line is ignored', () => {
    expect(parseSilenceDetectLine('[Parsed_silencedetect_0 @ 0x5581e0c2e540] silence_start: 7.5')).toBeUndefined();
  });
});
