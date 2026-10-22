import type { CSSProperties } from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { withBlur } from '../util';
import useUserSettings from '../hooks/useUserSettings';
import Select from './Select';
import type { BatchExportMode } from '../../../common/types';


function BatchExportModeSelect({ style }: { style?: CSSProperties }) {
  const { t } = useTranslation();

  const { batchExportMode, setBatchExportMode } = useUserSettings();

  return (
    <Select
      style={style}
      value={batchExportMode}
      onChange={withBlur((e) => setBatchExportMode(e.target.value as BatchExportMode))}
    >
      <option value="separate">{t('Separate files')}</option>
      <option value="merge">{t('Merge cuts')}</option>
      <option value="merge+separate">{t('Merge & Separate')}</option>
    </Select>
  );
}

export default memo(BatchExportModeSelect);
