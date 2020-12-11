import React, { memo } from 'react';
import { Button } from 'evergreen-ui';
import { useTranslation } from 'react-i18next';

import { withBlur } from '../util';


const MovFastStartButton = memo(({ movFastStart, toggleMovFastStart }) => {
  const { t } = useTranslation();

  return (
    <Button height={20} onClick={withBlur(toggleMovFastStart)}>
      {movFastStart ? t('Yes') : t('No')}
    </Button>
  );
});

export default MovFastStartButton;
