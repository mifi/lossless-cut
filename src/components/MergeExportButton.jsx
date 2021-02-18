import React, { memo } from 'react';
import { Button } from 'evergreen-ui';
import { useTranslation } from 'react-i18next';
import { MdCallSplit, MdCallMerge } from 'react-icons/md';

import { withBlur } from '../util';


const MergeExportButton = memo(({ autoMerge, outSegments, setAutoMerge, autoDeleteMergedSegments, setAutoDeleteMergedSegments }) => {
  const { t } = useTranslation();

  let AutoMergeIcon;

  let effectiveMode;
  let title;
  let description;
  if (autoMerge && autoDeleteMergedSegments) {
    effectiveMode = 'merge';
    AutoMergeIcon = MdCallMerge;
    title = t('Merge cuts');
    description = t('Auto merge segments to one file after export');
  } else if (autoMerge) {
    effectiveMode = 'merge+separate';
    title = t('Merge & Separate');
    description = t('Auto merge segments to one file after export, but keep segments too');
  } else {
    effectiveMode = 'separate';
    AutoMergeIcon = MdCallSplit;
    title = t('Separate files');
    description = t('Export to separate files');
  }

  function onClick() {
    switch (effectiveMode) {
      case 'merge': {
        setAutoDeleteMergedSegments(false);
        break;
      }
      case 'merge+separate': {
        setAutoMerge(false);
        break;
      }
      case 'separate': {
        setAutoMerge(true);
        setAutoDeleteMergedSegments(true);
        break;
      }
      default:
    }
  }

  return (
    <Button
      height={20}
      style={{ opacity: outSegments && outSegments.length < 2 ? 0.4 : undefined }}
      title={description}
      onClick={withBlur(onClick)}
    >
      {AutoMergeIcon && <AutoMergeIcon />} {title}
    </Button>
  );
});

export default MergeExportButton;
