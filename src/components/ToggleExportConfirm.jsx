import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { MdEventNote } from 'react-icons/md';

import { primaryTextColor } from '../colors';


const ToggleExportConfirm = memo(({ exportConfirmEnabled, toggleExportConfirmEnabled, size = 23, style }) => {
  const { t } = useTranslation();

  return (
    <MdEventNote style={{ color: exportConfirmEnabled ? primaryTextColor : 'rgba(255,255,255,0.3)', ...style }} size={size} title={t('Show summary before exporting?')} role="button" onClick={toggleExportConfirmEnabled} />
  );
});

export default ToggleExportConfirm;
