import React, { memo } from 'react';
import { Button, KeyIcon } from 'evergreen-ui';
import { useTranslation } from 'react-i18next';

import { withBlur } from '../util';


const KeyframeCutButton = memo(({ keyframeCut, onClick }) => {
  const { t } = useTranslation();

  return (
    <Button
      height={20}
      iconBefore={keyframeCut ? KeyIcon : undefined}
      title={`${t('Cut mode is:')} ${keyframeCut ? t('Keyframe cut') : t('Normal cut')}`}
      onClick={withBlur(onClick)}
    >
      {keyframeCut ? t('Keyframe cut') : t('Normal cut')}
    </Button>
  );
});

export default KeyframeCutButton;
