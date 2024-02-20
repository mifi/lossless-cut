import JSON5 from 'json5';
import i18n from 'i18next';

import { parseSrt, formatSrt, parseCuesheet, parseXmeml, parseFcpXml, parseCsv, parsePbf, parseMplayerEdl, formatCsvHuman, formatTsv, formatCsvFrames, formatCsvSeconds, parseCsvTime, getFrameValParser, parseDvAnalyzerSummaryTxt } from './edlFormats';
import { askForYouTubeInput, showOpenDialog } from './dialogs';
import { getOutPath } from './util';
import { EdlExportType, EdlFileType, EdlImportType, Segment } from './types';

const { readFile, writeFile } = window.require('fs/promises');
const cueParser = window.require('cue-parser');
const { basename } = window.require('path');

const { dialog } = window.require('@electron/remote');

export async function loadCsvSeconds(path) {
  return parseCsv(await readFile(path, 'utf8'), parseCsvTime);
}

export async function loadCsvFrames(path, fps) {
  if (!fps) throw new Error('The loaded file has an unknown framerate');
  return parseCsv(await readFile(path, 'utf8'), getFrameValParser(fps));
}

export async function loadXmeml(path) {
  return parseXmeml(await readFile(path, 'utf8'));
}

export async function loadFcpXml(path) {
  return parseFcpXml(await readFile(path, 'utf8'));
}

export async function loadDvAnalyzerSummaryTxt(path) {
  return parseDvAnalyzerSummaryTxt(await readFile(path, 'utf8'));
}

export async function loadPbf(path) {
  return parsePbf(await readFile(path));
}

export async function loadMplayerEdl(path) {
  return parseMplayerEdl(await readFile(path, 'utf8'));
}

export async function loadCue(path) {
  return parseCuesheet(cueParser.parse(path));
}

export async function loadSrt(path) {
  return parseSrt(await readFile(path, 'utf8'));
}

export async function saveCsv(path, cutSegments) {
  await writeFile(path, await formatCsvSeconds(cutSegments));
}

export async function saveCsvHuman(path, cutSegments) {
  await writeFile(path, await formatCsvHuman(cutSegments));
}

export async function saveCsvFrames({ path, cutSegments, getFrameCount }) {
  await writeFile(path, await formatCsvFrames({ cutSegments, getFrameCount }));
}

export async function saveTsv(path, cutSegments) {
  await writeFile(path, await formatTsv(cutSegments));
}

export async function saveSrt(path, cutSegments) {
  await writeFile(path, await formatSrt(cutSegments));
}

export async function saveLlcProject({ savePath, filePath, cutSegments }) {
  const projectData = {
    version: 1,
    mediaFileName: basename(filePath),
    cutSegments: cutSegments.map(({ start, end, name, tags }) => ({ start, end, name, tags })),
  };
  await writeFile(savePath, JSON5.stringify(projectData, null, 2));
}

export async function loadLlcProject(path) {
  return JSON5.parse(await readFile(path));
}

export async function readEdlFile({ type, path, fps }: { type: EdlFileType, path: string, fps?: number }) {
  if (type === 'csv') return loadCsvSeconds(path);
  if (type === 'csv-frames') return loadCsvFrames(path, fps);
  if (type === 'xmeml') return loadXmeml(path);
  if (type === 'fcpxml') return loadFcpXml(path);
  if (type === 'dv-analyzer-summary-txt') return loadDvAnalyzerSummaryTxt(path);
  if (type === 'cue') return loadCue(path);
  if (type === 'pbf') return loadPbf(path);
  if (type === 'mplayer') return loadMplayerEdl(path);
  if (type === 'srt') return loadSrt(path);
  if (type === 'llc') {
    const project = await loadLlcProject(path);
    return project.cutSegments;
  }
  throw new Error('Invalid EDL type');
}

export async function askForEdlImport({ type, fps }: { type: EdlImportType, fps?: number }) {
  if (type === 'youtube') return askForYouTubeInput();

  let filters;
  // eslint-disable-next-line unicorn/prefer-switch
  if (type === 'csv' || type === 'csv-frames') filters = [{ name: i18n.t('CSV files'), extensions: ['csv'] }];
  else if (type === 'xmeml') filters = [{ name: i18n.t('XML files'), extensions: ['xml'] }];
  else if (type === 'fcpxml') filters = [{ name: i18n.t('FCPXML files'), extensions: ['fcpxml'] }];
  else if (type === 'cue') filters = [{ name: i18n.t('CUE files'), extensions: ['cue'] }];
  else if (type === 'pbf') filters = [{ name: i18n.t('PBF files'), extensions: ['pbf'] }];
  else if (type === 'mplayer') filters = [{ name: i18n.t('MPlayer EDL'), extensions: ['*'] }];
  else if (type === 'dv-analyzer-summary-txt') filters = [{ name: i18n.t('DV Analyzer Summary.txt'), extensions: ['txt'] }];
  else if (type === 'srt') filters = [{ name: i18n.t('Subtitles (SRT)'), extensions: ['srt'] }];
  else if (type === 'llc') filters = [{ name: i18n.t('LosslessCut project'), extensions: ['llc'] }];

  const { canceled, filePaths } = await showOpenDialog({ properties: ['openFile'], filters });
  if (canceled || filePaths.length === 0) return [];
  return readEdlFile({ type, path: filePaths[0], fps });
}

export async function exportEdlFile({ type, cutSegments, customOutDir, filePath, getFrameCount }: {
  type: EdlExportType, cutSegments: Segment, customOutDir?: string, filePath?: string, getFrameCount: (a: number) => number | undefined,
}) {
  let filters;
  let ext;
  // eslint-disable-next-line unicorn/prefer-switch
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
  } else if (type === 'srt') {
    ext = 'srt';
    filters = [{ name: i18n.t('Subtitles (SRT)'), extensions: [ext, 'txt'] }];
  } else if (type === 'llc') {
    ext = 'llc';
    filters = [{ name: i18n.t('LosslessCut project'), extensions: [ext, 'llc'] }];
  }

  const defaultPath = getOutPath({ filePath, customOutDir, fileName: `${basename(filePath)}.${ext}` });

  const { canceled, filePath: savePath } = await dialog.showSaveDialog({ defaultPath, filters });
  if (canceled || !savePath) return;
  console.log('Saving', type, savePath);
  // eslint-disable-next-line unicorn/prefer-switch
  if (type === 'csv') await saveCsv(savePath, cutSegments);
  else if (type === 'tsv-human') await saveTsv(savePath, cutSegments);
  else if (type === 'csv-human') await saveCsvHuman(savePath, cutSegments);
  else if (type === 'csv-frames') await saveCsvFrames({ path: savePath, cutSegments, getFrameCount });
  else if (type === 'llc') await saveLlcProject({ savePath, filePath, cutSegments });
  else if (type === 'srt') await saveSrt(savePath, cutSegments);
}
