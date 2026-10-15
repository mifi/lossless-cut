import { access, constants } from 'node:fs/promises';
import os from 'node:os';
import { isAbsolute, resolve } from 'node:path';

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
