// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, test } from 'vitest';

import { getFixChannelLayoutFilter, hasCustomChannelLayout } from './util.js';

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
