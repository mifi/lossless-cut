// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, test } from 'vitest';
import { getFfmpegJpegQuality } from './ffmpegUtil';

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
