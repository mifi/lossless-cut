import React, { memo } from 'react';
import { Button } from 'evergreen-ui';
import { useTranslation } from 'react-i18next';

import { withBlur } from '../util';
import useUserSettings from '../hooks/useUserSettings';


const MovFastStartButton = memo(() => {
  const { t } = useTranslation();
  const { movFastStart, toggleMovFastStart } = useUserSettings();

  return (
    <Button height={20} onClick={withBlur(toggleMovFastStart)}>
      {movFastStart ? t('Yes') : t('No')}
    </Button>
  );
});

export default MovFastStartButton;
