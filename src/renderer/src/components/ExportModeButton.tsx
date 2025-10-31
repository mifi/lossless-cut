import { CSSProperties, memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { withBlur } from '../util';
import useUserSettings from '../hooks/useUserSettings';
import Select from './Select';
import { ExportMode } from '../types';


function ExportModeButton({ selectedSegments, style }: { selectedSegments: unknown[], style?: CSSProperties }) {
  const { t } = useTranslation();

  const { effectiveExportMode, setAutoMerge, setAutoDeleteMergedSegments, setSegmentsToChaptersOnly } = useUserSettings();

  function onChange(newMode: ExportMode) {
    switch (newMode) {
      case 'segments_to_chapters': {
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

  const selectableModes = useMemo(() => [
    'separate' as const,
    ...(selectedSegments.length >= 2 || effectiveExportMode === 'merge' ? ['merge'] as const : []),
    ...(selectedSegments.length >= 2 || effectiveExportMode === 'merge+separate' ? ['merge+separate'] as const : []),
    'segments_to_chapters' as const,
  ], [effectiveExportMode, selectedSegments.length]);

  return (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <Select
      style={style}
      value={effectiveExportMode}
      onChange={withBlur((e) => onChange(e.target.value as ExportMode))}
    >
      <option key="disabled" value="" disabled>{t('Export mode')}</option>

      {selectableModes.map((mode) => {
        const titles = {
          segments_to_chapters: t('Segments to chapters'),
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
}

export default memo(ExportModeButton);
