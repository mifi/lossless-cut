import { access, constants } from 'node:fs/promises';
import os from 'node:os';
import { isAbsolute, resolve } from 'node:path';
import JSON5 from 'json5';

import { configSchema, openFilesActionArgsSchema } from '../common/types.js';

export const platform = os.platform();
export const arch = os.arch();

export const isWindows = platform === 'win32';
export const isMac = platform === 'darwin';
export const isLinux = platform === 'linux';

export async function pathExists(path: string) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// File args forwarded from a second instance are relative to *its* cwd, not ours
// https://github.com/mifi/lossless-cut/issues/1571
export const resolveCliFileArgs = (args: string[], workingDirectory: string) => args.map((arg) => (isAbsolute(arg) ? arg : resolve(workingDirectory, arg)));

// `--keyboard-action openFiles '["file.mp4"]'` takes file paths too
export function resolveCliKeyboardActionArgs(action: string, args: unknown[], workingDirectory: string) {
  if (action !== 'openFiles') return args;
  const parsed = openFilesActionArgsSchema.safeParse(args);
  if (!parsed.success) return args;
  return [resolveCliFileArgs(parsed.data[0], workingDirectory)];
}

// `--settings-json` may contain any subset of the config, but only known keys with valid values
export const parseSettingsJson = (settingsJson: string) => configSchema.partial().strict().safeParse(JSON5.parse(settingsJson));
