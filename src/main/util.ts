import { access, constants } from 'node:fs/promises';
import os from 'node:os';
import { isAbsolute, resolve } from 'node:path';
import JSON5 from 'json5';
import { z } from 'zod';

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
const settingsJsonSchema = z.string().transform((str, ctx) => {
  try {
    return JSON5.parse(str);
  } catch (err) {
    ctx.addIssue({ code: 'custom', message: err instanceof Error ? err.message : String(err) });
    return z.NEVER;
  }
}).pipe(configSchema.partial().strict());

export const parseSettingsJson = (settingsJson: string) => settingsJsonSchema.safeParse(settingsJson);
