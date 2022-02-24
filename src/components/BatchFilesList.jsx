import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FaTimes, FaHatWizard } from 'react-icons/fa';
import { AiOutlineMergeCells } from 'react-icons/ai';

import BatchFile from './BatchFile';
import { timelineBackground, controlsBackground } from '../colors';

const iconStyle = {
  flexShrink: 0,
  color: 'white',
  cursor: 'pointer',
  paddingTop: 3,
  paddingBottom: 3,
  padding: '3px 5px',
};

const BatchFilesList = memo(({ filePath, width, batchFiles, batchOpenSingleFile, batchRemoveFile, closeBatch, onMergeFilesClick, onBatchConvertToSupportedFormatClick }) => {
  const { t } = useTranslation();

  return (
    <motion.div
      className="no-user-select"
      style={{ width, background: timelineBackground, color: 'rgba(255,255,255,0.7)', display: 'flex', flexDirection: 'column', overflowY: 'hidden', overflowX: 'hidden', resize: 'horizontal' }}
      initial={{ x: -width }}
      animate={{ x: 0 }}
      exit={{ x: -width }}
    >
      <div style={{ background: controlsBackground, fontSize: 14, paddingBottom: 3, paddingTop: 0, paddingLeft: 10, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {t('Batch file list')}
        <div style={{ flexGrow: 1 }} />
        <FaHatWizard size={17} role="button" title={`${t('Convert to supported format')}...`} style={iconStyle} onClick={onBatchConvertToSupportedFormatClick} />
        <AiOutlineMergeCells size={20} role="button" title={`${t('Merge/concatenate files')}...`} style={iconStyle} onClick={onMergeFilesClick} />
        <FaTimes size={20} role="button" title={t('Close batch')} style={iconStyle} onClick={closeBatch} />
      </div>

      <div style={{ overflowX: 'hidden', overflowY: 'auto' }}>
        {batchFiles.map(({ path, name }) => (
          <BatchFile key={path} path={path} name={name} filePath={filePath} onOpen={batchOpenSingleFile} onDelete={batchRemoveFile} />
        ))}
      </div>
    </motion.div>
  );
});

export default BatchFilesList;
