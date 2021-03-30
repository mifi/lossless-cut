import csvStringify from 'csv-stringify';
import pify from 'pify';

import { parseCuesheet, parseXmeml, parseCsv, parsePbf, parseMplayerEdl } from './edlFormats';
import { formatDuration } from './util/duration';

const csvStringifyAsync = pify(csvStringify);

export async function loadCsv(path) {
  return parseCsv(await window.fs.readFile(path, 'utf-8'));
}

export async function loadXmeml(path) {
  return parseXmeml(await window.fs.readFile(path, 'utf-8'));
}

export async function loadPbf(path) {
  return parsePbf(await window.fs.readFile(path, 'utf-8'));
}

export async function loadMplayerEdl(path) {
  return parseMplayerEdl(await window.fs.readFile(path, 'utf-8'));
}

export async function loadCue(path) {
  return parseCuesheet(window.util.parseCueFile(path));
}

export async function saveCsv(path, cutSegments) {
  const rows = cutSegments.map(({ start, end, name }) => [start, end, name]);
  const str = await csvStringifyAsync(rows);
  await window.fs.writeFile(path, str);
}

const formatDurationStr = (duration) => (duration != null ? formatDuration({ seconds: duration }) : '');

const mapSegments = (segments) => segments.map(({ start, end, name }) => [formatDurationStr(start), formatDurationStr(end), name]);

export async function saveCsvHuman(path, cutSegments) {
  const str = await csvStringifyAsync(mapSegments(cutSegments));
  await window.fs.writeFile(path, str);
}

export async function saveTsv(path, cutSegments) {
  const str = await csvStringifyAsync(mapSegments(cutSegments), { delimiter: '\t' });
  await window.fs.writeFile(path, str);
}
