import fs from 'node:fs/promises';
import { join } from 'node:path';

export const readFixture = async (name: string, encoding: BufferEncoding = 'utf8') => fs.readFile(join(import.meta.dirname, 'fixtures', name), encoding);
export const readFixtureBinary = async (name: string) => fs.readFile(join(import.meta.dirname, 'fixtures', name), null);
