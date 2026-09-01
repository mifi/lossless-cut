// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, test } from 'vitest';

import { getFixChannelLayoutFilter, hasUnsupportedChannelLayout } from './util.js';

describe('hasUnsupportedChannelLayout', () => {
  test('detects unused/unknown channels', () => {
    // e.g. DV/DVCPRO .mov captured by Final Cut / iMovie
    expect(hasUnsupportedChannelLayout('4 channels (UNSD+UNSD+UNSD+UNSD)')).toBe(true);
    expect(hasUnsupportedChannelLayout('3 channels (FL+FR+UNK)')).toBe(true);
  });

  test('accepts layouts that swresample supports', () => {
    expect(hasUnsupportedChannelLayout('stereo')).toBe(false);
    expect(hasUnsupportedChannelLayout('mono')).toBe(false);
    expect(hasUnsupportedChannelLayout('5.1(side)')).toBe(false);
    expect(hasUnsupportedChannelLayout('2.1')).toBe(false);
    // unspecified layouts are fine, ffmpeg just uses a default downmix
    expect(hasUnsupportedChannelLayout('4 channels')).toBe(false);
    expect(hasUnsupportedChannelLayout(undefined)).toBe(false);
  });
});

describe('getFixChannelLayoutFilter', () => {
  test('relabels all channels of an unsupported layout', () => {
    expect(getFixChannelLayoutFilter({ channels: 4, channelLayout: '4 channels (UNSD+UNSD+UNSD+UNSD)' })).toBe('channelmap=0|1|2|3');
    expect(getFixChannelLayoutFilter({ channels: 3, channelLayout: '3 channels (FL+FR+UNK)' })).toBe('channelmap=0|1|2');
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
