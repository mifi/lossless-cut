import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import getSwal from '../swal';
import useUserSettings from '../hooks/useUserSettings';
import styles from './KeepRemoveToggle.module.css';


// Segmented replacement for the yin-yang "invert cut segments" button
function KeepRemoveToggle() {
  const { t } = useTranslation();
  const { invertCutSegments, setInvertCutSegments } = useUserSettings();

  const setInvert = useCallback((newVal: boolean) => {
    if (newVal === invertCutSegments) return;
    setInvertCutSegments(newVal);
    getSwal().toast.fire({
      title: newVal
        ? t('When you export, selected segments on the timeline will be REMOVED - the surrounding areas will be KEPT')
        : t('When you export, selected segments on the timeline will be KEPT - the surrounding areas will be REMOVED.'),
    });
  }, [invertCutSegments, setInvertCutSegments, t]);

  return (
    <div className={styles['toggle']} role="radiogroup">
      <button type="button" role="radio" aria-checked={!invertCutSegments} className={styles['option']} onClick={() => setInvert(false)} title={t('Keep selected segments')}>
        {t('Keep')}
      </button>
      <button type="button" role="radio" aria-checked={invertCutSegments} className={[styles['option'], styles['danger']].join(' ')} onClick={() => setInvert(true)} title={t('Discard selected segments')}>
        {t('Discard')}
      </button>
    </div>
  );
}

export default memo(KeepRemoveToggle);
