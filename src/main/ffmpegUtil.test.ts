// eslint-disable-next-line import-js/no-extraneous-dependencies
import { describe, expect, test } from 'vitest';
import { createSceneChangeSegmenter, getFfmpegJpegQuality, parseBlackDetectLine, parseSilenceDetectLine } from './ffmpegUtil.ts';

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
  test('macOS and Linux', () => {
    expect(parseBlackDetectLine('[Parsed_blackdetect_0 @ 0x5581e0c2e540] black_start:3.5 black_end:5 black_duration:1.5')).toStrictEqual({ start: 3.5, end: 5 });
  });
  test('Windows (no 0x)', () => {
    expect(parseBlackDetectLine('[Parsed_blackdetect_0 @ 00000244af592040] black_start:0 black_end:2.04 black_duration:2.04')).toStrictEqual({ start: 0, end: 2.04 });
  });
  test('other lines', () => {
    expect(parseBlackDetectLine('[Parsed_blackdetect_0 @ 0x5581e0c2e540] something else')).toBeUndefined();
    expect(parseBlackDetectLine('frame=  100 fps=0.0 q=-0.0 size=N/A time=00:00:04.00')).toBeUndefined();
  });
});

describe('parseSilenceDetectLine', () => {
  test('macOS and Linux', () => {
    expect(parseSilenceDetectLine('[Parsed_silencedetect_0 @ 0x5581e0c2e540] silence_end: 10 | silence_duration: 2.5')).toStrictEqual({ start: 7.5, end: 10 });
  });
  test('Windows (no 0x)', () => {
    expect(parseSilenceDetectLine('[Parsed_silencedetect_0 @ 00000244af592040] silence_end: 3.5 | silence_duration: 1.5')).toStrictEqual({ start: 2, end: 3.5 });
    expect(parseSilenceDetectLine('[Parsed_silencedetect_0 @ 00000244AF592040] silence_end: 3.5 | silence_duration: 1.5')).toStrictEqual({ start: 2, end: 3.5 });
  });
  test('slightly negative start is clamped to 0', () => {
    expect(parseSilenceDetectLine('[Parsed_silencedetect_1 @ 0x5581e0c2e540] silence_end: 1.522268 | silence_duration: 1.522426')).toStrictEqual({ start: 0, end: 1.522268 });
  });
  test('silence_start line is ignored', () => {
    expect(parseSilenceDetectLine('[Parsed_silencedetect_0 @ 0x5581e0c2e540] silence_start: 7.5')).toBeUndefined();
  });
});

describe('createSceneChangeSegmenter', () => {
  function getSegments(range: { from: number, to: number }, times: number[]) {
    const segmenter = createSceneChangeSegmenter(range);
    const segments = times.flatMap((time) => segmenter.addSceneChange(time) ?? []);
    const lastSegment = segmenter.finish();
    return lastSegment != null ? [...segments, lastSegment] : segments;
  }

  test('includes the start and the end', () => {
    expect(getSegments({ from: 0, to: 10 }, [2, 5])).toStrictEqual([
      { start: 0, end: 2 },
      { start: 2, end: 5 },
      { start: 5, end: 10 },
    ]);
  });

  test('times are relative to the start of the range', () => {
    expect(getSegments({ from: 10, to: 20 }, [2, 5])).toStrictEqual([
      { start: 10, end: 12 },
      { start: 12, end: 15 },
      { start: 15, end: 20 },
    ]);
  });

  test('no scene changes gives one segment for the whole range', () => {
    expect(getSegments({ from: 3, to: 8 }, [])).toStrictEqual([{ start: 3, end: 8 }]);
  });

  test('a scene change at the very start makes no zero-length segment', () => {
    expect(getSegments({ from: 0, to: 10 }, [0, 4])).toStrictEqual([
      { start: 0, end: 4 },
      { start: 4, end: 10 },
    ]);
  });

  test('a scene change at or after the very end makes no zero-length segment', () => {
    expect(getSegments({ from: 0, to: 10 }, [4, 10])).toStrictEqual([
      { start: 0, end: 4 },
      { start: 4, end: 10 },
    ]);
    expect(getSegments({ from: 5, to: 10 }, [2, 5.04])).toStrictEqual([
      { start: 5, end: 7 },
      { start: 7, end: 10 },
    ]);
  });

  test('ignores repeated, out of order and invalid times', () => {
    expect(getSegments({ from: 0, to: 10 }, [4, 4, 3, NaN, 6])).toStrictEqual([
      { start: 0, end: 4 },
      { start: 4, end: 6 },
      { start: 6, end: 10 },
    ]);
  });
});
