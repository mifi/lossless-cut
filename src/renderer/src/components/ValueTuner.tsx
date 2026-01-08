import type { ChangeEventHandler } from 'react';
import { memo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './ValueTuner.module.css';

import Switch from './Switch';
import Button from './Button';
import { primaryColor } from '../colors';


function ValueTuner({ title, value, setValue, onFinished, resolution, decimals, min: minIn = 0, max: maxIn = 1, resetToDefault }: {
  title: string,
  value: number,
  setValue: (v: number) => void,
  onFinished: () => void,
  resolution: number,
  decimals: number,
  min?: number,
  max?: number,
  resetToDefault: () => void,
}) {
  const { t } = useTranslation();

  const [min, setMin] = useState(minIn);
  const [max, setMax] = useState(maxIn);

  const onChange = useCallback<ChangeEventHandler<HTMLInputElement>>((e) => {
    e.target.blur();
    setValue(Math.min(Math.max(min, ((Number(e.target.value) / resolution) * (max - min)) + min), max));
  }, [max, min, resolution, setValue]);

  const isZoomed = !(min === minIn && max === maxIn);

  const resetZoom = useCallback(() => {
    setMin(minIn);
    setMax(maxIn);
  }, [maxIn, minIn]);

  const toggleZoom = useCallback(() => {
    if (isZoomed) {
      resetZoom();
    } else {
      const zoomWindow = (maxIn - minIn) / 100;
      setMin(Math.max(minIn, value - zoomWindow));
      setMax(Math.min(maxIn, value + zoomWindow));
    }
  }, [isZoomed, maxIn, minIn, resetZoom, value]);

  const handleResetToDefaultClick = useCallback(() => {
    resetToDefault();
    resetZoom();
  }, [resetToDefault, resetZoom]);

  return (
    <div className={styles['value-tuner']}>
      <div style={{ display: 'flex', alignItems: 'center', flexBasis: 400, marginBottom: '.3em' }}>
        <div>{title}</div>
        <div style={{ marginLeft: '.6em', fontSize: '1.3em', marginRight: '.5em', fontFamily: 'monospace', width: '5.5em' }}>{value.toFixed(decimals)}</div>
        <Switch checked={isZoomed} onCheckedChange={toggleZoom} style={{ flexShrink: 0 }} /><span style={{ marginLeft: '.3em' }}>{t('Precise')}</span>
      </div>

      <div style={{ marginBottom: '.3em' }}>
        <input style={{ width: '100%' }} type="range" min="0" max="1000" step="1" value={((value - min) / (max - min)) * resolution} onChange={onChange} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '.3em' }}>
        <Button onClick={handleResetToDefaultClick}>{t('Default')}</Button>
        <Button onClick={onFinished} style={{ backgroundColor: primaryColor, color: 'white' }}>{t('Done')}</Button>
      </div>
    </div>
  );
}

export default memo(ValueTuner);
