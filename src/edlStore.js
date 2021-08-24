import csvStringify from 'csv-stringify';
import pify from 'pify';
import JSON5 from 'json5';

import { parseCuesheet, parseXmeml, parseCsv, parsePbf, parseMplayerEdl } from './edlFormats';
import { formatDuration } from './util/duration';

const fs = window.require('fs-extra');
const cueParser = window.require('cue-parser');
const { basename } = window.require('path');

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

export async function loadMplayerEdl(path) {
  return parseMplayerEdl(await fs.readFile(path, 'utf-8'));
}

export async function loadCue(path) {
  return parseCuesheet(cueParser.parse(path));
}

export async function saveCsv(path, cutSegments) {
  const rows = cutSegments.map(({ start, end, name }) => [start, end, name]);
  const str = await csvStringifyAsync(rows);
  await fs.writeFile(path, str);
}

const formatDurationStr = (duration) => (duration != null ? formatDuration({ seconds: duration }) : '');

const mapSegments = (segments) => segments.map(({ start, end, name }) => [formatDurationStr(start), formatDurationStr(end), name]);

export async function saveCsvHuman(path, cutSegments) {
  const str = await csvStringifyAsync(mapSegments(cutSegments));
  await fs.writeFile(path, str);
}

export async function saveTsv(path, cutSegments) {
  const str = await csvStringifyAsync(mapSegments(cutSegments), { delimiter: '\t' });
  await fs.writeFile(path, str);
}

export async function saveLlcProject({ savePath, filePath, cutSegments }) {
  const projectData = {
    version: 1,
    mediaFileName: basename(filePath),
    cutSegments: cutSegments.map(({ start, end, name, tags }) => ({ start, end, name, tags })),
  };
  await fs.writeFile(savePath, JSON5.stringify(projectData, null, 2));
}

export async function loadLlcProject(path) {
  return JSON5.parse(await fs.readFile(path));
}
