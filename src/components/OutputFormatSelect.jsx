import React, { memo, useMemo } from 'react';
import i18n from 'i18next';
import fromPairs from 'lodash/fromPairs';

import allOutFormats from '../outFormats';
import { withBlur } from '../util';
import Select from './Select';

const commonFormats = ['mov', 'mp4', 'matroska', 'webm', 'mp3', 'ipod'];

function renderFormatOptions(map) {
  return Object.entries(map).map(([f, name]) => (
    <option key={f} value={f}>{f} - {name}</option>
  ));
}

const OutputFormatSelect = memo(({ style, detectedFileFormat, fileFormat, onOutputFormatUserChange }) => {
  const commonFormatsMap = useMemo(() => fromPairs(commonFormats.map(format => [format, allOutFormats[format]])
    .filter(([f]) => f !== detectedFileFormat)), [detectedFileFormat]);

  const otherFormatsMap = useMemo(() => fromPairs(Object.entries(allOutFormats)
    .filter(([f]) => ![...commonFormats, detectedFileFormat].includes(f))), [detectedFileFormat]);

  return (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <Select style={style} value={fileFormat || ''} title={i18n.t('Output format')} onChange={withBlur(e => onOutputFormatUserChange(e.target.value))}>
      <option key="disabled1" value="" disabled>{i18n.t('Format')}</option>

      {detectedFileFormat && (
        <option key={detectedFileFormat} value={detectedFileFormat}>
          {detectedFileFormat} - {allOutFormats[detectedFileFormat]} {i18n.t('(detected)')}
        </option>
      )}

      <option key="disabled2" value="" disabled>--- {i18n.t('Common formats:')} ---</option>
      {renderFormatOptions(commonFormatsMap)}

      <option key="disabled3" value="" disabled>--- {i18n.t('All formats:')} ---</option>
      {renderFormatOptions(otherFormatsMap)}
    </Select>
  );
});

export default OutputFormatSelect;
