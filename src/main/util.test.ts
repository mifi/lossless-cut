// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, test } from 'vitest';
import { join, resolve } from 'node:path';

import { resolveCliFileArgs } from './util';

// build platform-native absolute paths so the test also passes on Windows
const cwd = resolve('/home/user/videos');

describe('resolveCliFileArgs', () => {
  test('resolves relative file args against the given cwd (#1571)', () => {
    expect(resolveCliFileArgs(['video.mp4', 'clips/a.mkv'], cwd)).toEqual([join(cwd, 'video.mp4'), join(cwd, 'clips', 'a.mkv')]);
  });

  test('leaves absolute file args unchanged', () => {
    const absolute = resolve('/media/in/a.mp4');
    expect(resolveCliFileArgs([absolute], cwd)).toEqual([absolute]);
  });
});
