import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { FaBaby } from 'react-icons/fa';

import { primaryTextColor } from '../colors';


const SimpleModeButton = memo(({ simpleMode, toggleSimpleMode, size = 20, style }) => {
  const { t } = useTranslation();

  return (
    <FaBaby
      title={t('Toggle advanced view')}
      size={size}
      style={{ color: simpleMode ? primaryTextColor : 'white', ...style }}
      onClick={toggleSimpleMode}
    />
  );
});

export default SimpleModeButton;
