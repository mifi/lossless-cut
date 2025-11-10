import { memo, useState, useCallback, useEffect, useMemo, CSSProperties, Dispatch, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { AiOutlineMergeCells } from 'react-icons/ai';
import { FaQuestionCircle, FaExclamationTriangle, FaCog, FaCheck } from 'react-icons/fa';
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
import { primaryColor, saveColor, warningColor } from '../colors';
import ExportSheet from './ExportSheet';
import * as Dialog from './Dialog';
import FileNameTemplateEditor from './FileNameTemplateEditor';

const { basename } = window.require('path');


const rowStyle: CSSProperties = {
  margin: '.3em 0', overflowY: 'auto', whiteSpace: 'nowrap',
};

function Alert({ text }: { text: string }) {
  return (
    <div style={{ marginBottom: '1em' }}><FaExclamationTriangle style={{ color: warningColor, verticalAlign: 'middle', marginRight: '.2em' }} /> {text}</div>
  );
}

function ConcatSheet({ isShown, onHide, paths, mergedFileTemplate, generateMergedFileNames, onConcat, alwaysConcatMultipleFiles, setAlwaysConcatMultipleFiles, fileFormat, setFileFormat, detectedFileFormat, setDetectedFileFormat, onOutputFormatUserChange }: {
  isShown: boolean,
  onHide: () => void,
  paths: string[],
  mergedFileTemplate: string,
  generateMergedFileNames: GenerateMergedOutFileNames,
  onConcat: (a: { paths: string[], includeAllStreams: boolean, streams: FFprobeStream[], fileFormat: string, clearBatchFilesAfterConcat: boolean, generatedFileNames: GeneratedOutFileNames }) => Promise<void>,
  alwaysConcatMultipleFiles: boolean,
  setAlwaysConcatMultipleFiles: (a: boolean) => void,
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

  const generateFileNames = useCallback(async (template: string) => {
    invariant(firstPath != null && fileFormat != null);
    const outputDir = getOutDir(customOutDir, firstPath);

    return generateMergedFileNames({ template, filePaths: paths, fileFormat, outputDir, epochMs: uniqueSuffix });
  }, [customOutDir, fileFormat, firstPath, generateMergedFileNames, paths, uniqueSuffix]);

  useEffect(() => {
    if (!isShown) {
      setFileMeta(undefined);
      setFileFormat(undefined);
      setDetectedFileFormat(undefined);
    }
  }, [isShown, setDetectedFileFormat, setFileFormat]);

  useEffect(() => {
    if (!isShown) return undefined;

    const abortController = new AbortController();

    (async () => {
      invariant(firstPath != null);
      const fileMetaNew = await readFileMeta(firstPath);
      const fileFormatNew = await getDefaultOutFormat({ filePath: firstPath, fileMeta: fileMetaNew });
      if (abortController.signal.aborted) return;

      setFileMeta(fileMetaNew);
      setDetectedFileFormat(fileFormatNew);
      if (outFormatLocked) {
        setFileFormat(outFormatLocked);
      } else {
        setFileFormat(mapRecommendedDefaultFormat({ sourceFormat: fileFormatNew, streams: fileMetaNew.streams }).format);
      }
      setUniqueSuffix(Date.now());
    })().catch(console.error);

    return () => abortController.abort();
  }, [firstPath, isShown, outFormatLocked, setDetectedFileFormat, setFileFormat, setMergedFileTemplate, simpleMode]);

  useEffect(() => {
    const abortController = new AbortController();
    console.log('wat', fileFormat);

    (async () => {
      // in simple mode, set merged file template to a generated name based on first file, so they don't *have to* deal with variables
      if (isShown && simpleMode && firstPath != null && fileFormat != null) {
        const generated = await generateFileNames(defaultMergedFileTemplate);
        if (abortController.signal.aborted) return;
        setMergedFileTemplate(generated.fileNames[0]);
      }
    })().catch(console.error);

    return () => abortController.abort();
  }, [fileFormat, firstPath, generateFileNames, isShown, setMergedFileTemplate, simpleMode]);

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

    const abortController = new AbortController();

    (async () => {
      // eslint-disable-next-line no-restricted-syntax
      for (const path of paths) {
        if (abortController.signal.aborted) return;
        if (!allFilesMetaCache[path]) {
          // eslint-disable-next-line no-await-in-loop
          const fileMetaNew = await readFileMeta(path);
          setAllFilesMetaCache((existing) => ({ ...existing, [path]: fileMetaNew }));
        }
      }
    })().catch(console.error);

    return () => abortController.abort();
  }, [allFilesMetaCache, enableReadFileMeta, isShown, paths]);

  const onConcatClick = useCallback(async () => {
    invariant(fileFormat != null);
    invariant(firstPath != null);

    const outputDir = getOutDir(customOutDir, firstPath);
    const generatedFileNames = await generateMergedFileNames({ template: mergedFileTemplate, filePaths: paths, fileFormat, outputDir, epochMs: uniqueSuffix });

    await onConcat({ paths, includeAllStreams, streams: fileMeta!.streams, fileFormat, clearBatchFilesAfterConcat, generatedFileNames });
  }, [clearBatchFilesAfterConcat, customOutDir, fileFormat, fileMeta, firstPath, generateMergedFileNames, includeAllStreams, mergedFileTemplate, onConcat, paths, uniqueSuffix]);

  const handleReadFileMetaCheckedChange = useCallback((checked: boolean) => {
    setEnableReadFileMeta(checked);
    setAllFilesMetaCache({});
  }, []);

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
        <div style={{ whiteSpace: 'pre-wrap', marginBottom: '1em' }}>
          {t('This dialog can be used to concatenate files in series, e.g. one after the other:\n[file1][file2][file3]\nIt can NOT be used for merging tracks in parallell (like adding an audio track to a video).\nMake sure all files are of the exact same codecs & codec parameters (fps, resolution etc).')}
        </div>

        <div>
          {paths.map((path, index) => (
            <div key={path} style={rowStyle} title={path}>
              <div>
                <span style={{ opacity: 0.7, marginRight: '.4em' }}>{`${index + 1}.`}</span>
                <span>{basename(path)}</span>

                {allFilesMetaCache[path] ? (
                  problemsByFile[path] ? (
                    <Dialog.Root>
                      <Dialog.Trigger asChild>
                        <Button title={i18n.t('Mismatches detected')} style={{ color: warningColor, marginLeft: '1em', padding: '.2em .4em' }}><FaExclamationTriangle /></Button>
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
                  ) : (
                    <FaCheck style={{ color: saveColor, verticalAlign: 'middle', marginLeft: '1em' }} />
                  )
                ) : (
                  <FaQuestionCircle style={{ color: warningColor, verticalAlign: 'middle', marginLeft: '1em' }} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1em', marginBottom: '1em', flexWrap: 'wrap' }}>
        <Checkbox checked={enableReadFileMeta} onCheckedChange={handleReadFileMetaCheckedChange} label={t('Check compatibility')} />

        <Dialog.Root>
          <Dialog.Trigger asChild>
            <Button style={{ padding: '.3em .5em' }}><FaCog style={{ verticalAlign: 'middle', fontSize: '1.4em', marginRight: '.2em' }} /> {t('Options')}</Button>
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
                  <DialogButton primary>{t('Close')}</DialogButton>
                </Dialog.Close>
              </Dialog.ButtonRow>

              <Dialog.CloseButton />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        {fileFormat != null && detectedFileFormat != null && (
          <OutputFormatSelect style={{ height: '2.1em', maxWidth: '20em' }} detectedFileFormat={detectedFileFormat} fileFormat={fileFormat} onOutputFormatUserChange={onOutputFormatUserChange} />
        )}
      </div>

      {fileFormat != null && (
        <div style={{ marginBottom: '1em' }}>
          <FileNameTemplateEditor mode="merge-files" template={mergedFileTemplate} setTemplate={setMergedFileTemplate} defaultTemplate={defaultMergedFileTemplate} generateFileNames={generateFileNames} />
        </div>
      )}

      {enableReadFileMeta && (!allFilesMeta || Object.values(problemsByFile).length > 0) && (
        <Alert text={t('A mismatch was detected in at least one file. You may proceed, but the resulting file might not be playable.')} />
      )}
      {!enableReadFileMeta && (
        <Alert text={t('File compatibility check is not enabled, so the merge operation might not produce a valid output. Enable "Check compatibility" below to check file compatibility before merging.')} />
      )}
    </ExportSheet>
  );
}

export default memo(ConcatSheet);
