import type { CSSProperties } from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { FaBaby } from 'react-icons/fa';

import { primaryTextColor } from '../colors';
import useUserSettings from '../hooks/useUserSettings';


function SimpleModeButton({ style }: { style?: CSSProperties } = {}) {
  const { t } = useTranslation();
  const { simpleMode, toggleSimpleMode } = useUserSettings();

  return (
    <FaBaby
      title={t('Toggle advanced view')}
      style={{ fontSize: '1.2em', color: simpleMode ? primaryTextColor : 'var(--gray-12)', ...style }}
      onClick={toggleSimpleMode}
    />
  );
}

export default memo(SimpleModeButton);
