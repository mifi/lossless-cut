import fs from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// eslint-disable-next-line no-underscore-dangle
const __dirname = dirname(fileURLToPath(import.meta.url));

export const readFixture = async (name: string, encoding: BufferEncoding = 'utf8') => fs.readFile(join(__dirname, 'fixtures', name), encoding);
export const readFixtureBinary = async (name: string) => fs.readFile(join(__dirname, 'fixtures', name), null);
