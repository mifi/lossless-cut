import React, { memo, useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, Pane, Checkbox, SortAlphabeticalIcon, SortAlphabeticalDescIcon, Button, Paragraph } from 'evergreen-ui';
import { sortableContainer, sortableElement } from 'react-sortable-hoc';
import arrayMove from 'array-move';
import { AiOutlineMergeCells } from 'react-icons/ai';

import { readFileMeta, getSmarterOutFormat } from '../ffmpeg';
import useFileFormatState from '../hooks/useFileFormatState';
import OutputFormatSelect from './OutputFormatSelect';

const { basename } = window.require('path');

const containerStyle = { color: 'black' };

const rowStyle = {
  color: 'black', padding: '3px 10px', fontSize: 14, margin: '7px 0', overflowY: 'auto', whiteSpace: 'nowrap', cursor: 'grab',
};

const SortableItem = sortableElement(({ value, sortIndex }) => (
  <Pane elevation={1} style={rowStyle} title={value}>
    {sortIndex + 1}
    {'. '}
    {basename(value)}
  </Pane>
));

const SortableContainer = sortableContainer(({ items }) => (
  <div style={{ padding: '0 3px' }}>
    {items.map((value, index) => (
      <SortableItem key={value} index={index} sortIndex={index} value={value} />
    ))}
  </div>
));

const ConcatDialog = memo(({
  isShown, onHide, initialPaths, onConcat,
  segmentsToChapters, setSegmentsToChapters,
  alwaysConcatMultipleFiles, setAlwaysConcatMultipleFiles,
  preserveMetadataOnMerge, setPreserveMetadataOnMerge,
  preserveMovData, setPreserveMovData,
}) => {
  const { t } = useTranslation();

  const [paths, setPaths] = useState(initialPaths);
  const [includeAllStreams, setIncludeAllStreams] = useState(false);
  const [sortDesc, setSortDesc] = useState();
  const [fileMeta, setFileMeta] = useState();

  const { fileFormat, setFileFormat, detectedFileFormat, setDetectedFileFormat, isCustomFormatSelected } = useFileFormatState();

  useEffect(() => {
    setPaths(initialPaths);

    if (initialPaths.length === 0) return undefined;

    let aborted = false;
    (async () => {
      const firstPath = initialPaths[0];
      setFileMeta();
      setFileFormat();
      setDetectedFileFormat();
      const fileMetaNew = await readFileMeta(firstPath);
      const fileFormatNew = await getSmarterOutFormat(firstPath, fileMetaNew.format);
      if (aborted) return;
      setFileMeta(fileMetaNew);
      setFileFormat(fileFormatNew);
      setDetectedFileFormat(fileFormatNew);
    })().catch(console.error);
    return () => {
      aborted = true;
    };
  }, [initialPaths, setDetectedFileFormat, setFileFormat]);

  const onSortEnd = useCallback(({ oldIndex, newIndex }) => {
    const newPaths = arrayMove(paths, oldIndex, newIndex);
    setPaths(newPaths);
  }, [paths]);

  const onSortClick = useCallback(() => {
    const newSortDesc = sortDesc == null ? false : !sortDesc;
    const sortedPaths = [...paths];
    const order = newSortDesc ? -1 : 1;
    // natural language sort (numeric) https://github.com/mifi/lossless-cut/issues/844
    sortedPaths.sort((a, b) => order * a.localeCompare(b, 'en-US', { numeric: true }));
    setPaths(sortedPaths);
    setSortDesc(newSortDesc);
  }, [paths, sortDesc]);

  const onOutputFormatUserChange = useCallback((newFormat) => setFileFormat(newFormat), [setFileFormat]);

  const onConcatClick = useCallback(() => onConcat({ paths, includeAllStreams, streams: fileMeta.streams, fileFormat, isCustomFormatSelected }), [fileFormat, fileMeta, includeAllStreams, isCustomFormatSelected, onConcat, paths]);

  return (
    <Dialog
      title={t('Merge/concatenate files')}
      isShown={isShown}
      onCloseComplete={onHide}
      topOffset="3vh"
      width="90vw"
      footer={(
        <>
          {fileFormat && detectedFileFormat && <OutputFormatSelect style={{ maxWidth: 150 }} detectedFileFormat={detectedFileFormat} fileFormat={fileFormat} onOutputFormatUserChange={onOutputFormatUserChange} />}
          <Button iconBefore={sortDesc ? SortAlphabeticalDescIcon : SortAlphabeticalIcon} onClick={onSortClick}>{t('Sort items')}</Button>
          <Button onClick={onHide} style={{ marginLeft: 10 }}>Cancel</Button>
          <Button iconBefore={<AiOutlineMergeCells />} isLoading={detectedFileFormat == null} appearance="primary" onClick={onConcatClick}>{t('Merge!')}</Button>
        </>
      )}
    >
      <div style={containerStyle}>
        <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, marginBottom: 10 }}>
          {t('This dialog can be used to concatenate files in series, e.g. one after the other:\n[file1][file2][file3]\nIt can NOT be used for merging tracks in parallell (like adding an audio track to a video).\nMake sure all files are of the exact same codecs & codec parameters (fps, resolution etc).\n\nDrag and drop to change the order of your files here:')}
        </div>

        <SortableContainer
          items={paths}
          onSortEnd={onSortEnd}
          helperClass="dragging-helper-class"
        />

        <div style={{ marginTop: 10 }}>
          <Checkbox checked={includeAllStreams} onChange={(e) => setIncludeAllStreams(e.target.checked)} label={`${t('Include all tracks?')} ${t('If this is checked, all audio/video/subtitle/data tracks will be included. This may not always work for all file types. If not checked, only default streams will be included.')}`} />

          <Checkbox checked={preserveMetadataOnMerge} onChange={(e) => setPreserveMetadataOnMerge(e.target.checked)} label={t('Preserve original metadata when merging? (slow)')} />

          <Checkbox checked={preserveMovData} onChange={(e) => setPreserveMovData(e.target.checked)} label={t('Preserve all MP4/MOV metadata?')} />

          <Checkbox checked={segmentsToChapters} onChange={(e) => setSegmentsToChapters(e.target.checked)} label={t('Create chapters from merged segments? (slow)')} />

          <Checkbox checked={alwaysConcatMultipleFiles} onChange={(e) => setAlwaysConcatMultipleFiles(e.target.checked)} label={t('Always open this dialog when opening multiple files')} />

          <Paragraph>{t('Note that also other settings from the normal export dialog apply to this merge function. For more information about all options, see the export dialog.')}</Paragraph>
        </div>
      </div>
    </Dialog>
  );
});

export default ConcatDialog;
