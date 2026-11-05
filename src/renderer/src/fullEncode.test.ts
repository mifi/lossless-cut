import { describe, expect, it } from 'vitest';

import getFullEncodeArgs from './fullEncode';

const options: Parameters<typeof getFullEncodeArgs>[0] = {
  filePath: 'source.webm',
  outPath: 'clip.mp4',
  cutFrom: 5.808395675675675,
  cutTo: 9.219675675675676,
  streams: [{ index: 0, codec_type: 'video' }, { index: 2, codec_type: 'audio' }],
  preserveMetadata: 'default' as const,
  preserveChapters: false,
  metadata: {},
};

describe('full segment re-encoding', () => {
  it('seeks after decoding and encodes both video and audio instead of copying a GOP', () => {
    const args = getFullEncodeArgs(options);
    expect(args.indexOf('-ss')).toBeGreaterThan(args.indexOf('-i'));
    expect(args[args.indexOf('-ss') + 1]).toBe('5.808396');
    expect(args[args.indexOf('-t') + 1]).toBe('3.411280');
    expect(args).not.toContain('copy');
    expect(args[args.indexOf('-c:v') + 1]).toBe('libx264');
    expect(args[args.indexOf('-c:a') + 1]).toBe('aac');
    expect(args.slice(-4)).toEqual(['-f', 'mp4', '-y', 'clip.mp4']);
  });

  it('can encode the tail after the last keyframe without keyframe information or FPS', () => {
    const args = getFullEncodeArgs({ ...options, cutFrom: 38.65349027027027, cutTo: 42.641 });
    expect(args[args.indexOf('-t') + 1]).toBe('3.987510');
  });

  it('maps only selected AV streams, excluding cover art and unsupported track types', () => {
    const args = getFullEncodeArgs({ ...options,
      streams: [
        ...options.streams,
        { index: 3, codec_type: 'video', disposition: { attached_pic: 1 } },
        { index: 4, codec_type: 'subtitle' },
      ] });
    const mappings = args.flatMap((arg, i) => (arg === '-map' ? [args[i + 1]] : []));
    expect(mappings).toEqual(['0:0', '0:2']);
    expect(() => getFullEncodeArgs({ ...options, streams: [] })).toThrow('Select at least one');
  });

  it.each([[5, 5], [5, 4], [-1, 5], [Number.NaN, 5], [0, Infinity]])('rejects invalid cut %s to %s', (cutFrom, cutTo) => {
    expect(() => getFullEncodeArgs({ ...options, cutFrom, cutTo })).toThrow('Invalid segment times');
  });
});
