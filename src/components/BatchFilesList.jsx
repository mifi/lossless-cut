import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FaTimes } from 'react-icons/fa';
import { MergeColumnsIcon } from 'evergreen-ui';
import BatchFile from './BatchFile';

import { timelineBackground, controlsBackground } from '../colors';

const BatchFilesList = memo(({ filePath, width, batchFiles, batchOpenSingleFile, removeBatchFile, setConcatDialogVisible, closeBatch }) => {
  const { t } = useTranslation();

  return (
    <motion.div
      className="no-user-select"
      style={{ width, background: timelineBackground, color: 'rgba(255,255,255,0.7)', display: 'flex', flexDirection: 'column', overflowY: 'hidden', overflowX: 'hidden', resize: 'horizontal' }}
      initial={{ x: -width }}
      animate={{ x: 0 }}
      exit={{ x: -width }}
    >
      <div style={{ background: controlsBackground, fontSize: 14, paddingBottom: 7, paddingTop: 3, paddingLeft: 10, paddingRight: 5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {t('Batch file list')}

        <div style={{ flexGrow: 1 }} />

        {batchFiles.length > 1 && <MergeColumnsIcon role="button" title={t('Merge/concatenate files')} color="white" style={{ marginRight: 10, cursor: 'pointer' }} onClick={() => setConcatDialogVisible(true)} />}

        <FaTimes size={18} role="button" style={{ cursor: 'pointer', color: 'white' }} onClick={() => closeBatch()} title={t('Close batch')} />
      </div>

      <div style={{ overflowX: 'hidden', overflowY: 'auto' }}>
        {batchFiles.map(({ path, name }) => (
          <BatchFile key={path} path={path} name={name} filePath={filePath} onOpen={batchOpenSingleFile} onDelete={removeBatchFile} />
        ))}
      </div>
    </motion.div>
  );
});

export default BatchFilesList;
