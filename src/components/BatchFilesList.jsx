import React, { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FaBars } from 'react-icons/fa';

import BatchFile from './BatchFile';
import useNativeMenu from '../hooks/useNativeMenu';
import { timelineBackground, controlsBackground } from '../colors';

const BatchFilesList = memo(({ filePath, width, batchFiles, batchOpenSingleFile, removeBatchFile, closeBatch, onMergeFilesClick, onBatchConvertToSupportedFormatClick }) => {
  const { t } = useTranslation();

  const contextMenuTemplate = useMemo(() => [
    { label: t('Merge/concatenate files'), click: onMergeFilesClick },
    { label: t('Convert to supported format'), click: onBatchConvertToSupportedFormatClick },
    { type: 'separator' },
    { label: t('Close batch'), click: closeBatch },
  ], [closeBatch, onBatchConvertToSupportedFormatClick, onMergeFilesClick, t]);

  const { openMenu } = useNativeMenu(contextMenuTemplate);

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

        <FaBars size={20} role="button" title={t('Batch file list')} style={{ cursor: 'pointer', color: 'white', marginRight: 5 }} onClick={openMenu} />
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
