// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, test } from 'vitest';
import { parseFfmpegProgressLine } from './progress';

describe('parseFfmpegProgressLine', () => {
  test('parse video', () => {
    const str = 'frame= 2285 fps=135 q=4.0 Lsize=N/A time=00:01:31.36 bitrate=N/A speed=5.38x    ';
    expect(parseFfmpegProgressLine({ line: str, duration: 60 + 31.36 })).toBe(1);
  });
  test('parse audio 0', () => {
    const str = 'size=       0kB time=00:00:00.00 bitrate=N/A speed=N/A    ';
    expect(parseFfmpegProgressLine({ line: str, duration: 1 })).toBe(0);
  });
  test('parse audio 32.02', () => {
    const str = 'size=     501kB time=00:00:32.02 bitrate= 128.2kbits/s speed=2.29e+03x    ';
    expect(parseFfmpegProgressLine({ line: str, duration: 32.02 })).toBe(1);
  });
});
