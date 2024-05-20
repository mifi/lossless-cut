import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ForkIcon, DisableIcon } from 'evergreen-ui';

import useUserSettings from '../hooks/useUserSettings';

function AutoExportToggler() {
  const { t } = useTranslation();
  const { autoExportExtraStreams, setAutoExportExtraStreams } = useUserSettings();

  return (
    <Button intent={autoExportExtraStreams ? 'success' : 'danger'} iconBefore={autoExportExtraStreams ? ForkIcon : DisableIcon} onClick={() => setAutoExportExtraStreams(!autoExportExtraStreams)}>
      {autoExportExtraStreams ? t('Extract') : t('Discard')}
    </Button>
  );
}

export default memo(AutoExportToggler);
