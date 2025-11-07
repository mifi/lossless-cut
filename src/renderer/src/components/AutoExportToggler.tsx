import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { FaBan, FaFileExport } from 'react-icons/fa';

import useUserSettings from '../hooks/useUserSettings';
import Button from './Button';
import { dangerColor } from '../colors';

function AutoExportToggler() {
  const { t } = useTranslation();
  const { autoExportExtraStreams, setAutoExportExtraStreams } = useUserSettings();

  const Icon = autoExportExtraStreams ? FaFileExport : FaBan;

  return (
    <Button style={{ padding: '0.3em 1em' }} onClick={() => setAutoExportExtraStreams(!autoExportExtraStreams)}>
      <Icon style={{ verticalAlign: 'middle', marginRight: '.5em', color: autoExportExtraStreams ? undefined : dangerColor }} />{autoExportExtraStreams ? t('Extract') : t('Discard')}
    </Button>
  );
}

export default memo(AutoExportToggler);
