import { memo, useState, useCallback, useEffect, useMemo, CSSProperties, Dispatch, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { AiOutlineMergeCells } from 'react-icons/ai';
import { FaQuestionCircle, FaExclamationTriangle, FaCog } from 'react-icons/fa';
import i18n from 'i18next';
import invariant from 'tiny-invariant';

import Checkbox from './Checkbox';
import { readFileMeta, getDefaultOutFormat, mapRecommendedDefaultFormat } from '../ffmpeg';
import OutputFormatSelect from './OutputFormatSelect';
import useUserSettings from '../hooks/useUserSettings';
import { isMov } from '../util/streams';
import { getOutDir } from '../util';
import { FFprobeChapter, FFprobeFormat, FFprobeStream } from '../../../../ffprobe';
import Button, { DialogButton } from './Button';
import { defaultMergedFileTemplate, GeneratedOutFileNames, GenerateMergedOutFileNames } from '../util/outputNameTemplate';
import { primaryColor } from '../colors';
import ExportSheet from './ExportSheet';
import * as Dialog from './Dialog';
import FileNameTemplateEditor from './FileNameTemplateEditor';
import { EnsureWritableOutDir } from '../hooks/useDirectoryAccess';

const { basename } = window.require('path');


const rowStyle: CSSProperties = {
  fontSize: '1em', margin: '.3em 0', overflowY: 'auto', whiteSpace: 'nowrap',
};

function Alert({ text }: { text: string }) {
  return (
    <div style={{ marginBottom: '1em' }}><FaExclamationTriangle style={{ color: 'var(--orange-8)', fontSize: '1.3em', verticalAlign: 'middle', marginRight: '.2em' }} /> {text}</div>
  );
}

function ConcatSheet({ isShown, onHide, paths, mergedFileTemplate, generateMergedFileNames, onConcat, alwaysConcatMultipleFiles, setAlwaysConcatMultipleFiles, ensureWritableOutDir, fileFormat, setFileFormat, detectedFileFormat, setDetectedFileFormat, onOutputFormatUserChange }: {
  isShown: boolean,
  onHide: () => void,
  paths: string[],
  mergedFileTemplate: string,
  generateMergedFileNames: GenerateMergedOutFileNames,
  onConcat: (a: { paths: string[], includeAllStreams: boolean, streams: FFprobeStream[], fileFormat: string, clearBatchFilesAfterConcat: boolean, generatedFileNames: GeneratedOutFileNames }) => Promise<void>,
  alwaysConcatMultipleFiles: boolean,
  setAlwaysConcatMultipleFiles: (a: boolean) => void,
  ensureWritableOutDir: EnsureWritableOutDir,
  fileFormat: string | undefined,
  setFileFormat: Dispatch<SetStateAction<string | undefined>>,
  detectedFileFormat: string | undefined,
  setDetectedFileFormat: Dispatch<SetStateAction<string | undefined>>,
  onOutputFormatUserChange: (newFormat: string) => void,
}) {
  const { t } = useTranslation();
  const { preserveMovData, setPreserveMovData, segmentsToChapters, setSegmentsToChapters, preserveMetadataOnMerge, setPreserveMetadataOnMerge, customOutDir, simpleMode, setMergedFileTemplate, outFormatLocked } = useUserSettings();

  const [includeAllStreams, setIncludeAllStreams] = useState(false);
  const [fileMeta, setFileMeta] = useState<{ format: FFprobeFormat, streams: FFprobeStream[], chapters: FFprobeChapter[] }>();
  const [allFilesMetaCache, setAllFilesMetaCache] = useState<Record<string, {format: FFprobeFormat, streams: FFprobeStream[], chapters: FFprobeChapter[] }>>({});
  const [clearBatchFilesAfterConcat, setClearBatchFilesAfterConcat] = useState(false);
  const [enableReadFileMeta, setEnableReadFileMeta] = useState(false);
  const [uniqueSuffix, setUniqueSuffix] = useState(Date.now());

  const firstPath = useMemo(() => {
    if (paths.length === 0) return undefined;
    return paths[0];
  }, [paths]);

  useEffect(() => {
    if (!isShown) return undefined;

    let aborted = false;

    (async () => {
      setFileMeta(undefined);
      setFileFormat(undefined);
      setDetectedFileFormat(undefined);
      invariant(firstPath != null);
      const fileMetaNew = await readFileMeta(firstPath);
      const fileFormatNew = await getDefaultOutFormat({ filePath: firstPath, fileMeta: fileMetaNew });
      if (aborted) return;
      setFileMeta(fileMetaNew);
      setDetectedFileFormat(fileFormatNew);
      if (outFormatLocked) {
        setFileFormat(outFormatLocked);
      } else {
        setFileFormat(mapRecommendedDefaultFormat({ sourceFormat: fileFormatNew, streams: fileMetaNew.streams }).format);
      }
      setUniqueSuffix(Date.now());
    })().catch(console.error);

    return () => {
      aborted = true;
    };
  }, [firstPath, isShown, outFormatLocked, setDetectedFileFormat, setFileFormat]);

  const generateFileNames = useCallback(async (template: string) => {
    invariant(firstPath != null && fileFormat != null);
    const outputDir = getOutDir(customOutDir, firstPath);

    return generateMergedFileNames({ template, filePaths: paths, fileFormat, outputDir, epochMs: uniqueSuffix });
  }, [customOutDir, fileFormat, firstPath, generateMergedFileNames, paths, uniqueSuffix]);

  const allFilesMeta = useMemo(() => {
    if (paths.length === 0) return undefined;
    const filtered = paths.flatMap((path) => (allFilesMetaCache[path] ? [[path, allFilesMetaCache[path]!] as const] : []));
    return filtered.length === paths.length ? filtered : undefined;
  }, [allFilesMetaCache, paths]);

  const problemsByFile = useMemo(() => {
    if (!allFilesMeta) return {};
    const allFilesMetaExceptFirstFile = allFilesMeta.slice(1);
    const [, firstFileMeta] = allFilesMeta[0]!;
    const errors: Record<string, string[]> = {};

    function addError(path: string, error: string) {
      if (!errors[path]) errors[path] = [];
      errors[path]!.push(error);
    }

    allFilesMetaExceptFirstFile.forEach(([path, { streams }]) => {
      streams.forEach((stream, i) => {
        const referenceStream = firstFileMeta.streams[i];
        if (!referenceStream) {
          addError(path, i18n.t('Extraneous track {{index}}', { index: stream.index + 1 }));
          return;
        }
        // check all these parameters
        (['codec_name', 'width', 'height', 'pix_fmt', 'level', 'profile', 'sample_fmt', 'avg_frame_rate', 'r_frame_rate', 'time_base'] as const).forEach((key) => {
          const val = stream[key];
          const referenceVal = referenceStream[key];
          if (val !== referenceVal) {
            addError(path, i18n.t('Track {{index}} mismatch: {{key1}} {{value1}} != {{value2}}', { index: stream.index + 1, key1: key, value1: val || 'none', value2: referenceVal || 'none' }));
          }
        });
      });
    });
    return errors;
  }, [allFilesMeta]);

  useEffect(() => {
    if (!isShown || !enableReadFileMeta) return undefined;

    let aborted = false;

    (async () => {
      // eslint-disable-next-line no-restricted-syntax
      for (const path of paths) {
        if (aborted) return;
        if (!allFilesMetaCache[path]) {
          // eslint-disable-next-line no-await-in-loop
          const fileMetaNew = await readFileMeta(path);
          setAllFilesMetaCache((existing) => ({ ...existing, [path]: fileMetaNew }));
        }
      }
    })().catch(console.error);

    return () => {
      aborted = true;
    };
  }, [allFilesMetaCache, enableReadFileMeta, isShown, paths]);

  const onConcatClick = useCallback(async () => {
    invariant(fileFormat != null);
    invariant(firstPath != null);

    // need to ensure the output dir is writable, because the user might not yet have opened a file, and so MAS might not yet have access to write the dir
    const newCustomOutDir = await ensureWritableOutDir({ inputPath: firstPath, outDir: customOutDir });
    if (newCustomOutDir !== customOutDir) {
      // throw user back to dialog because now things might have changed (which could affect overwriting files etc!)
      return;
    }

    const outputDir = getOutDir(customOutDir, firstPath);

    const generatedFileNames = await generateMergedFileNames({ template: mergedFileTemplate, filePaths: paths, fileFormat, outputDir, epochMs: uniqueSuffix });

    await onConcat({ paths, includeAllStreams, streams: fileMeta!.streams, fileFormat, clearBatchFilesAfterConcat, generatedFileNames });
  }, [clearBatchFilesAfterConcat, customOutDir, ensureWritableOutDir, fileFormat, fileMeta, firstPath, generateMergedFileNames, includeAllStreams, mergedFileTemplate, onConcat, paths, uniqueSuffix]);

  return (
    <ExportSheet
      visible={isShown}
      title={t('Merge/concatenate files')}
      onClosePress={onHide}
      renderButton={() => (
        <Button className={simpleMode ? 'export-animation' : undefined} disabled={fileFormat == null} onClick={onConcatClick} style={{ fontSize: '1.3em', padding: '0 .3em', marginLeft: '1em', background: primaryColor, color: 'white', border: 'none' }}>
          <AiOutlineMergeCells style={{ fontSize: '1.4em', verticalAlign: 'middle' }} /> {t('Merge!')}
        </Button>
      )}
      width="70em"
    >
      <div style={{ marginBottom: '1em' }}>
        <div style={{ whiteSpace: 'pre-wrap', fontSize: '.9em', marginBottom: '1em' }}>
          {t('This dialog can be used to concatenate files in series, e.g. one after the other:\n[file1][file2][file3]\nIt can NOT be used for merging tracks in parallell (like adding an audio track to a video).\nMake sure all files are of the exact same codecs & codec parameters (fps, resolution etc).')}
        </div>

        <div style={{ backgroundColor: 'var(--gray-1)', borderRadius: '.1em' }}>
          {paths.map((path, index) => (
            <div key={path} style={rowStyle} title={path}>
              <div>
                <span style={{ opacity: 0.7, marginRight: '.4em' }}>{`${index + 1}.`}</span>
                <span>{basename(path)}</span>

                {!allFilesMetaCache[path] && <FaQuestionCircle style={{ color: 'var(--orange-8)', verticalAlign: 'middle', marginLeft: '1em' }} />}

                {problemsByFile[path] && (
                  <Dialog.Root>
                    <Dialog.Trigger asChild>
                      <Button title={i18n.t('Mismatches detected')} style={{ color: 'var(--orange-8)', marginLeft: '1em', padding: '.2em .4em' }}><FaExclamationTriangle /></Button>
                    </Dialog.Trigger>

                    <Dialog.Portal>
                      <Dialog.Overlay />
                      <Dialog.Content aria-describedby={undefined}>
                        <Dialog.Title>{t('Mismatches detected')}</Dialog.Title>

                        <ul style={{ margin: '10px 0', textAlign: 'left' }}>
                          {(problemsByFile[path] || []).map((problem) => <li key={problem}>{problem}</li>)}
                        </ul>

                        <Dialog.CloseButton />
                      </Dialog.Content>
                    </Dialog.Portal>
                  </Dialog.Root>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '1em' }}>
        <Checkbox style={{ marginBottom: '.7em' }} checked={enableReadFileMeta} onCheckedChange={(checked) => setEnableReadFileMeta(!!checked)} label={t('Check compatibility')} />

        <Dialog.Root>
          <Dialog.Trigger asChild>
            <Button style={{ padding: '.3em .5em', marginBottom: '.5em' }}><FaCog style={{ verticalAlign: 'top', fontSize: '1.4em', marginRight: '.2em' }} /> {t('Options')}</Button>
          </Dialog.Trigger>

          <Dialog.Portal>
            <Dialog.Overlay />
            <Dialog.Content style={{ width: '40em' }} aria-describedby={undefined}>
              <Dialog.Title>{t('Merge options')}</Dialog.Title>

              <Checkbox checked={includeAllStreams} onCheckedChange={(checked) => setIncludeAllStreams(checked === true)} label={`${t('Include all tracks?')} - ${t('If this is checked, all audio/video/subtitle/data tracks will be included. This may not always work for all file types. If not checked, only default streams will be included.')}`} />

              <Checkbox checked={preserveMetadataOnMerge} onCheckedChange={(checked) => setPreserveMetadataOnMerge(checked === true)} label={t('Preserve original metadata when merging? (slow)')} />

              {fileFormat != null && isMov(fileFormat) && <Checkbox checked={preserveMovData} onCheckedChange={(checked) => setPreserveMovData(checked === true)} label={t('Preserve all MP4/MOV metadata?')} />}

              <Checkbox checked={segmentsToChapters} onCheckedChange={(checked) => setSegmentsToChapters(checked === true)} label={t('Create chapters from merged segments? (slow)')} />

              <Checkbox checked={alwaysConcatMultipleFiles} onCheckedChange={(checked) => setAlwaysConcatMultipleFiles(checked === true)} label={t('Always open this dialog when opening multiple files')} />

              <Checkbox checked={clearBatchFilesAfterConcat} onCheckedChange={(checked) => setClearBatchFilesAfterConcat(checked === true)} label={t('Clear batch file list after merge')} />

              <p>{t('Note that also other settings from the normal export dialog apply to this merge function. For more information about all options, see the export dialog.')}</p>

              <Dialog.ButtonRow>
                <Dialog.Close asChild>
                  <DialogButton primary>{t('Done')}</DialogButton>
                </Dialog.Close>
              </Dialog.ButtonRow>

              <Dialog.CloseButton />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <div>{t('Output container format:')}</div>

        {fileFormat != null && detectedFileFormat != null && (
          <OutputFormatSelect style={{ height: '1.7em', maxWidth: '20em', marginBottom: '.7em' }} detectedFileFormat={detectedFileFormat} fileFormat={fileFormat} onOutputFormatUserChange={onOutputFormatUserChange} />
        )}

        {fileFormat != null && (
          <FileNameTemplateEditor mode="merge-files" template={mergedFileTemplate} setTemplate={setMergedFileTemplate} defaultTemplate={defaultMergedFileTemplate} generateFileNames={generateFileNames} />
        )}

        {enableReadFileMeta && (!allFilesMeta || Object.values(problemsByFile).length > 0) && (
          <Alert text={t('A mismatch was detected in at least one file. You may proceed, but the resulting file might not be playable.')} />
        )}
        {!enableReadFileMeta && (
          <Alert text={t('File compatibility check is not enabled, so the merge operation might not produce a valid output. Enable "Check compatibility" below to check file compatibility before merging.')} />
        )}
      </div>
    </ExportSheet>
  );
}

export default memo(ConcatSheet);
