import { useEffect, useRef, useState } from 'react';

import type { UserSettingsRoot } from '../hooks/useUserSettingsRoot';
import useFfmpegOperations from '../hooks/useFfmpegOperations';
import { loadLlcProject } from '../edlStore';
import { getDefaultOutFormat, getStreamFps, mapRecommendedDefaultFormat, readFileFfprobeMeta } from '../ffmpeg';
import { getBatchProjectSegments } from '../batchProjects';
import { filenamify, isAbortedError } from '../util';
import { basename, dirname, join } from '../util/path';
import { getRealVideoStreams, shouldCopyStreamByDefault } from '../util/streams';
import { defaultCutFileTemplate, defaultCutMergedFileTemplate, generateCutFileNames, generateCutMergedFileNames } from '../util/outputNameTemplate';
import type { FileFfprobeMeta } from '../ffmpeg';
import type { FormatTimecode, SegmentToExport } from '../types';
import type { LossyMode } from '../../../main';
import i18n from '../i18n';

const { mkdir } = window.require('node:fs/promises');

export interface BatchExportRequest {
  paths: string[],
  shortestFlag: boolean,
  settings: UserSettingsRoot['settings'],
  outFormat: string | undefined,
  customOutDir: string | undefined,
  outputPlaybackRate: number,
  rotation: number | undefined,
  encBitrate: number | undefined,
  lossyMode: LossyMode | undefined,
  formatTimecode: FormatTimecode,
  controller: AbortController,
  prepareOutputDir: (mediaPath: string, outputDir: string) => Promise<string>,
  appendLastCommandsLog: (command: string) => void,
  appendFfmpegCommandLog: (args: string[]) => void,
}

export interface BatchProjectResult {
  projectPath: string,
  paths: string[],
  skipped?: boolean,
  error?: string,
}

export interface BatchExportReport {
  results: BatchProjectResult[],
  cancelled: boolean,
}

interface PreparedProject {
  filePath: string,
  outputDir: string,
  meta: FileFfprobeMeta,
  duration: number,
  segments: SegmentToExport[],
  format: string,
}

function ProjectWorker({ request, index, onProgress, onDone }: {
  request: BatchExportRequest,
  index: number,
  onProgress: (progress: number) => void,
  onDone: (result: BatchProjectResult) => void,
}) {
  const [prepared, setPrepared] = useState<PreparedProject>();
  const loadingStarted = useRef(false);
  const exportStarted = useRef(false);
  const projectPath = request.paths[index]!;
  const { settings } = request;
  const { signal } = request.controller;

  const operations = useFfmpegOperations({
    filePath: prepared?.filePath,
    treatInputFileModifiedTimeAsStart: settings.treatInputFileModifiedTimeAsStart,
    treatOutputFileModifiedTimeAsStart: settings.treatOutputFileModifiedTimeAsStart,
    isEncoding: settings.fullEncode || settings.enableSmartCut || request.lossyMode != null,
    fullEncode: settings.fullEncode,
    lossyMode: request.lossyMode,
    enableOverwriteOutput: settings.enableOverwriteOutput,
    outputPlaybackRate: request.outputPlaybackRate,
    cutFromAdjustmentFrames: settings.cutFromAdjustmentFrames,
    cutToAdjustmentFrames: settings.cutToAdjustmentFrames,
    appendLastCommandsLog: request.appendLastCommandsLog,
    appendFfmpegCommandLog: request.appendFfmpegCommandLog,
    encCustomBitrate: request.encBitrate,
    ffmpegHwaccel: settings.ffmpegHwaccel,
  });

  const fail = (err: unknown) => {
    console.error('Batch project export failed', projectPath, err);
    if (isAbortedError(err)) request.controller.abort();
    onDone({ projectPath, paths: [], ...(!signal.aborted ? { error: err instanceof Error ? err.message : String(err) } : {}) });
  };

  useEffect(() => {
    if (loadingStarted.current) return;
    loadingStarted.current = true;
    async function prepare() {
      signal.throwIfAborted();
      const project = await loadLlcProject(projectPath);
      if (!project.mediaFileName) throw new Error(i18n.t('Project has no media filename'));
      const filePath = join(dirname(projectPath), project.mediaFileName);
      const meta = await readFileFfprobeMeta(filePath);
      signal.throwIfAborted();
      const duration = Number(meta.format.duration);
      const segments = getBatchProjectSegments(project, duration, settings.invertCutSegments);
      if (segments.length === 0) {
        onDone({ projectPath, paths: [], skipped: true });
        return;
      }
      const detectedFormat = await getDefaultOutFormat({ filePath, fileMeta: meta });
      if (!detectedFormat) throw new Error(i18n.t('Unable to determine file format'));
      const format = settings.fullEncode ? 'mp4' : request.outFormat ?? mapRecommendedDefaultFormat({ sourceFormat: detectedFormat, streams: meta.streams }).format ?? detectedFormat;
      // The index separates identically named projects, including multiple edits
      // of one source file. The editor and its unsaved cuts are never replaced.
      const folder = `${String(index + 1).padStart(2, '0')}-${filenamify(basename(projectPath).replace(/\.llc$/i, '')).slice(0, 100)}`;
      const outputRoot = await request.prepareOutputDir(filePath, request.customOutDir ?? dirname(filePath));
      const outputDir = join(outputRoot, folder);
      signal.throwIfAborted();
      await mkdir(outputDir, { recursive: true });
      setPrepared({ filePath, outputDir, meta, duration, segments, format });
    }
    prepare().catch(fail);
  });

  useEffect(() => {
    if (!prepared || exportStarted.current) return;
    exportStarted.current = true;
    async function run(p: PreparedProject) {
      signal.throwIfAborted();
      const sourceFile = { path: p.filePath, ffprobeMeta: p.meta };
      const naming = {
        isCustomFormatSelected: true,
        fileFormat: p.format,
        sourceFile,
        outputDir: p.outputDir,
        safeOutputFileName: settings.safeOutputFileName,
        maxLabelLength: settings.safeOutputFileName ? 100 : 500,
        outputFileNameMinZeroPadding: settings.outputFileNameMinZeroPadding,
        exportCount: 0,
        currentFileExportCount: 0,
      };
      const merge = settings.autoMerge && p.segments.length > 1;
      const { fileNames } = await generateCutFileNames({
        ...naming,
        fileDuration: p.duration,
        segmentsToExport: p.segments,
        template: merge && settings.autoDeleteMergedSegments ? defaultCutFileTemplate : settings.cutFileTemplate ?? defaultCutFileTemplate,
        formatTimecode: request.formatTimecode,
      });
      signal.throwIfAborted();
      const streams = p.meta.streams.filter((stream) => shouldCopyStreamByDefault(stream));
      const video = getRealVideoStreams(streams)[0];
      const cutFiles = await operations.cutMultiple({
        outputDir: p.outputDir,
        customOutDir: p.outputDir,
        segments: p.segments,
        cutFileNames: fileNames,
        fileDuration: p.duration,
        rotation: request.rotation,
        detectedFps: video != null ? getStreamFps(video) : undefined,
        onProgress: (progress) => onProgress(progress * (merge ? 0.9 : 1)),
        keyframeCut: settings.keyframeCut,
        copyFileStreams: [{ path: p.filePath, streamIds: streams.map((s) => s.index) }],
        allFilesMeta: { [p.filePath]: p.meta },
        outFormat: p.format,
        shortestFlag: request.shortestFlag,
        ffmpegExperimental: settings.ffmpegExperimental,
        preserveMetadata: settings.preserveMetadata,
        preserveMetadataOnMerge: settings.preserveMetadataOnMerge,
        preserveMovData: settings.preserveMovData,
        preserveChapters: settings.preserveChapters,
        movFastStart: settings.movFastStart,
        avoidNegativeTs: settings.avoidNegativeTs,
        paramsByFile: new Map(),
        chapters: undefined,
      });
      signal.throwIfAborted();
      let paths = cutFiles.map((f) => f.path);
      if (merge) {
        const generated = await generateCutMergedFileNames({ ...naming, template: settings.cutMergedFileTemplate ?? defaultCutMergedFileTemplate, segLabels: p.segments.map((s) => s.name ?? '') });
        const mergedOutFilePath = join(p.outputDir, generated.fileNames[0]!);
        await operations.concatCutSegments({
          customOutDir: p.outputDir,
          outFormat: p.format,
          segmentPaths: paths,
          ffmpegExperimental: settings.ffmpegExperimental,
          onProgress: (progress) => onProgress(0.9 + 0.1 * progress),
          preserveMovData: settings.preserveMovData,
          movFastStart: settings.movFastStart,
          chapterNames: settings.segmentsToChapters && !settings.invertCutSegments ? p.segments.map((s) => s.name ?? '') : undefined,
          preserveMetadataOnMerge: settings.preserveMetadataOnMerge,
          mergedOutFilePath,
        });
        signal.throwIfAborted();
        if (settings.autoDeleteMergedSegments) await operations.tryDeleteFiles(cutFiles.filter((f) => f.created).map((f) => f.path));
        paths = settings.autoDeleteMergedSegments ? [mergedOutFilePath] : [...paths, mergedOutFilePath];
      }
      onDone({ projectPath, paths });
    }
    run(prepared).catch(fail);
  });

  return null;
}

export default function BatchProjectExport({ request, onProgress, onProject, onFinished }: {
  request: BatchExportRequest,
  onProgress: (progress: number) => void,
  onProject: (index: number, name: string) => void,
  onFinished: (report: BatchExportReport) => void,
}) {
  const [index, setIndex] = useState(0);
  const results = useRef<BatchProjectResult[]>([]);
  const completed = useRef(new Set<number>());
  useEffect(() => {
    onProject(index, basename(request.paths[index]!));
  }, [index, onProject, request.paths]);

  const onDone = (result: BatchProjectResult) => {
    if (completed.current.has(index)) return;
    completed.current.add(index);
    results.current.push(result);
    if (request.controller.signal.aborted || index + 1 >= request.paths.length) {
      onFinished({ results: results.current, cancelled: request.controller.signal.aborted });
    } else {
      onProgress((index + 1) / request.paths.length);
      setIndex(index + 1);
    }
  };

  return <ProjectWorker key={index} request={request} index={index} onProgress={(progress) => onProgress((index + progress) / request.paths.length)} onDone={onDone} />;
}
