import type { PlatformPath } from 'node:path';

// All renderer access to node's path module goes through here,
// so that it can later be replaced (e.g. by a pure JS implementation or IPC)
const path: PlatformPath = window.require('node:path');

export const { basename, dirname, extname, isAbsolute, join, normalize, parse, resolve, sep } = path;
