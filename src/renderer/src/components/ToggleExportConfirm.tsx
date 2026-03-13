import type { CSSProperties } from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { MdEventNote } from 'react-icons/md';
import { FaCheck } from 'react-icons/fa';

import useUserSettings from '../hooks/useUserSettings';
import styles from './ToggleExportConfirm.module.css';


function ToggleExportConfirm({ size = 23, style }: { size?: string | number | undefined, style?: CSSProperties }) {
  const { t } = useTranslation();
  const { exportConfirmEnabled, toggleExportConfirmEnabled } = useUserSettings();

  return (
    <button
      type="button"
      data-checked={exportConfirmEnabled || undefined}
      className={styles['toggle']}
      style={style}
      title={t('Show export options screen before exporting?')}
      onClick={toggleExportConfirmEnabled}
    >
      <MdEventNote className={styles['icon']} size={size} />
      <span className={styles['text']}>
        <span className={styles['label']}>{t('Show export options screen before exporting?')}</span>
      </span>
      {/* The trailing check keeps the state legible even when the control is rendered in a tight action row. */}
      <span className={styles['check']}><FaCheck size={11} /></span>
    </button>
  );
}

export default memo(ToggleExportConfirm);
