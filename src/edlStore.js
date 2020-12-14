import csvStringify from 'csv-stringify';
import pify from 'pify';

import { parseCuesheet, parseXmeml, parseCsv, parsePbf } from './edlFormats';
import { formatDuration } from './util';

const fs = window.require('fs-extra');
const cueParser = window.require('cue-parser');

const csvStringifyAsync = pify(csvStringify);

export async function loadCsv(path) {
  return parseCsv(await fs.readFile(path, 'utf-8'));
}

export async function loadXmeml(path) {
  return parseXmeml(await fs.readFile(path, 'utf-8'));
}

export async function loadPbf(path) {
  return parsePbf(await fs.readFile(path, 'utf-8'));
}

export async function loadCue(path) {
  return parseCuesheet(cueParser.parse(path));
}

export async function saveCsv(path, cutSegments) {
  const rows = cutSegments.map(({ start, end, name }) => [start, end, name]);
  const str = await csvStringifyAsync(rows);
  await fs.writeFile(path, str);
}

export async function saveTsv(path, cutSegments) {
  // TODO escape tab, how?
  const rows = cutSegments.map(({ start, end, name }) => `${start != null ? formatDuration({ seconds: start }) : ''}\t${end != null ? formatDuration({ seconds: end }) : ''}\t${name}`);
  await fs.writeFile(path, rows.join('\n'));
}
