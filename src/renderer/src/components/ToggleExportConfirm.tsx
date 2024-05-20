import { CSSProperties, memo } from 'react';
import { useTranslation } from 'react-i18next';

import { MdEventNote } from 'react-icons/md';

import { primaryTextColor } from '../colors';
import useUserSettings from '../hooks/useUserSettings';


function ToggleExportConfirm({ size = 23, style }: { size?: number | undefined, style?: CSSProperties }) {
  const { t } = useTranslation();
  const { exportConfirmEnabled, toggleExportConfirmEnabled } = useUserSettings();

  return (
    <MdEventNote style={{ color: exportConfirmEnabled ? primaryTextColor : 'var(--gray11)', ...style }} size={size} title={t('Show export options screen before exporting?')} role="button" onClick={toggleExportConfirmEnabled} />
  );
}

export default memo(ToggleExportConfirm);
