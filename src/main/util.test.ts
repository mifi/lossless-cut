// eslint-disable-next-line import-js/no-extraneous-dependencies
import { describe, expect, test } from 'vitest';
import { join, resolve, sep } from 'node:path';

import { parseCliKeyboardActionArgs, parseSettingsJson, resolveCliFileArgs } from './util.ts';

// build platform-native absolute paths so the test also passes on Windows
const cwd = resolve('/home/user/videos');

describe('resolveCliFileArgs', () => {
  test('resolves relative file args against the given cwd (#1571)', () => {
    expect(resolveCliFileArgs(['video.mp4', 'clips/a.mkv'], cwd)).toStrictEqual([join(cwd, 'video.mp4'), join(cwd, 'clips', 'a.mkv')]);
  });

  test('leaves absolute file args untouched (no normalization, e.g. through symlinks)', () => {
    const absolute = [resolve('/media/link'), '..', 'a.mp4'].join(sep);
    expect(resolveCliFileArgs([absolute], cwd)).toStrictEqual([absolute]);
  });
});

describe('parseCliKeyboardActionArgs', () => {
  test('resolves openFiles paths against the given cwd', () => {
    expect(parseCliKeyboardActionArgs('openFiles', ['["video.mp4"]'], cwd)).toStrictEqual([[join(cwd, 'video.mp4')]]);
  });

  test('parses JSON and JSON5, leaving other actions and malformed openFiles args untouched', () => {
    expect(parseCliKeyboardActionArgs('goToTimecodeDirect', ['{"time": "12.23"}'], cwd)).toStrictEqual([{ time: '12.23' }]);
    expect(parseCliKeyboardActionArgs('goToTimecodeDirect', ['{time: "12.23"}'], cwd)).toStrictEqual([{ time: '12.23' }]);
    expect(parseCliKeyboardActionArgs('openFiles', ['"video.mp4"'], cwd)).toStrictEqual(['video.mp4']);
  });

  test('throws on invalid JSON5', () => {
    // eslint-disable-next-line vitest/require-to-throw-message -- TODO fix (new rule in @mifi/lint-config)
    expect(() => parseCliKeyboardActionArgs('goToTimecodeDirect', ['{time:'], cwd)).toThrow();
  });
});

describe('parseSettingsJson', () => {
  test('accepts a valid subset of the config (JSON5)', () => {
    expect(parseSettingsJson('{captureFormat:"jpeg", "keyframeCut":true}')).toMatchObject({ success: true, data: { captureFormat: 'jpeg', keyframeCut: true } });
  });

  test('rejects unknown keys and invalid values', () => {
    expect(parseSettingsJson('{captureFormt:"jpeg"}').success).toBe(false);
    expect(parseSettingsJson('{captureFormat:"gif"}').success).toBe(false);
    expect(parseSettingsJson('{language:"xx"}').success).toBe(false);
  });

  test('rejects invalid JSON5 without throwing', () => {
    expect(parseSettingsJson('{captureFormat:').success).toBe(false);
  });
});
