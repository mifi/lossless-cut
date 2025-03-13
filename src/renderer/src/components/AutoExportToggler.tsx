import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ForkIcon, DisableIcon } from 'evergreen-ui';

import useUserSettings from '../hooks/useUserSettings';
import Button from './Button';

function AutoExportToggler() {
  const { t } = useTranslation();
  const { autoExportExtraStreams, setAutoExportExtraStreams } = useUserSettings();

  const Icon = autoExportExtraStreams ? ForkIcon : DisableIcon;

  return (
    <Button style={{ padding: '0.3em 1em' }} onClick={() => setAutoExportExtraStreams(!autoExportExtraStreams)}>
      <Icon verticalAlign="middle" marginRight=".5em" />{autoExportExtraStreams ? t('Extract') : t('Discard')}
    </Button>
  );
}

export default memo(AutoExportToggler);
