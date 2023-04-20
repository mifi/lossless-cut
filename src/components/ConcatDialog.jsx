import React, { memo, useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, IconButton, Alert, Checkbox, Dialog, Button, Paragraph, CogIcon } from 'evergreen-ui';
import { AiOutlineMergeCells } from 'react-icons/ai';
import { FaQuestionCircle, FaExclamationTriangle } from 'react-icons/fa';
import i18n from 'i18next';
import withReactContent from 'sweetalert2-react-content';

import Swal from '../swal';
import { readFileMeta, getSmarterOutFormat } from '../ffmpeg';
import useFileFormatState from '../hooks/useFileFormatState';
import OutputFormatSelect from './OutputFormatSelect';
import useUserSettings from '../hooks/useUserSettings';
import { isMov } from '../util/streams';
import { getOutFileExtension, getSuffixedFileName } from '../util';

const { basename } = window.require('path');

const ReactSwal = withReactContent(Swal);

const containerStyle = { color: 'black' };

const rowStyle = {
  color: 'black', fontSize: 14, margin: '4px 0px', overflowY: 'auto', whiteSpace: 'nowrap',
};

const ConcatDialog = memo(({
  isShown, onHide, paths, onConcat,
  alwaysConcatMultipleFiles, setAlwaysConcatMultipleFiles,
}) => {
  const { t } = useTranslation();
  const { preserveMovData, setPreserveMovData, segmentsToChapters, setSegmentsToChapters, preserveMetadataOnMerge, setPreserveMetadataOnMerge } = useUserSettings();

  const [includeAllStreams, setIncludeAllStreams] = useState(false);
  const [fileMeta, setFileMeta] = useState();
  const [allFilesMetaCache, setAllFilesMetaCache] = useState({});
  const [clearBatchFilesAfterConcat, setClearBatchFilesAfterConcat] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [enableReadFileMeta, setEnableReadFileMeta] = useState(false);
  const [outFileName, setOutFileName] = useState();
  const [uniqueSuffix, setUniqueSuffix] = useState();

  const { fileFormat, setFileFormat, detectedFileFormat, setDetectedFileFormat, isCustomFormatSelected } = useFileFormatState();

  const firstPath = useMemo(() => {
    if (paths.length === 0) return undefined;
    return paths[0];
  }, [paths]);

  useEffect(() => {
    if (!isShown) return undefined;

    let aborted = false;

    (async () => {
      setFileMeta();
      setFileFormat();
      setDetectedFileFormat();
      setOutFileName();
      const fileMetaNew = await readFileMeta(firstPath);
      const fileFormatNew = await getSmarterOutFormat({ filePath: firstPath, fileMeta: fileMetaNew });
      if (aborted) return;
      setFileMeta(fileMetaNew);
      setFileFormat(fileFormatNew);
      setDetectedFileFormat(fileFormatNew);
      setUniqueSuffix(new Date().getTime());
    })().catch(console.error);

    return () => {
      aborted = true;
    };
  }, [firstPath, isShown, setDetectedFileFormat, setFileFormat]);

  useEffect(() => {
    if (fileFormat == null || firstPath == null) {
      setOutFileName();
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
    const filtered = paths.map((path) => [path, allFilesMetaCache[path]]).filter(([, it]) => it);
    return filtered.length === paths.length ? filtered : undefined;
  }, [allFilesMetaCache, paths]);

  const isOutFileNameValid = outFileName != null && outFileName.length > 0;

  const problemsByFile = useMemo(() => {
    if (!allFilesMeta) return [];
    const allFilesMetaExceptFirstFile = allFilesMeta.slice(1);
    const [, firstFileMeta] = allFilesMeta[0];
    const errors = {};
    function addError(path, error) {
      if (!errors[path]) errors[path] = [];
      errors[path].push(error);
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

  const onProblemsByFileClick = useCallback((path) => {
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

  const onConcatClick = useCallback(() => onConcat({ paths, includeAllStreams, streams: fileMeta.streams, fileName: outFileName, fileFormat, clearBatchFilesAfterConcat }), [clearBatchFilesAfterConcat, fileFormat, fileMeta, includeAllStreams, onConcat, outFileName, paths]);

  return (
    <>
      <Dialog
        title={t('Merge/concatenate files')}
        shouldCloseOnOverlayClick={false}
        isShown={isShown}
        onCloseComplete={onHide}
        topOffset="3vh"
        width="90vw"
        footer={(
          <>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Checkbox checked={enableReadFileMeta} onChange={(e) => setEnableReadFileMeta(e.target.checked)} label={t('Check compatibility')} marginLeft={10} marginRight={10} />
              <Button iconBefore={CogIcon} onClick={() => setSettingsVisible(true)}>{t('Options')}</Button>
              {fileFormat && detectedFileFormat ? (
                <OutputFormatSelect style={{ height: 30, maxWidth: 180 }} detectedFileFormat={detectedFileFormat} fileFormat={fileFormat} onOutputFormatUserChange={onOutputFormatUserChange} />
              ) : (
                <Button disabled isLoading>{t('Loading')}</Button>
              )}
              <Button iconBefore={<AiOutlineMergeCells />} isLoading={detectedFileFormat == null} disabled={!isOutFileNameValid} appearance="primary" onClick={onConcatClick}>{t('Merge!')}</Button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Paragraph marginRight=".5em">{t('Output file name')}:</Paragraph>
              <TextInput value={outFileName || ''} onChange={(e) => setOutFileName(e.target.value)} />
            </div>
          </>
        )}
      >
        <div style={containerStyle}>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, marginBottom: 10 }}>
            {t('This dialog can be used to concatenate files in series, e.g. one after the other:\n[file1][file2][file3]\nIt can NOT be used for merging tracks in parallel (like adding an audio track to a video).\nMake sure all files are of the exact same codecs & codec parameters (fps, resolution, etc).')}
          </div>

          <div>
            {paths.map((path, index) => (
              <div key={path} style={rowStyle} title={path}>
                <div>
                  {index + 1}
                  {'. '}
                  <span style={{ color: 'rgba(0,0,0,0.7)' }}>{basename(path)}</span>
                  {!allFilesMetaCache[path] && <FaQuestionCircle color="#996A13" style={{ marginLeft: 10 }} />}
                  {problemsByFile[path] && <IconButton appearance="minimal" icon={FaExclamationTriangle} onClick={() => onProblemsByFileClick(path)} title={i18n.t('Mismatches detected')} color="#996A13" style={{ marginLeft: 10 }} />}
                </div>
              </div>
            ))}
          </div>
        </div>

        {enableReadFileMeta && (!allFilesMeta || Object.values(problemsByFile).length > 0) && (
          <Alert intent="warning">{t('A mismatch was detected in at least one file. You may proceed, but the resulting file might not be playable.')}</Alert>
        )}
        {!enableReadFileMeta && (
          <Alert intent="warning">{t('File compatibility check is not enabled, so the merge operation might not produce a valid output. Enable "Check compatibility" below to check file compatibility before merging.')}</Alert>
        )}
      </Dialog>

      <Dialog isShown={settingsVisible} onCloseComplete={() => setSettingsVisible(false)} title={t('Merge options')} hasCancel={false} confirmLabel={t('Close')}>
        <Checkbox checked={includeAllStreams} onChange={(e) => setIncludeAllStreams(e.target.checked)} label={`${t('Include all tracks?')} ${t('If this is checked, all audio/video/subtitle/data tracks will be included. This may not always work for all file types. If not checked, only default streams will be included.')}`} />

        <Checkbox checked={preserveMetadataOnMerge} onChange={(e) => setPreserveMetadataOnMerge(e.target.checked)} label={t('Preserve original metadata when merging? (slow)')} />

        {isMov(fileFormat) && <Checkbox checked={preserveMovData} onChange={(e) => setPreserveMovData(e.target.checked)} label={t('Preserve all MP4/MOV metadata?')} />}

        <Checkbox checked={segmentsToChapters} onChange={(e) => setSegmentsToChapters(e.target.checked)} label={t('Create chapters from merged segments? (slow)')} />

        <Checkbox checked={alwaysConcatMultipleFiles} onChange={(e) => setAlwaysConcatMultipleFiles(e.target.checked)} label={t('Always open this dialog when opening multiple files')} />

        <Checkbox checked={clearBatchFilesAfterConcat} onChange={(e) => setClearBatchFilesAfterConcat(e.target.checked)} label={t('Clear batch file list after merge')} />

        <Paragraph>{t('Note that also other settings from the normal export dialog apply to this merge function. For more information about all options, see the export dialog.')}</Paragraph>
      </Dialog>
    </>
  );
});

export default ConcatDialog;
