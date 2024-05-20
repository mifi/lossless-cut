import { memo, useState, useCallback, CSSProperties } from 'react';
import { Button } from 'evergreen-ui';
import { useTranslation } from 'react-i18next';

import Switch from './Switch';


function ValueTuner({ style, title, value, setValue, onFinished, resolution = 1000, min: minIn = 0, max: maxIn = 1, resetToDefault }: {
  style?: CSSProperties, title: string, value: number, setValue: (string) => void, onFinished: () => void, resolution?: number, min?: number, max?: number, resetToDefault: () => void
}) {
  const { t } = useTranslation();

  const [min, setMin] = useState(minIn);
  const [max, setMax] = useState(maxIn);

  function onChange(e) {
    e.target.blur();
    setValue(Math.min(Math.max(min, ((e.target.value / resolution) * (max - min)) + min), max));
  }

  const isZoomed = !(min === minIn && max === maxIn);

  const toggleZoom = useCallback(() => {
    if (isZoomed) {
      setMin(minIn);
      setMax(maxIn);
    } else {
      const zoomWindow = (maxIn - minIn) / 100;
      setMin(Math.max(minIn, value - zoomWindow));
      setMax(Math.min(maxIn, value + zoomWindow));
    }
  }, [isZoomed, maxIn, minIn, value]);

  return (
    <div style={{ background: 'var(--gray1)', color: 'var(--gray12)', position: 'absolute', bottom: 0, padding: 10, margin: 10, borderRadius: 10, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', flexBasis: 400, marginBottom: '.2em' }}>
        <div>{title}</div>
        <div style={{ marginLeft: '.5em', fontWeight: 'bold', marginRight: '.5em', textDecoration: 'underline', fontFamily: 'monospace', width: '5em' }}>{value.toFixed(4)}</div>
        <Switch checked={isZoomed} onCheckedChange={toggleZoom} style={{ flexShrink: 0 }} /><span style={{ marginLeft: '.3em' }}>{t('Precise')}</span>
      </div>

      <div style={{ marginBottom: '.3em' }}>
        <input style={{ width: '100%' }} type="range" min="0" max="1000" step="1" value={((value - min) / (max - min)) * resolution} onChange={onChange} />
      </div>

      <div style={{ textAlign: 'right' }}>
        <Button height={20} onClick={resetToDefault}>{t('Default')}</Button>
        <Button height={20} intent="success" onClick={onFinished}>{t('Done')}</Button>
      </div>
    </div>
  );
}

export default memo(ValueTuner);
