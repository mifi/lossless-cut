import type { CSSProperties, MouseEventHandler } from 'react';
import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LuFileOutput, LuScissors } from 'react-icons/lu';

import useUserSettings from '../hooks/useUserSettings';
import type { SegmentToExport } from '../types';
import styles from './ExportButton.module.css';


interface Props {
  segmentsToExport: SegmentToExport[],
  areWeCutting: boolean,
  onClick: MouseEventHandler<HTMLButtonElement>,
  style?: CSSProperties,
}

// eslint-disable-next-line react/display-name
const ExportButton = forwardRef<HTMLButtonElement, Props>(({
  segmentsToExport,
  areWeCutting,
  onClick,
  style,
}, ref) => {
  const CutIcon = areWeCutting ? LuScissors : LuFileOutput;

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
      ref={ref}
      type="button"
      className={[...(simpleMode ? ['export-animation'] : []), styles['exportButton']].join(' ')}
      style={style}
      onClick={onClick}
      title={title}
    >
      <CutIcon style={{ flexShrink: 0 }} />
      {text}
    </button>
  );
});

export default ExportButton;
