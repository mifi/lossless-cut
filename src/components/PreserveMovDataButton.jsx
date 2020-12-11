import React, { memo } from 'react';
import { Button } from 'evergreen-ui';
import { useTranslation } from 'react-i18next';

import { withBlur } from '../util';


const PreserveMovDataButton = memo(({ preserveMovData, togglePreserveMovData }) => {
  const { t } = useTranslation();

  return (
    <Button height={20} onClick={withBlur(togglePreserveMovData)}>
      {preserveMovData ? t('Yes') : t('No')}
    </Button>
  );
});

export default PreserveMovDataButton;
