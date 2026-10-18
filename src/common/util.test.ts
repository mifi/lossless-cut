// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, test } from 'vitest';

import { getFixChannelLayoutFilter, hasCustomChannelLayout, truncateFileName } from './util.js';

describe('hasCustomChannelLayout', () => {
  test('detects layouts that ffmpeg could not express natively', () => {
    // e.g. DV/DVCPRO .mov captured by Final Cut / iMovie
    expect(hasCustomChannelLayout('4 channels (UNSD+UNSD+UNSD+UNSD)')).toBe(true);
    expect(hasCustomChannelLayout('3 channels (FL+FR+UNK)')).toBe(true);
    // known positions, but not a standard speaker set (e.g. a surround stem pair)
    expect(hasCustomChannelLayout('2 channels (BL+BR)')).toBe(true);
    expect(hasCustomChannelLayout('2 channels (SL+SR)')).toBe(true);
    expect(hasCustomChannelLayout('4 channels (FL+FR+FC+BL)')).toBe(true);
  });

  test('accepts layouts that swresample supports', () => {
    expect(hasCustomChannelLayout('stereo')).toBe(false);
    expect(hasCustomChannelLayout('mono')).toBe(false);
    expect(hasCustomChannelLayout('5.1(side)')).toBe(false);
    expect(hasCustomChannelLayout('2.1')).toBe(false);
    expect(hasCustomChannelLayout('quad')).toBe(false);
    // unspecified layouts are fine, ffmpeg just uses a default downmix
    expect(hasCustomChannelLayout('4 channels')).toBe(false);
    expect(hasCustomChannelLayout(undefined)).toBe(false);
  });
});

describe('getFixChannelLayoutFilter', () => {
  test('relabels all channels of an unsupported layout', () => {
    expect(getFixChannelLayoutFilter({ channels: 4, channelLayout: '4 channels (UNSD+UNSD+UNSD+UNSD)' })).toBe('channelmap=0|1|2|3');
    expect(getFixChannelLayoutFilter({ channels: 3, channelLayout: '3 channels (FL+FR+UNK)' })).toBe('channelmap=0|1|2');
    expect(getFixChannelLayoutFilter({ channels: 2, channelLayout: '2 channels (BL+BR)' })).toBe('channelmap=0|1');
    expect(getFixChannelLayoutFilter({ channels: 1, channelLayout: '1 channels (UNSD)' })).toBe('channelmap=0');
  });

  test('leaves supported layouts alone', () => {
    expect(getFixChannelLayoutFilter({ channels: 2, channelLayout: 'stereo' })).toBeUndefined();
    expect(getFixChannelLayoutFilter({ channels: 6, channelLayout: '5.1' })).toBeUndefined();
  });

  test('needs a channel count to build the map', () => {
    expect(getFixChannelLayoutFilter({ channels: undefined, channelLayout: '4 channels (UNSD+UNSD+UNSD+UNSD)' })).toBeUndefined();
    expect(getFixChannelLayoutFilter({ channels: 0, channelLayout: '4 channels (UNSD+UNSD+UNSD+UNSD)' })).toBeUndefined();
  });
});

describe('truncateFileName', () => {
  test('keeps short names as is', () => {
    expect(truncateFileName('video.mp4', 10)).toBe('video.mp4');
  });
  test('cuts out the middle and keeps the extension', () => {
    expect(truncateFileName('abcdefghij-seg1.mp4', 14)).toBe('abc…seg1.mp4'); // 3 + 3 (…) + 4 + 4
    expect(truncateFileName('a.b.c.d.e.mkv', 12)).toBe('a.…d.e.mkv');
  });
  test('truncates names without extension', () => {
    expect(truncateFileName('abcdefghij', 7)).toBe('ab…ij');
  });
  test('ignores a dot too early in the name to be an extension', () => {
    expect(truncateFileName(`Dr. ${'a'.repeat(20)}`, 13)).toBe('Dr. a…aaaaa');
  });
  test('counts UTF-8 bytes, or UTF-16 code units, and never splits characters', () => {
    expect(truncateFileName('日本語の動画です.mp4', 16)).toBe('日…です.mp4'); // 3 bytes per character
    expect(truncateFileName('日本語の動画です.mp4', 8, true)).toBe('日…です.mp4');
    expect(truncateFileName('😀😀😀😀.mkv', 16)).toBe('😀…😀.mkv'); // 4 bytes, or 2 code units, per emoji
    expect(truncateFileName('😀😀😀😀.mkv', 10, true)).toBe('😀…😀.mkv');
  });
});
