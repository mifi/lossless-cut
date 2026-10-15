// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, test } from 'vitest';
import { join, resolve, sep } from 'node:path';

import { resolveCliFileArgs } from './util';

// build platform-native absolute paths so the test also passes on Windows
const cwd = resolve('/home/user/videos');

describe('resolveCliFileArgs', () => {
  test('resolves relative file args against the given cwd (#1571)', () => {
    expect(resolveCliFileArgs(['video.mp4', 'clips/a.mkv'], cwd)).toEqual([join(cwd, 'video.mp4'), join(cwd, 'clips', 'a.mkv')]);
  });

  test('leaves absolute file args untouched (no normalization, e.g. through symlinks)', () => {
    const absolute = [resolve('/media/link'), '..', 'a.mp4'].join(sep);
    expect(resolveCliFileArgs([absolute], cwd)).toEqual([absolute]);
  });
});
