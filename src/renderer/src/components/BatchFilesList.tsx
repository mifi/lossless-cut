import { DragEventHandler, memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FaTimes, FaHatWizard } from 'react-icons/fa';
import { AiOutlineMergeCells } from 'react-icons/ai';
import { ReactSortable } from 'react-sortablejs';
import { SortAlphabeticalIcon, SortAlphabeticalDescIcon } from 'evergreen-ui';

import BatchFile from './BatchFile';
import { controlsBackground, darkModeTransition, primaryColor } from '../colors';
import { mySpring } from '../animations';
import { BatchFile as BatchFileType } from '../types';


const iconStyle = {
  flexShrink: 0,
  color: 'var(--gray-12)',
  cursor: 'pointer',
  paddingTop: 3,
  paddingBottom: 3,
  padding: '3px 5px',
};

function BatchFilesList({ selectedBatchFiles, filePath, width, batchFiles, setBatchFiles, onBatchFileSelect, batchListRemoveFile, closeBatch, onMergeFilesClick, onBatchConvertToSupportedFormatClick, onDrop }: {
  selectedBatchFiles: string[],
  filePath: string | undefined,
  width: number,
  batchFiles: BatchFileType[],
  setBatchFiles: (f: BatchFileType[]) => void,
  onBatchFileSelect: (f: string) => void,
  batchListRemoveFile: (path: string | undefined) => void,
  closeBatch: () => void,
  onMergeFilesClick: () => void,
  onBatchConvertToSupportedFormatClick: () => void,
  onDrop: DragEventHandler<HTMLDivElement>,
}) {
  const { t } = useTranslation();

  const [sortDesc, setSortDesc] = useState<boolean>();

  const sortableList = batchFiles.map((batchFile) => ({ id: batchFile.path, batchFile }));

  const setSortableList = useCallback((newList: { batchFile: BatchFileType }[]) => {
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
      style={{ width, background: controlsBackground, color: 'var(--gray-12)', borderRight: '1px solid var(--gray-7)', transition: darkModeTransition, display: 'flex', flexDirection: 'column', overflowY: 'hidden', overflowX: 'hidden', resize: 'horizontal' }}
      initial={{ x: -width }}
      animate={{ x: 0 }}
      exit={{ x: -width }}
      transition={mySpring}
      onDrop={onDrop}
    >
      <div style={{ fontSize: 14, paddingBottom: 3, paddingTop: 0, paddingLeft: 10, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <div>{t('Batch file list')}{batchFiles.length > 0 && ` (${batchFiles.length})`}</div>
        <div style={{ flexGrow: 1 }} />
        <FaHatWizard size={17} role="button" title={`${t('Convert to supported format')}...`} style={iconStyle} onClick={onBatchConvertToSupportedFormatClick} />
        <SortIcon size={25} role="button" title={t('Sort items')} style={iconStyle} onClick={onSortClick} />
        <AiOutlineMergeCells size={20} role="button" title={`${t('Merge/concatenate files')}...`} style={{ ...iconStyle, color: 'white', background: primaryColor, borderRadius: '.5em' }} onClick={onMergeFilesClick} />
        <FaTimes size={20} role="button" title={t('Close batch')} style={{ ...iconStyle, color: 'var(--gray-11)' }} onClick={closeBatch} />
      </div>

      <div style={{ overflowX: 'hidden', overflowY: 'auto' }}>
        <ReactSortable list={sortableList} setList={setSortableList}>
          {sortableList.map(({ batchFile: { path, name } }, index) => (
            <BatchFile key={path} index={index} path={path} name={name} isSelected={selectedBatchFiles.includes(path)} isOpen={filePath === path} onSelect={onBatchFileSelect} onDelete={batchListRemoveFile} />
          ))}
        </ReactSortable>
      </div>
    </motion.div>
  );
}

export default memo(BatchFilesList);
