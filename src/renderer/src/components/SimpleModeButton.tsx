import { CSSProperties, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { FaBaby } from 'react-icons/fa';

import { primaryTextColor } from '../colors';
import useUserSettings from '../hooks/useUserSettings';


function SimpleModeButton({ size = 20, style }: { size?: number, style: CSSProperties }) {
  const { t } = useTranslation();
  const { simpleMode, toggleSimpleMode } = useUserSettings();

  return (
    <FaBaby
      title={t('Toggle advanced view')}
      size={size}
      style={{ color: simpleMode ? primaryTextColor : 'var(--gray-12)', ...style }}
      onClick={toggleSimpleMode}
    />
  );
}

export default memo(SimpleModeButton);
