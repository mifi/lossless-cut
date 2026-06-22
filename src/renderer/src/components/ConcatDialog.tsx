import type { CSSProperties, Dispatch, SetStateAction } from 'react';
import { memo, useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AiOutlineMergeCells } from 'react-icons/ai';
import { FaQuestionCircle, FaExclamationTriangle, FaCog, FaCheck, FaInfoCircle } from 'react-icons/fa';
import invariant from 'tiny-invariant';
import pMap from 'p-map';
import { Table } from '@radix-ui/themes';

import Checkbox from './Checkbox';
import type { FileFfprobeMeta } from '../ffmpeg';
import { readFileFfprobeMeta, getDefaultOutFormat, mapRecommendedDefaultFormat } from '../ffmpeg';
import OutputFormatSelect from './OutputFormatSelect';
import useUserSettings from '../hooks/useUserSettings';
import { isMov } from '../util/streams';
import { getOutDir, readFileStats } from '../util';
import type { FFprobeStream } from '../../../common/ffprobe';
import Button, { DialogButton } from './Button';
import type { GeneratedOutFileNames, GenerateMergedOutFileNames } from '../util/outputNameTemplate';
import { defaultMergedFileTemplate } from '../util/outputNameTemplate';
import { dangerColor, primaryTextColor, saveColor, warningColor } from '../colors';
import * as Dialog from './Dialog';
import FileNameTemplateEditor from './FileNameTemplateEditor';
import HighlightedText from './HighlightedText';
import type { FileStats } from '../types';
import OutDirSelector from './OutDirSelector';
import { parseRatio } from '../../../common/util';

const { basename } = window.require('node:path');


const rowStyle: CSSProperties = {
  margin: '.3em 0', overflowY: 'auto', whiteSpace: 'nowrap',
};

function Alert({ text }: { text: string }) {
  return (
    <div style={{ marginBottom: '1em' }}><FaExclamationTriangle style={{ color: warningColor, verticalAlign: 'middle', marginRight: '.2em' }} /> {text}</div>
  );
}

type ProblemValue = string | number | undefined;

type Problem = {
  index: number,
} & ({
  type: 'extraneous',
} | {
  type: 'parameter_mismatch',
  key: string,
  values: [ProblemValue, ProblemValue],
});

function ConcatDialog({ isShown, onHide, paths, mergedFileTemplate: storedMergedFileTemplate, generateMergedFileNames, onConcat, alwaysConcatMultipleFiles, setAlwaysConcatMultipleFiles, fileFormat, setFileFormat, detectedFileFormat, setDetectedFileFormat, onOutputFormatUserChange }: {
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
  const { preserveMovData, setPreserveMovData, segmentsToChapters, setSegmentsToChapters, preserveMetadataOnMerge, setPreserveMetadataOnMerge, customOutDir, simpleMode, setMergedFileTemplate: setStoredMergedFileTemplate, outFormatLocked } = useUserSettings();

  // Note: all state here is preserved when dialog is closed

  const [includeAllStreams, setIncludeAllStreams] = useState(false);
  const [allFilesMeta, setAllFilesMeta] = useState<Record<string, { ffprobeMeta: FileFfprobeMeta, stats: FileStats }>>({});
  const [clearBatchFilesAfterConcat, setClearBatchFilesAfterConcat] = useState(false);
  const [enableReadFileMeta, setEnableReadFileMeta] = useState(simpleMode);
  const [uniqueSuffix, setUniqueSuffix] = useState(() => Date.now());

  const firstPath = useMemo(() => paths[0], [paths]);

  const outputDir = getOutDir(customOutDir, firstPath);

  const generateFileNames = useCallback(async (template: string) => {
    invariant(fileFormat != null && outputDir != null);

    const sourceFiles = paths.map((path) => ({
      path,
      ...allFilesMeta[path],
    }));

    return generateMergedFileNames({ template, sourceFiles, fileFormat, outputDir, epochMs: uniqueSuffix });
  }, [allFilesMeta, fileFormat, generateMergedFileNames, outputDir, paths, uniqueSuffix]);

  // for simple mode, we want to auto-generate the merged file template based on the first file, so we don't store it in user settings, as that could overwrite what they already have there
  // https://github.com/mifi/lossless-cut/issues/2927#issuecomment-4773155758
  const [tempMergedFileTemplate, setTempMergedFileTemplate] = useState<string | undefined>(defaultMergedFileTemplate);
  const mergedFileTemplate = simpleMode ? (tempMergedFileTemplate ?? defaultMergedFileTemplate) : storedMergedFileTemplate;
  const setMergedFileTemplate = simpleMode ? setTempMergedFileTemplate : setStoredMergedFileTemplate;

  useEffect(() => {
    if (!isShown) {
      // todo
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAllFilesMeta({});
      setTempMergedFileTemplate(defaultMergedFileTemplate);
    }
  }, [isShown, setDetectedFileFormat, setFileFormat]);

  useEffect(() => {
    if (simpleMode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEnableReadFileMeta(true);
    }
  }, [simpleMode]);

  useEffect(() => {
    const abortController = new AbortController();

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

  const matchingFilesMeta = useMemo(() => {
    if (paths.length === 0) return undefined;
    const filtered = paths.flatMap((path) => (allFilesMeta[path] ? [[path, allFilesMeta[path]] as const] : []));
    return filtered.length === paths.length ? filtered : undefined;
  }, [allFilesMeta, paths]);

  const problemsByFile = useMemo(() => {
    if (!matchingFilesMeta) return {};
    const allFilesMetaExceptFirstFile = matchingFilesMeta.slice(1);
    const [, firstFileMeta] = matchingFilesMeta[0]!;
    const problems: Record<string, Problem[]> = {};

    function addProblem(path: string, error: Problem) {
      if (!problems[path]) problems[path] = [];
      problems[path]!.push(error);
    }

    allFilesMetaExceptFirstFile.forEach(([path, { ffprobeMeta: { streams } }]) => {
      streams.forEach((stream, i) => {
        const referenceStream = firstFileMeta.ffprobeMeta.streams[i];
        if (!referenceStream) {
          addProblem(path, { type: 'extraneous', index: stream.index });
          return;
        }
        // check all these parameters
        (['codec_name', 'width', 'height', 'pix_fmt', 'level', 'profile', 'sample_fmt', 'avg_frame_rate', 'r_frame_rate', 'time_base'] as const).forEach((key) => {
          // special handling: https://github.com/mifi/lossless-cut/discussions/2740
          if (key === 'avg_frame_rate') {
            const val = parseRatio(stream[key]);
            const referenceVal = parseRatio(referenceStream[key]);
            const sigma = 0.01;
            if ((val == null && referenceVal != null) || (val != null && referenceVal == null) || (val != null && referenceVal != null && Math.abs(val - referenceVal) >= sigma)) {
              addProblem(path, { type: 'parameter_mismatch', index: stream.index, key, values: [String(val), referenceVal] });
            }
          } else {
            const val = stream[key];
            const referenceVal = referenceStream[key];
            if (val !== referenceVal) {
              addProblem(path, { type: 'parameter_mismatch', index: stream.index, key, values: [String(val), referenceVal] });
            }
          }
        });
      });
    });
    return problems;
  }, [matchingFilesMeta]);

  useEffect(() => {
    if (!isShown) return undefined;

    const abortController = new AbortController();

    invariant(firstPath != null);

    (async () => {
      const pathsToFetchMetaFrom = enableReadFileMeta ? paths : [firstPath];

      const newMetaEntries = await pMap(pathsToFetchMetaFrom, async (path) => {
        abortController.signal.throwIfAborted();
        const stats = await readFileStats(path);
        return [
          path,
          {
            ffprobeMeta: await readFileFfprobeMeta(path),
            stats: {
              size: stats.size,
              atime: stats.atimeMs,
              mtime: stats.mtimeMs,
              ctime: stats.ctimeMs,
              birthtime: stats.birthtimeMs,
            },
          },
        ] as const;
      }, { concurrency: 1 });

      const firstFileMeta = newMetaEntries[0]?.[1];
      invariant(firstFileMeta);
      const fileFormatNew = await getDefaultOutFormat({ filePath: firstPath, fileMeta: firstFileMeta.ffprobeMeta });

      abortController.signal.throwIfAborted();

      // state mutations:

      setDetectedFileFormat(fileFormatNew);
      if (outFormatLocked) {
        setFileFormat(outFormatLocked);
      } else {
        setFileFormat(mapRecommendedDefaultFormat({ sourceFormat: fileFormatNew, streams: firstFileMeta.ffprobeMeta.streams }).format);
      }
      setAllFilesMeta((existing) => ({ ...existing, ...Object.fromEntries(newMetaEntries) }));
      setUniqueSuffix(Date.now());
    })().catch((err) => {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error(err);
    });

    return () => abortController.abort();
  }, [enableReadFileMeta, firstPath, isShown, outFormatLocked, paths, setDetectedFileFormat, setFileFormat]);

  const onConcatClick = useCallback(async () => {
    invariant(firstPath != null);
    invariant(fileFormat != null);
    invariant(outputDir != null);
    const firstFileMeta = allFilesMeta[firstPath];
    invariant(firstFileMeta != null);

    const generatedFileNames = await generateFileNames(mergedFileTemplate);

    await onConcat({ paths, includeAllStreams, streams: firstFileMeta.ffprobeMeta.streams, fileFormat, clearBatchFilesAfterConcat, generatedFileNames });
  }, [firstPath, fileFormat, outputDir, allFilesMeta, generateFileNames, mergedFileTemplate, onConcat, paths, includeAllStreams, clearBatchFilesAfterConcat]);

  const handleReadFileMetaCheckedChange = useCallback((checked: boolean) => {
    setEnableReadFileMeta(checked);
    setAllFilesMeta({});
  }, []);

  return (
    <Dialog.Root open={isShown} onOpenChange={(open) => !open && onHide()}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content style={{ width: '60em' }}>
          <Dialog.Title>{t('Merge/concatenate files')}</Dialog.Title>
          <Dialog.Description style={{ whiteSpace: 'pre-wrap' }}>{t('This dialog can be used to concatenate files in series, e.g. one after the other:\n[file1][file2][file3]\nIt can NOT be used for merging tracks in parallell (like adding an audio track to a video).\nMake sure all files are of the exact same codecs & codec parameters (fps, resolution etc).')}</Dialog.Description>

          <div style={{ marginBottom: '1em', maxHeight: '30vh', overflowY: 'auto' }}>
            {paths.map((path, index) => (
              <div key={path} style={rowStyle} title={path}>
                <div>
                  <span style={{ opacity: 0.7, marginRight: '.4em' }}>{`${index + 1}.`}</span>

                  <span>{basename(path)}</span>

                  {allFilesMeta[path] ? (
                    problemsByFile[path] ? (
                      <Dialog.Root>
                        <Dialog.Trigger asChild>
                          <Button title={t('Mismatches detected')} style={{ color: warningColor, marginLeft: '1em' }}><FaExclamationTriangle /></Button>
                        </Dialog.Trigger>

                        <Dialog.Portal>
                          <Dialog.Overlay />
                          <Dialog.Content aria-describedby={undefined}>
                            <Dialog.Title>{t('Mismatches detected')}</Dialog.Title>

                            <Table.Root>
                              <Table.Header>
                                <Table.Row>
                                  <Table.ColumnHeaderCell>{t('Track')}</Table.ColumnHeaderCell>
                                  <Table.ColumnHeaderCell>{t('Parameter')}</Table.ColumnHeaderCell>
                                  <Table.ColumnHeaderCell>{t('Expected')}</Table.ColumnHeaderCell>
                                  <Table.ColumnHeaderCell>{t('Actual')}</Table.ColumnHeaderCell>
                                </Table.Row>
                              </Table.Header>

                              <Table.Body>
                                {(problemsByFile[path] ?? []).map((problem) => (
                                  <Table.Row key={JSON.stringify(problem)}>
                                    <Table.Cell style={{ marginRight: '.5em', color: 'var(--gray-11)' }}>
                                      {problem.index + 1}
                                    </Table.Cell>

                                    {problem.type === 'extraneous' && (
                                      <>
                                        <Table.Cell />
                                        <Table.Cell />
                                        <Table.Cell style={{ color: dangerColor, fontWeight: 'bold' }}>{t('Extraneous')}</Table.Cell>
                                      </>
                                    )}

                                    {problem.type === 'parameter_mismatch' && (
                                      <>
                                        <Table.Cell style={{ marginRight: '1em' }}>{problem.key}</Table.Cell>
                                        <Table.Cell style={{ fontWeight: 'bold' }}>{problem.values[0] ?? t('N/A')}</Table.Cell>
                                        <Table.Cell>
                                          <span style={{ fontWeight: 'bold', color: dangerColor }}>{problem.values[1] ?? t('N/A')}</span>
                                        </Table.Cell>
                                      </>
                                    )}
                                  </Table.Row>
                                ))}
                              </Table.Body>
                            </Table.Root>

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

          <div style={{ marginBottom: '1em' }}>
            {t('Save output to path:')}<br />
            <OutDirSelector>
              <HighlightedText role="button" style={{ wordBreak: 'break-all', cursor: 'pointer' }}>{outputDir}</HighlightedText>
            </OutDirSelector>
          </div>

          {fileFormat != null && (
            <div style={{ marginBottom: '1em' }}>
              <FileNameTemplateEditor mode="merge-files" template={mergedFileTemplate} setTemplate={setMergedFileTemplate} defaultTemplate={defaultMergedFileTemplate} generateFileNames={generateFileNames} />
            </div>
          )}

          <div style={{ minHeight: '2.7em' }}>
            {enableReadFileMeta && (!matchingFilesMeta || Object.values(problemsByFile).length > 0) && (
              <Alert text={t('A mismatch was detected in at least one file. You may proceed, but the resulting file might not be playable.')} />
            )}
            {!enableReadFileMeta && (
              <Alert text={t('File compatibility check is not enabled, so the merge operation might not produce a valid output. Enable "Check compatibility" below to check file compatibility before merging.')} />
            )}

            {simpleMode && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0 .5em', color: primaryTextColor }}>
                <FaInfoCircle color={primaryTextColor} style={{ verticalAlign: 'middle' }} />
                {t('You are in simple mode, meaning some functionality has been simplified or hidden.')}
              </div>
            )}
          </div>

          <Dialog.ButtonRow>
            {!simpleMode && (
              <Checkbox checked={enableReadFileMeta} onCheckedChange={handleReadFileMetaCheckedChange} label={t('Check compatibility')} />
            )}

            <Dialog.Close asChild>
              <DialogButton>{t('Cancel')}</DialogButton>
            </Dialog.Close>

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

            <OutputFormatSelect disabled={fileFormat == null || detectedFileFormat == null} style={{ height: '2.1em', maxWidth: '20em' }} detectedFileFormat={detectedFileFormat} fileFormat={fileFormat} onOutputFormatUserChange={onOutputFormatUserChange} />

            <DialogButton disabled={fileFormat == null} onClick={onConcatClick} primary>
              <AiOutlineMergeCells style={{ fontSize: '1.3em', verticalAlign: 'middle', marginRight: '.3em' }} />
              {t('Merge files')}
            </DialogButton>
          </Dialog.ButtonRow>

          <Dialog.CloseButton />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default memo(ConcatDialog);
