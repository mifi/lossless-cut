import React, { memo } from 'react';
import { Select } from 'evergreen-ui';
import { useTranslation } from 'react-i18next';

import { withBlur } from '../util';
import useUserSettings from '../hooks/useUserSettings';

const ExportModeButton = memo(({ selectedSegments, style }) => {
  const { t } = useTranslation();

  const { effectiveExportMode, setAutoMerge, setAutoDeleteMergedSegments, setSegmentsToChaptersOnly } = useUserSettings();

  function onChange(newMode) {
    switch (newMode) {
      case 'sesgments_to_chapters': {
        setAutoMerge(false);
        setAutoDeleteMergedSegments(false);
        setSegmentsToChaptersOnly(true);
        break;
      }
      case 'merge': {
        setAutoMerge(true);
        setAutoDeleteMergedSegments(true);
        setSegmentsToChaptersOnly(false);
        break;
      }
      case 'merge+separate': {
        setAutoMerge(true);
        setAutoDeleteMergedSegments(false);
        setSegmentsToChaptersOnly(false);
        break;
      }
      case 'separate': {
        setAutoMerge(false);
        setAutoDeleteMergedSegments(false);
        setSegmentsToChaptersOnly(false);
        break;
      }
      default:
    }
  }

  return (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <Select
      height={20}
      style={{ opacity: selectedSegments && selectedSegments.length < 2 ? 0.4 : undefined, ...style }}
      value={effectiveExportMode}
      onChange={withBlur((e) => onChange(e.target.value))}
    >
      {['separate', 'merge', 'merge+separate', 'sesgments_to_chapters'].map((mode) => {
        const titles = {
          sesgments_to_chapters: t('Chapters only'),
          merge: t('Merge cuts'),
          'merge+separate': t('Merge & Separate'),
          separate: t('Separate files'),
          description: t('Export to separate files'),
        };

        const title = titles[mode];

        return (
          <option key={mode} value={mode}>{title}</option>
        );
      })}
    </Select>
  );
});

export default ExportModeButton;
