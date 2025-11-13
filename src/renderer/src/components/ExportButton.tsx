import { CSSProperties, memo } from 'react';
import { FiScissors } from 'react-icons/fi';
import { FaFileExport } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

import { primaryColor } from '../colors';
import useUserSettings from '../hooks/useUserSettings';
import { SegmentToExport } from '../types';


function ExportButton({ segmentsToExport, areWeCutting, onClick, style }: {
  segmentsToExport: SegmentToExport[],
  areWeCutting: boolean,
  onClick: () => void,
  style?: CSSProperties,
}) {
  const CutIcon = areWeCutting ? FiScissors : FaFileExport;

  const { t } = useTranslation();

  const { autoMerge, simpleMode } = useUserSettings();

  let title = t('Export');
  if (segmentsToExport.length === 1) {
    title = t('Export selection');
  } else if (segmentsToExport.length > 1) {
    title = t('Export {{ num }} segments', { num: segmentsToExport.length });
  }

  const text = autoMerge && segmentsToExport && segmentsToExport.length > 1 ? t('Export+merge') : t('Export');

  return (
    <button
      type="button"
      className={simpleMode ? 'export-animation' : undefined}
      style={{ all: 'unset', cursor: 'pointer', background: primaryColor, color: 'white', borderRadius: '.3em', paddingBottom: '.1em', paddingLeft: '.2em', paddingRight: '.2em', whiteSpace: 'nowrap', ...style }}
      onClick={onClick}
      title={title}
    >
      <CutIcon
        style={{ verticalAlign: 'middle', marginRight: '.2em' }}
      />
      {text}
    </button>
  );
}

export default memo(ExportButton);
