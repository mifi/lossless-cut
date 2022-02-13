import React, { memo } from 'react';
import { BookmarkIcon, Button } from 'evergreen-ui';
import { useTranslation } from 'react-i18next';
import { MdCallSplit, MdCallMerge } from 'react-icons/md';

import { withBlur } from '../util';


const MergeExportButton = memo(({ autoMerge, enabledOutSegments, setAutoMerge, autoDeleteMergedSegments, setAutoDeleteMergedSegments, segmentsToChaptersOnly, setSegmentsToChaptersOnly }) => {
  const { t } = useTranslation();

  let AutoMergeIcon;

  let effectiveMode;
  let title;
  let description;

  if (segmentsToChaptersOnly) {
    effectiveMode = 'sesgments_to_chapters';
    title = t('Chapters only');
    AutoMergeIcon = BookmarkIcon;
    description = t('Don\'t cut the file, but instead export an unmodified original which has chapters generated from segments');
  } else if (autoMerge && autoDeleteMergedSegments) {
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
        setSegmentsToChaptersOnly(true);
        break;
      }
      case 'sesgments_to_chapters': {
        setAutoMerge(true);
        setAutoDeleteMergedSegments(true);
        setSegmentsToChaptersOnly(false);
        break;
      }
      default:
    }
  }

  return (
    <Button
      height={20}
      style={{ minWidth: 120, textAlign: 'center', opacity: enabledOutSegments && enabledOutSegments.length < 2 ? 0.4 : undefined }}
      title={description}
      onClick={withBlur(onClick)}
      iconBefore={AutoMergeIcon && (() => <AutoMergeIcon />)}
    >
      {title}
    </Button>
  );
});

export default MergeExportButton;
