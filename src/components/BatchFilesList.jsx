import React, { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FaTimes, FaHatWizard } from 'react-icons/fa';
import { AiOutlineMergeCells } from 'react-icons/ai';
import { ReactSortable } from 'react-sortablejs';
import { SortAlphabeticalIcon, SortAlphabeticalDescIcon } from 'evergreen-ui';

import BatchFile from './BatchFile';
import { controlsBackground, darkModeTransition } from '../colors';
import { mySpring } from '../animations';


const iconStyle = {
  flexShrink: 0,
  color: 'var(--gray12)',
  cursor: 'pointer',
  paddingTop: 3,
  paddingBottom: 3,
  padding: '3px 5px',
};

const BatchFilesList = memo(({ selectedBatchFiles, filePath, width, batchFiles, setBatchFiles, onBatchFileSelect, batchListRemoveFile, closeBatch, onMergeFilesClick, onBatchConvertToSupportedFormatClick }) => {
  const { t } = useTranslation();

  const [sortDesc, setSortDesc] = useState();

  const sortableList = batchFiles.map((batchFile) => ({ id: batchFile.path, batchFile }));

  const setSortableList = useCallback((newList) => {
    setBatchFiles(newList.map(({ batchFile }) => batchFile));
  }, [setBatchFiles]);

  const onSortClick = useCallback(() => {
    const newSortDesc = sortDesc == null ? false : !sortDesc;
    const sortedFiles = [...batchFiles];
    const order = newSortDesc ? -1 : 1;
    // natural language sort (numeric) https://github.com/mifi/lossless-cut/issues/844
    sortedFiles.sort((a, b) => order * a.name.localeCompare(b.name, 'en-US', { numeric: true }));
    setBatchFiles(sortedFiles);
    setSortDesc(newSortDesc);
  }, [batchFiles, setBatchFiles, sortDesc]);

  const SortIcon = sortDesc ? SortAlphabeticalDescIcon : SortAlphabeticalIcon;

  return (
    <motion.div
      className="no-user-select"
      style={{ width, background: controlsBackground, color: 'var(--gray12)', borderRight: '1px solid var(--gray6)', transition: darkModeTransition, display: 'flex', flexDirection: 'column', overflowY: 'hidden', overflowX: 'hidden', resize: 'horizontal' }}
      initial={{ x: -width }}
      animate={{ x: 0 }}
      exit={{ x: -width }}
      transition={mySpring}
    >
      <div style={{ fontSize: 14, paddingBottom: 3, paddingTop: 0, paddingLeft: 10, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <div>{t('Batch file list')}</div>
        <div style={{ flexGrow: 1 }} />
        <FaHatWizard size={17} role="button" title={`${t('Convert to supported format')}...`} style={iconStyle} onClick={onBatchConvertToSupportedFormatClick} />
        <AiOutlineMergeCells size={20} role="button" title={`${t('Merge/concatenate files')}...`} style={iconStyle} onClick={onMergeFilesClick} />
        <SortIcon size={25} role="button" title={t('Sort items')} style={iconStyle} onClick={onSortClick} />
        <FaTimes size={20} role="button" title={t('Close batch')} style={{ ...iconStyle, color: 'var(--gray11)' }} onClick={closeBatch} />
      </div>

      <div style={{ overflowX: 'hidden', overflowY: 'auto' }}>
        <ReactSortable list={sortableList} setList={setSortableList}>
          {sortableList.map(({ batchFile: { path, name } }) => (
            <BatchFile key={path} path={path} name={name} isSelected={selectedBatchFiles.includes(path)} isOpen={filePath === path} onSelect={onBatchFileSelect} onDelete={batchListRemoveFile} />
          ))}
        </ReactSortable>
      </div>
    </motion.div>
  );
});

export default BatchFilesList;
