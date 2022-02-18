import React, { memo } from 'react';
import { FiScissors } from 'react-icons/fi';
import { FaFileExport } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

import { primaryColor } from '../colors';


const ExportButton = memo(({ enabledSegments, areWeCutting, autoMerge, onClick, size = 1 }) => {
  const CutIcon = areWeCutting ? FiScissors : FaFileExport;

  const { t } = useTranslation();

  let exportButtonTitle = t('Export');
  if (enabledSegments.length === 1) {
    exportButtonTitle = t('Export selection');
  } else if (enabledSegments.length > 1) {
    exportButtonTitle = t('Export {{ num }} segments', { num: enabledSegments.length });
  }

  const exportButtonText = autoMerge && enabledSegments && enabledSegments.length > 1 ? t('Export+merge') : t('Export');

  return (
    <div
      style={{ cursor: 'pointer', background: primaryColor, borderRadius: size * 5, paddingTop: size * 1, paddingBottom: size * 2.5, paddingLeft: size * 7, paddingRight: size * 7, fontSize: size * 13, whiteSpace: 'nowrap' }}
      onClick={onClick}
      title={exportButtonTitle}
      role="button"
    >
      <CutIcon
        style={{ verticalAlign: 'middle', marginRight: size * 4 }}
        size={size * 15}
      />
      {exportButtonText}
    </div>
  );
});

export default ExportButton;
