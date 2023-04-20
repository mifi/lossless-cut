import React, { memo } from 'react';
import { FiScissors } from 'react-icons/fi';
import { FaFileExport } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

import { primaryColor } from '../colors';
import useUserSettings from '../hooks/useUserSettings';


const ExportButton = memo(({ segmentsToExport, areWeCutting, onClick, size = 1 }) => {
  const CutIcon = areWeCutting ? FiScissors : FaFileExport;

  const { t } = useTranslation();

  const { autoMerge } = useUserSettings();

  let title = t('Export');
  if (segmentsToExport.length === 1) {
    title = t('Export selection');
  } else if (segmentsToExport.length > 1) {
    title = t('Export {{ num }} segments', { num: segmentsToExport.length });
  }

  const text = autoMerge && segmentsToExport && segmentsToExport.length > 1 ? t('Export+merge') : t('Export');

  return (
    <div
      style={{ cursor: 'pointer', background: primaryColor, color: 'white', borderRadius: size * 5, paddingTop: size * 1, paddingBottom: size * 2.5, paddingLeft: size * 7, paddingRight: size * 7, fontSize: size * 13, whiteSpace: 'nowrap', opacity: segmentsToExport.length === 0 ? 0.5 : undefined }}
      onClick={onClick}
      title={title}
      role="button"
    >
      <CutIcon
        style={{ verticalAlign: 'middle', marginRight: size * 4 }}
        size={size * 15}
      />
      {text}
    </div>
  );
});

export default ExportButton;
