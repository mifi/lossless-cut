import { it, expect, describe, vi } from 'vitest';

import { getInvalidFileNameChars, getInvalidOutputPath } from './outputNameError';

describe('getInvalidOutputPath', () => {
  const stderr = String.raw`[out#0/matroska @ 0000029d042e7880] Error opening output E:\soul goodman\foo-00:10:05.605 2.mkv: Invalid argument
Error opening output file E:\soul goodman\foo-00:10:05.605 2.mkv.
Error opening output files: Invalid argument.`;

  it('extracts the offending path from ffmpeg stderr', () => {
    expect(getInvalidOutputPath(stderr)).toBe(String.raw`E:\soul goodman\foo-00:10:05.605 2.mkv`);
  });

  it('works with unix-style paths', () => {
    expect(getInvalidOutputPath('Error opening output /tmp/foo:bar?/out.mkv: Invalid argument')).toBe('/tmp/foo:bar?/out.mkv');
  });

  it('returns undefined when no output path can be found', () => {
    expect(getInvalidOutputPath('some unrelated error')).toBeUndefined();
    expect(getInvalidOutputPath(undefined)).toBeUndefined();
  });
});

describe('getInvalidFileNameChars', () => {
  it('finds invalid Windows file name characters', () => {
    expect(getInvalidFileNameChars(String.raw`E:\soul goodman\foo-00:10:05.605 2.mkv`, 'win32')).toEqual([':']);
    expect(getInvalidFileNameChars('foo?bar|baz*.mkv', 'win32')).toEqual(['?', '|', '*']);
  });

  it('returns an empty array for valid file names', () => {
    expect(getInvalidFileNameChars('valid name.mkv', 'win32')).toEqual([]);
  });

  it.each(['darwin', 'linux'] as const)('does not apply Windows restrictions on %s', (platform) => {
    expect(getInvalidFileNameChars('/tmp/valid:name?.mkv', platform)).toEqual([]);
  });

  it.each(['win32', 'darwin', 'linux'] as const)('uses the runtime platform by default (%s)', (platform) => {
    vi.stubGlobal('window', { process: { platform } });
    try {
      expect(getInvalidFileNameChars('valid:name?.mkv')).toEqual(platform === 'win32' ? [':', '?'] : []);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
