import { memo, useState, useCallback, useEffect, useMemo, CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton, Checkbox as EvergreenCheckbox, Dialog, Paragraph } from 'evergreen-ui';
import { AiOutlineMergeCells } from 'react-icons/ai';
import { FaQuestionCircle, FaExclamationTriangle, FaCog } from 'react-icons/fa';
import i18n from 'i18next';
import invariant from 'tiny-invariant';
import Checkbox from './Checkbox';

import { ReactSwal } from '../swal';
import { readFileMeta, getDefaultOutFormat, mapRecommendedDefaultFormat } from '../ffmpeg';
import useFileFormatState from '../hooks/useFileFormatState';
import OutputFormatSelect from './OutputFormatSelect';
import useUserSettings from '../hooks/useUserSettings';
import { isMov } from '../util/streams';
import { getOutFileExtension, getSuffixedFileName } from '../util';
import { FFprobeChapter, FFprobeFormat, FFprobeStream } from '../../../../ffprobe';
import Sheet from './Sheet';
import TextInput from './TextInput';
import Button from './Button';

const { basename } = window.require('path');


const rowStyle: CSSProperties = {
  fontSize: '1em', margin: '4px 0px', overflowY: 'auto', whiteSpace: 'nowrap',
};

function Alert({ text }: { text: string }) {
  return (
    <div style={{ marginBottom: '1em' }}><FaExclamationTriangle style={{ color: 'var(--orange8)', fontSize: '1.3em', verticalAlign: 'middle', marginRight: '.2em' }} /> {text}</div>
  );
}

function ConcatDialog({ isShown, onHide, paths, onConcat, alwaysConcatMultipleFiles, setAlwaysConcatMultipleFiles }: {
  isShown: boolean, onHide: () => void, paths: string[], onConcat: (a: { paths: string[], includeAllStreams: boolean, streams: FFprobeStream[], outFileName: string, fileFormat: string, clearBatchFilesAfterConcat: boolean }) => Promise<void>, alwaysConcatMultipleFiles: boolean, setAlwaysConcatMultipleFiles: (a: boolean) => void,
}) {
  const { t } = useTranslation();
  const { preserveMovData, setPreserveMovData, segmentsToChapters, setSegmentsToChapters, preserveMetadataOnMerge, setPreserveMetadataOnMerge } = useUserSettings();

  const [includeAllStreams, setIncludeAllStreams] = useState(false);
  const [fileMeta, setFileMeta] = useState<{ format: FFprobeFormat, streams: FFprobeStream[], chapters: FFprobeChapter[] }>();
  const [allFilesMetaCache, setAllFilesMetaCache] = useState<Record<string, {format: FFprobeFormat, streams: FFprobeStream[], chapters: FFprobeChapter[] }>>({});
  const [clearBatchFilesAfterConcat, setClearBatchFilesAfterConcat] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [enableReadFileMeta, setEnableReadFileMeta] = useState(false);
  const [outFileName, setOutFileName] = useState<string>();
  const [uniqueSuffix, setUniqueSuffix] = useState<number>();

  const { fileFormat, setFileFormat, detectedFileFormat, setDetectedFileFormat, isCustomFormatSelected } = useFileFormatState();

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
      setOutFileName(undefined);
      invariant(firstPath != null);
      const fileMetaNew = await readFileMeta(firstPath);
      const fileFormatNew = await getDefaultOutFormat({ filePath: firstPath, fileMeta: fileMetaNew });
      if (aborted) return;
      setFileMeta(fileMetaNew);
      setDetectedFileFormat(fileFormatNew);
      setFileFormat(mapRecommendedDefaultFormat({ sourceFormat: fileFormatNew, streams: fileMetaNew.streams }).format);
      setUniqueSuffix(Date.now());
    })().catch(console.error);

    return () => {
      aborted = true;
    };
  }, [firstPath, isShown, setDetectedFileFormat, setFileFormat]);

  useEffect(() => {
    if (fileFormat == null || firstPath == null) {
      setOutFileName(undefined);
      return;
    }
    const ext = getOutFileExtension({ isCustomFormatSelected, outFormat: fileFormat, filePath: firstPath });
    setOutFileName((existingOutputName) => {
      if (existingOutputName == null) return getSuffixedFileName(firstPath, `merged-${uniqueSuffix}${ext}`);
      return existingOutputName.replace(/(\.[^.]*)?$/, ext); // make sure the last (optional) .* is replaced by .ext`
    });
  }, [fileFormat, firstPath, isCustomFormatSelected, uniqueSuffix]);

  const allFilesMeta = useMemo(() => {
    if (paths.length === 0) return undefined;
    const filtered = paths.flatMap((path) => (allFilesMetaCache[path] ? [[path, allFilesMetaCache[path]!] as const] : []));
    return filtered.length === paths.length ? filtered : undefined;
  }, [allFilesMetaCache, paths]);

  const isOutFileNameValid = outFileName != null && outFileName.length > 0;

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
        ['codec_name', 'width', 'height', 'fps', 'pix_fmt', 'level', 'profile', 'sample_fmt', 'r_frame_rate', 'time_base'].forEach((key) => {
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

  const onProblemsByFileClick = useCallback((path: string) => {
    ReactSwal.fire({
      title: i18n.t('Mismatches detected'),
      html: (
        <ul style={{ margin: '10px 0', textAlign: 'left' }}>
          {(problemsByFile[path] || []).map((problem) => <li key={problem}>{problem}</li>)}
        </ul>
      ),
    });
  }, [problemsByFile]);

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

  const onOutputFormatUserChange = useCallback((newFormat) => setFileFormat(newFormat), [setFileFormat]);

  const onConcatClick = useCallback(() => {
    if (outFileName == null) throw new Error();
    if (fileFormat == null) throw new Error();
    onConcat({ paths, includeAllStreams, streams: fileMeta!.streams, outFileName, fileFormat, clearBatchFilesAfterConcat });
  }, [clearBatchFilesAfterConcat, fileFormat, fileMeta, includeAllStreams, onConcat, outFileName, paths]);

  return (
    <>
      <Sheet visible={isShown} onClosePress={onHide} maxWidth="100%" style={{ padding: '0 2em' }}>
        <h2>{t('Merge/concatenate files')}</h2>

        <div style={{ marginBottom: '1em' }}>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: '.9em', marginBottom: '1em' }}>
            {t('This dialog can be used to concatenate files in series, e.g. one after the other:\n[file1][file2][file3]\nIt can NOT be used for merging tracks in parallell (like adding an audio track to a video).\nMake sure all files are of the exact same codecs & codec parameters (fps, resolution etc).')}
          </div>

          <div style={{ backgroundColor: 'var(--gray1)', borderRadius: '.1em' }}>
            {paths.map((path, index) => (
              <div key={path} style={rowStyle} title={path}>
                <div>
                  {index + 1}
                  {'. '}
                  <span>{basename(path)}</span>
                  {!allFilesMetaCache[path] && <FaQuestionCircle style={{ color: 'var(--orange8)', verticalAlign: 'middle', marginLeft: '1em' }} />}
                  {problemsByFile[path] && <IconButton appearance="minimal" icon={FaExclamationTriangle} onClick={() => onProblemsByFileClick(path)} title={i18n.t('Mismatches detected')} style={{ color: 'var(--orange8)', marginLeft: '1em' }} />}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', marginBottom: '.5em', gap: '.5em' }}>
          <Checkbox checked={enableReadFileMeta} onCheckedChange={(checked) => setEnableReadFileMeta(!!checked)} label={t('Check compatibility')} />

          <Button onClick={() => setSettingsVisible(true)} style={{ height: '1.7em' }}><FaCog style={{ fontSize: '1em', verticalAlign: 'middle' }} /> {t('Options')}</Button>

          {fileFormat && detectedFileFormat && (
            <OutputFormatSelect style={{ height: '1.7em', maxWidth: '20em' }} detectedFileFormat={detectedFileFormat} fileFormat={fileFormat} onOutputFormatUserChange={onOutputFormatUserChange} />
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', marginBottom: '1em' }}>
          <div style={{ marginRight: '.5em' }}>{t('Output file name')}:</div>
          <TextInput value={outFileName || ''} onChange={(e) => setOutFileName(e.target.value)} />
          <Button disabled={detectedFileFormat == null || !isOutFileNameValid} onClick={onConcatClick} style={{ fontSize: '1.3em', padding: '0 .3em', marginLeft: '1em' }}><AiOutlineMergeCells style={{ fontSize: '1.4em', verticalAlign: 'middle' }} /> {t('Merge!')}</Button>
        </div>

        {enableReadFileMeta && (!allFilesMeta || Object.values(problemsByFile).length > 0) && (
          <Alert text={t('A mismatch was detected in at least one file. You may proceed, but the resulting file might not be playable.')} />
        )}
        {!enableReadFileMeta && (
          <Alert text={t('File compatibility check is not enabled, so the merge operation might not produce a valid output. Enable "Check compatibility" below to check file compatibility before merging.')} />
        )}
      </Sheet>

      <Dialog isShown={settingsVisible} onCloseComplete={() => setSettingsVisible(false)} title={t('Merge options')} hasCancel={false} confirmLabel={t('Close')}>
        <EvergreenCheckbox checked={includeAllStreams} onChange={(e) => setIncludeAllStreams(e.target.checked)} label={`${t('Include all tracks?')} ${t('If this is checked, all audio/video/subtitle/data tracks will be included. This may not always work for all file types. If not checked, only default streams will be included.')}`} />

        <EvergreenCheckbox checked={preserveMetadataOnMerge} onChange={(e) => setPreserveMetadataOnMerge(e.target.checked)} label={t('Preserve original metadata when merging? (slow)')} />

        {fileFormat != null && isMov(fileFormat) && <EvergreenCheckbox checked={preserveMovData} onChange={(e) => setPreserveMovData(e.target.checked)} label={t('Preserve all MP4/MOV metadata?')} />}

        <EvergreenCheckbox checked={segmentsToChapters} onChange={(e) => setSegmentsToChapters(e.target.checked)} label={t('Create chapters from merged segments? (slow)')} />

        <EvergreenCheckbox checked={alwaysConcatMultipleFiles} onChange={(e) => setAlwaysConcatMultipleFiles(e.target.checked)} label={t('Always open this dialog when opening multiple files')} />

        <EvergreenCheckbox checked={clearBatchFilesAfterConcat} onChange={(e) => setClearBatchFilesAfterConcat(e.target.checked)} label={t('Clear batch file list after merge')} />

        <Paragraph>{t('Note that also other settings from the normal export dialog apply to this merge function. For more information about all options, see the export dialog.')}</Paragraph>
      </Dialog>
    </>
  );
}

export default memo(ConcatDialog);
