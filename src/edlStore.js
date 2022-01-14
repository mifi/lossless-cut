import csvStringify from 'csv-stringify/lib/browser';
import pify from 'pify';
import JSON5 from 'json5';
import i18n from 'i18next';

import { parseCuesheet, parseXmeml, parseCsv, parsePbf, parseMplayerEdl } from './edlFormats';
import { formatDuration } from './util/duration';
import { askForYouTubeInput } from './dialogs';

const fs = window.require('fs-extra');
const cueParser = window.require('cue-parser');
const { basename } = window.require('path');

const electron = window.require('electron'); // eslint-disable-line
const { dialog } = electron.remote;

const csvStringifyAsync = pify(csvStringify);

export async function loadCsv(path) {
  return parseCsv(await fs.readFile(path, 'utf-8'));
}

export async function loadXmeml(path) {
  return parseXmeml(await fs.readFile(path, 'utf-8'));
}

export async function loadPbf(path) {
  return parsePbf(await fs.readFile(path, 'utf16le'));
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

export async function readEdlFile({ type, path }) {
  if (type === 'csv') return loadCsv(path);
  if (type === 'xmeml') return loadXmeml(path);
  if (type === 'cue') return loadCue(path);
  if (type === 'pbf') return loadPbf(path);
  if (type === 'mplayer') return loadMplayerEdl(path);
  if (type === 'llc') {
    const project = await loadLlcProject(path);
    return project.cutSegments;
  }
  throw new Error('Invalid EDL type');
}

export async function readEdl(type) {
  if (type === 'youtube') return askForYouTubeInput();

  let filters;
  if (type === 'csv') filters = [{ name: i18n.t('CSV files'), extensions: ['csv'] }];
  else if (type === 'xmeml') filters = [{ name: i18n.t('XML files'), extensions: ['xml'] }];
  else if (type === 'cue') filters = [{ name: i18n.t('CUE files'), extensions: ['cue'] }];
  else if (type === 'pbf') filters = [{ name: i18n.t('PBF files'), extensions: ['pbf'] }];
  else if (type === 'mplayer') filters = [{ name: i18n.t('MPlayer EDL'), extensions: ['*'] }];
  else if (type === 'llc') filters = [{ name: i18n.t('LosslessCut project'), extensions: ['llc'] }];

  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openFile'], filters });
  if (canceled || filePaths.length < 1) return [];
  return readEdlFile({ type, path: filePaths[0] });
}

export async function exportEdlFile({ type, cutSegments, filePath }) {
  let filters;
  let ext;
  if (type === 'csv') {
    ext = 'csv';
    filters = [{ name: i18n.t('CSV files'), extensions: [ext, 'txt'] }];
  } else if (type === 'tsv-human') {
    ext = 'tsv';
    filters = [{ name: i18n.t('TXT files'), extensions: [ext, 'txt'] }];
  } else if (type === 'csv-human') {
    ext = 'csv';
    filters = [{ name: i18n.t('TXT files'), extensions: [ext, 'txt'] }];
  } else if (type === 'llc') {
    ext = 'llc';
    filters = [{ name: i18n.t('LosslessCut project'), extensions: [ext, 'llc'] }];
  }

  const { canceled, filePath: savePath } = await dialog.showSaveDialog({ defaultPath: `${new Date().getTime()}.${ext}`, filters });
  if (canceled || !savePath) return;
  console.log('Saving', type, savePath);
  if (type === 'csv') await saveCsv(savePath, cutSegments);
  else if (type === 'tsv-human') await saveTsv(savePath, cutSegments);
  else if (type === 'csv-human') await saveCsvHuman(savePath, cutSegments);
  else if (type === 'llc') await saveLlcProject({ savePath, filePath, cutSegments });
}
