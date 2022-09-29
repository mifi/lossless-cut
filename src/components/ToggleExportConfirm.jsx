import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { MdEventNote } from 'react-icons/md';

import { primaryTextColor } from '../colors';
import useUserSettings from '../hooks/useUserSettings';


const ToggleExportConfirm = memo(({ size = 23, style }) => {
  const { t } = useTranslation();
  const { exportConfirmEnabled, toggleExportConfirmEnabled } = useUserSettings();

  return (
    <MdEventNote style={{ color: exportConfirmEnabled ? primaryTextColor : 'rgba(255,255,255,0.7)', ...style }} size={size} title={t('Show export options screen before exporting?')} role="button" onClick={toggleExportConfirmEnabled} />
  );
});

export default ToggleExportConfirm;
