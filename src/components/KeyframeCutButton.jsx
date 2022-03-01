import React, { memo } from 'react';
import { Button, KeyIcon } from 'evergreen-ui';
import { useTranslation } from 'react-i18next';

import { withBlur } from '../util';
import useUserSettings from '../hooks/useUserSettings';


const KeyframeCutButton = memo(() => {
  const { t } = useTranslation();
  const { keyframeCut, toggleKeyframeCut } = useUserSettings();

  return (
    <Button
      height={20}
      iconBefore={keyframeCut ? KeyIcon : undefined}
      title={`${t('Cut mode is:')} ${keyframeCut ? t('Keyframe cut') : t('Normal cut')}`}
      onClick={withBlur(() => toggleKeyframeCut(false))}
    >
      {keyframeCut ? t('Keyframe cut') : t('Normal cut')}
    </Button>
  );
});

export default KeyframeCutButton;
