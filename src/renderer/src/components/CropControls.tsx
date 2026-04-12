import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Select from './Select';
import type { CropRect } from '../types';

const cropPresets = [
  { label: '16:9', ratio: 16 / 9 },
  { label: '4:3', ratio: 4 / 3 },
  { label: '1:1', ratio: 1 },
  { label: '9:16', ratio: 9 / 16 },
  { label: '21:9', ratio: 21 / 9 },
  { label: '2.35:1', ratio: 2.35 },
] as const;

// Ensure value is even (required by most video encoders)
const toEven = (n: number) => Math.floor(n / 2) * 2;

function computeCropFromRatio(ratio: number, sourceW: number, sourceH: number): CropRect {
  // Compute the largest output frame at this ratio, centered on the source
  let w: number;
  let h: number;

  if (ratio >= sourceW / sourceH) {
    // Output is wider than source — width-constrained, will need side padding or match source width
    w = sourceW;
    h = Math.round(sourceW / ratio);
  } else {
    // Output is taller than source
    h = sourceH;
    w = Math.round(sourceH * ratio);
  }

  w = toEven(w);
  h = toEven(h);

  const x = Math.round((sourceW - w) / 2);
  const y = Math.round((sourceH - h) / 2);

  return { x, y, w, h };
}

function CropControls({ crop, sourceVideoResolution, onCropChange, onReset, onApplyToAll, segmentCount }: {
  crop: CropRect,
  sourceVideoResolution: { width: number, height: number },
  onCropChange: (crop: CropRect) => void,
  onReset: () => void,
  onApplyToAll: () => void,
  segmentCount: number,
}) {
  const { t } = useTranslation();

  const handlePresetChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '') return;
    const preset = cropPresets.find((p) => p.label === val);
    if (!preset) return;
    const newCrop = computeCropFromRatio(preset.ratio, sourceVideoResolution.width, sourceVideoResolution.height);
    onCropChange(newCrop);
  }, [sourceVideoResolution, onCropChange]);

  const handleFieldChange = useCallback((field: keyof CropRect, value: string) => {
    const num = parseInt(value, 10);
    if (Number.isNaN(num)) return;
    onCropChange({ ...crop, [field]: num });
  }, [crop, onCropChange]);

  // Determine which preset matches the current crop
  const currentPreset = cropPresets.find((p) => {
    const expected = computeCropFromRatio(p.ratio, sourceVideoResolution.width, sourceVideoResolution.height);
    return expected.w === crop.w && expected.h === crop.h && expected.x === crop.x && expected.y === crop.y;
  });

  const inputStyle = { width: '4em', textAlign: 'center' as const, marginLeft: '0.2em', marginRight: '0.5em' };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em', padding: '0.3em 0.6em', fontSize: '0.85em', color: 'var(--gray-12)' }}>
      <span>{t('Crop')}</span>

      <Select
        value={currentPreset?.label ?? ''}
        onChange={handlePresetChange}
        style={{ width: '5em' }}
      >
        <option value="" disabled>{t('Preset')}</option>
        {cropPresets.map(({ label }) => (
          <option key={label} value={label}>{label}</option>
        ))}
      </Select>

      <span style={{ fontSize: '0.8em' }}>
        X<input type="number" value={crop.x} onChange={(e) => handleFieldChange('x', e.target.value)} style={inputStyle} />
        Y<input type="number" value={crop.y} onChange={(e) => handleFieldChange('y', e.target.value)} style={inputStyle} />
        W<input type="number" value={crop.w} onChange={(e) => handleFieldChange('w', e.target.value)} style={inputStyle} min={16} />
        H<input type="number" value={crop.h} onChange={(e) => handleFieldChange('h', e.target.value)} style={inputStyle} min={16} />
      </span>

      {segmentCount > 1 && (
        <button type="button" onClick={onApplyToAll} style={{ fontSize: '0.85em', padding: '0.1em 0.4em' }}>
          {t('Apply to all segments')}
        </button>
      )}

      <button type="button" onClick={onReset} style={{ fontSize: '0.85em', padding: '0.1em 0.4em' }}>
        {t('Reset')}
      </button>
    </div>
  );
}

export default memo(CropControls);
export { computeCropFromRatio, cropPresets };
