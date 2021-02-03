import React, { memo } from 'react';
import { Button } from 'evergreen-ui';
import { useTranslation } from 'react-i18next';

const ValueTuner = memo(({ style, title, value, setValue, onFinished, resolution = 1000, min = 0, max = 1, resetToDefault }) => {
  const { t } = useTranslation();

  function onChange(e) {
    e.target.blur();
    setValue(Math.min(Math.max(min, ((e.target.value / resolution) * (max - min)) + min)), max);
  }

  return (
    <div style={{ background: 'white', color: 'black', padding: 10, margin: 10, borderRadius: 10, width: '100%', maxWidth: 500, position: 'fixed', left: 0, zIndex: 10, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div>{title}</div>
        <div style={{ marginLeft: 10, fontWeight: 'bold' }}>{value.toFixed(2)}</div>
        <div style={{ flexGrow: 1 }} />
        <Button height={20} onClick={resetToDefault}>{t('Default')}</Button>
        <Button height={20} intent="success" onClick={onFinished}>{t('Done')}</Button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <input style={{ flexGrow: 1 }} type="range" min="0" max="1000" step="1" value={((value - min) / (max - min)) * resolution} onChange={onChange} />
      </div>
    </div>
  );
});

export default ValueTuner;
