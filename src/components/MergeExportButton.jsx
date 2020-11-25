import React, { memo } from 'react';
import { Button } from 'evergreen-ui';
import { useTranslation } from 'react-i18next';
import { MdCallSplit, MdCallMerge } from 'react-icons/md';

import { withBlur } from '../util';


const MergeExportButton = memo(({ autoMerge, outSegments, toggleAutoMerge }) => {
  const { t } = useTranslation();

  const AutoMergeIcon = autoMerge ? MdCallMerge : MdCallSplit;

  return (
    <Button
      height={20}
      style={{ opacity: outSegments && outSegments.length < 2 ? 0.4 : undefined }}
      title={autoMerge ? t('Auto merge segments to one file after export') : t('Export to separate files')}
      onClick={withBlur(toggleAutoMerge)}
    >
      <AutoMergeIcon /> {autoMerge ? t('Merge cuts') : t('Separate files')}
    </Button>
  );
});

export default MergeExportButton;
