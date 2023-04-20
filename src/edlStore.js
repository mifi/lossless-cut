import JSON5 from 'json5';
import i18n from 'i18next';

import { parseCuesheet, parseXmeml, parseFcpXml, parseCsv, parsePbf, parseMplayerEdl, formatCsvHuman, formatTsv, formatCsvFrames, formatCsvSeconds, getTimeFromFrameNum } from './edlFormats';
import { askForYouTubeInput, showOpenDialog } from './dialogs';
import { getOutPath } from './util';

const fs = window.require('fs-extra');
const cueParser = window.require('cue-parser');
const { basename } = window.require('path');

const { dialog } = window.require('@electron/remote');

export async function loadCsvSeconds(path) {
  return parseCsv(await fs.readFile(path, 'utf-8'));
}

export async function loadCsvFrames(path, fps) {
  if (!fps) throw new Error('The loaded file has an unknown framerate');
  return parseCsv(await fs.readFile(path, 'utf-8'), (frameNum) => getTimeFromFrameNum(fps, frameNum));
}

export async function loadXmeml(path) {
  return parseXmeml(await fs.readFile(path, 'utf-8'));
}

export async function loadFcpXml(path) {
  return parseFcpXml(await fs.readFile(path, 'utf-8'));
}

export async function loadPbf(path) {
  return parsePbf(await fs.readFile(path));
}

export async function loadMplayerEdl(path) {
  return parseMplayerEdl(await fs.readFile(path, 'utf-8'));
}

export async function loadCue(path) {
  return parseCuesheet(cueParser.parse(path));
}

export async function saveCsv(path, cutSegments) {
  await fs.writeFile(path, await formatCsvSeconds(cutSegments));
}

export async function saveCsvHuman(path, cutSegments) {
  await fs.writeFile(path, await formatCsvHuman(cutSegments));
}

export async function saveCsvFrames({ path, cutSegments, getFrameCount }) {
  await fs.writeFile(path, await formatCsvFrames({ cutSegments, getFrameCount }));
}

export async function saveTsv(path, cutSegments) {
  await fs.writeFile(path, await formatTsv(cutSegments));
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


export async function readEdlFile({ type, path, fps }) {
  if (type === 'csv') return loadCsvSeconds(path);
  if (type === 'csv-frames') return loadCsvFrames(path, fps);
  if (type === 'xmeml') return loadXmeml(path);
  if (type === 'fcpxml') return loadFcpXml(path);
  if (type === 'cue') return loadCue(path);
  if (type === 'pbf') return loadPbf(path);
  if (type === 'mplayer') return loadMplayerEdl(path);
  if (type === 'llc') {
    const project = await loadLlcProject(path);
    return project.cutSegments;
  }
  throw new Error('Invalid EDL type');
}

export async function askForEdlImport({ type, fps }) {
  if (type === 'youtube') return askForYouTubeInput();

  let filters;
  if (type === 'csv' || type === 'csv-frames') filters = [{ name: i18n.t('CSV files'), extensions: ['csv'] }];
  else if (type === 'xmeml') filters = [{ name: i18n.t('XML files'), extensions: ['xml'] }];
  else if (type === 'fcpxml') filters = [{ name: i18n.t('FCPXML files'), extensions: ['fcpxml'] }];
  else if (type === 'cue') filters = [{ name: i18n.t('CUE files'), extensions: ['cue'] }];
  else if (type === 'pbf') filters = [{ name: i18n.t('PBF files'), extensions: ['pbf'] }];
  else if (type === 'mplayer') filters = [{ name: i18n.t('MPlayer EDL'), extensions: ['*'] }];
  else if (type === 'llc') filters = [{ name: i18n.t('LosslessCut project'), extensions: ['llc'] }];

  const { canceled, filePaths } = await showOpenDialog({ properties: ['openFile'], filters });
  if (canceled || filePaths.length < 1) return [];
  return readEdlFile({ type, path: filePaths[0], fps });
}

export async function exportEdlFile({ type, cutSegments, customOutDir, filePath, getFrameCount }) {
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
  } else if (type === 'csv-frames') {
    ext = 'csv';
    filters = [{ name: i18n.t('TXT files'), extensions: [ext, 'txt'] }];
  } else if (type === 'llc') {
    ext = 'llc';
    filters = [{ name: i18n.t('LosslessCut project'), extensions: [ext, 'llc'] }];
  }

  const defaultPath = getOutPath({ filePath, customOutDir, fileName: `${basename(filePath)}.${ext}` });

  const { canceled, filePath: savePath } = await dialog.showSaveDialog({ defaultPath, filters });
  if (canceled || !savePath) return;
  console.log('Saving', type, savePath);
  if (type === 'csv') await saveCsv(savePath, cutSegments);
  else if (type === 'tsv-human') await saveTsv(savePath, cutSegments);
  else if (type === 'csv-human') await saveCsvHuman(savePath, cutSegments);
  else if (type === 'csv-frames') await saveCsvFrames({ path: savePath, cutSegments, getFrameCount });
  else if (type === 'llc') await saveLlcProject({ savePath, filePath, cutSegments });
}
