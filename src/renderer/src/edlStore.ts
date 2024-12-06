import JSON5 from 'json5';
import i18n from 'i18next';
import invariant from 'tiny-invariant';

import { parseSrtToSegments, formatSrt, parseCuesheet, parseXmeml, parseFcpXml, parseCsv, parseCutlist, parsePbf, parseMplayerEdl, formatCsvHuman, formatTsv, formatCsvFrames, formatCsvSeconds, parseCsvTime, getFrameValParser, parseDvAnalyzerSummaryTxt } from './edlFormats';
import { askForYouTubeInput, showOpenDialog } from './dialogs';
import { getOutPath } from './util';
import { EdlExportType, EdlFileType, EdlImportType, Segment, StateSegment } from './types';

const { readFile, writeFile } = window.require('fs/promises');
const cueParser = window.require('cue-parser');
const { basename } = window.require('path');

const { dialog } = window.require('@electron/remote');

export async function loadCsvSeconds(path: string) {
  return parseCsv(await readFile(path, 'utf8'), parseCsvTime);
}

export async function loadCsvFrames(path: string, fps?: number) {
  if (!fps) throw new Error('The loaded file has an unknown framerate');
  return parseCsv(await readFile(path, 'utf8'), getFrameValParser(fps));
}

export async function loadCutlistSeconds(path: string) {
  return parseCutlist(await readFile(path, 'utf8'));
}

export async function loadXmeml(path: string) {
  return parseXmeml(await readFile(path, 'utf8'));
}

export async function loadFcpXml(path: string) {
  return parseFcpXml(await readFile(path, 'utf8'));
}

export async function loadDvAnalyzerSummaryTxt(path: string) {
  return parseDvAnalyzerSummaryTxt(await readFile(path, 'utf8'));
}

export async function loadPbf(path: string) {
  return parsePbf(await readFile(path));
}

export async function loadMplayerEdl(path: string) {
  return parseMplayerEdl(await readFile(path, 'utf8'));
}

export async function loadCue(path: string) {
  return parseCuesheet(cueParser.parse(path));
}

export async function loadSrt(path: string) {
  return parseSrtToSegments(await readFile(path, 'utf8'));
}

export async function saveCsv(path: string, cutSegments) {
  await writeFile(path, await formatCsvSeconds(cutSegments));
}

export async function saveCsvHuman(path: string, cutSegments) {
  await writeFile(path, await formatCsvHuman(cutSegments));
}

export async function saveCsvFrames({ path, cutSegments, getFrameCount }) {
  await writeFile(path, await formatCsvFrames({ cutSegments, getFrameCount }));
}

export async function saveTsv(path: string, cutSegments) {
  await writeFile(path, await formatTsv(cutSegments));
}

export async function saveSrt(path: string, cutSegments) {
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

export async function loadLlcProject(path: string) {
  const parsed = JSON5.parse(await readFile(path, 'utf8')) as unknown;
  if (parsed == null || typeof parsed !== 'object') throw new Error('Invalid LLC file');
  let mediaFileName: string | undefined;
  if ('mediaFileName' in parsed && typeof parsed.mediaFileName === 'string') {
    mediaFileName = parsed.mediaFileName;
  }
  if (!('cutSegments' in parsed) || !Array.isArray(parsed.cutSegments)) throw new Error('Invalid LLC file');
  return {
    mediaFileName,
    cutSegments: parsed.cutSegments as StateSegment[], // todo validate more
  };
}

export async function readEdlFile({ type, path, fps }: { type: EdlFileType, path: string, fps?: number | undefined }) {
  if (type === 'csv') return loadCsvSeconds(path);
  if (type === 'csv-frames') return loadCsvFrames(path, fps);
  if (type === 'cutlist') return loadCutlistSeconds(path);
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

export async function askForEdlImport({ type, fps }: { type: EdlImportType, fps?: number | undefined }) {
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

  const { canceled, filePaths } = await showOpenDialog({ properties: ['openFile'], filters, title: i18n.t('Import project') });
  const [firstFilePath] = filePaths;
  if (canceled || firstFilePath == null) return [];
  return readEdlFile({ type, path: firstFilePath, fps });
}

export async function exportEdlFile({ type, cutSegments, customOutDir, filePath, getFrameCount }: {
  type: EdlExportType, cutSegments: Segment[], customOutDir?: string | undefined, filePath?: string | undefined, getFrameCount: (a: number) => number | undefined,
}) {
  invariant(filePath != null);

  let filters: { name: string, extensions: string[] }[] | undefined;
  let ext: string | undefined;
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

  const { canceled, filePath: savePath } = await dialog.showSaveDialog({ defaultPath, title: i18n.t('Export project'), ...(filters != null ? { filters } : {}) });
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
