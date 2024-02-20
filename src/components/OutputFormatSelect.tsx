import { CSSProperties, memo, useMemo } from 'react';
import i18n from 'i18next';

import allOutFormats from '../outFormats';
import { withBlur } from '../util';
import Select from './Select';

const commonVideoAudioFormats = ['matroska', 'mov', 'mp4', 'mpegts', 'ogv', 'webm'];
const commonAudioFormats = ['flac', 'ipod', 'mp3', 'oga', 'ogg', 'opus', 'wav'];
const commonSubtitleFormats = ['ass', 'srt', 'sup', 'webvtt'];

function renderFormatOptions(formats) {
  return formats.map((format) => (
    <option key={format} value={format}>{format} - {allOutFormats[format]}</option>
  ));
}

const OutputFormatSelect = memo(({ style, detectedFileFormat, fileFormat, onOutputFormatUserChange }: {
  style: CSSProperties, detectedFileFormat?: string, fileFormat?: string, onOutputFormatUserChange: (a: string) => void,
}) => {
  const commonVideoAudioFormatsExceptDetectedFormat = useMemo(() => commonVideoAudioFormats.filter((f) => f !== detectedFileFormat), [detectedFileFormat]);
  const commonAudioFormatsExceptDetectedFormat = useMemo(() => commonAudioFormats.filter((f) => f !== detectedFileFormat), [detectedFileFormat]);
  const commonSubtitleFormatsExceptDetectedFormat = useMemo(() => commonSubtitleFormats.filter((f) => f !== detectedFileFormat), [detectedFileFormat]);
  const commonFormatsAndDetectedFormat = useMemo(() => new Set([...commonVideoAudioFormats, ...commonAudioFormats, commonSubtitleFormats, detectedFileFormat]), [detectedFileFormat]);

  const otherFormats = useMemo(() => Object.keys(allOutFormats).filter((format) => !commonFormatsAndDetectedFormat.has(format)), [commonFormatsAndDetectedFormat]);

  return (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <Select style={style} value={fileFormat || ''} title={i18n.t('Output container format:')} onChange={withBlur((e) => onOutputFormatUserChange(e.target.value))}>
      <option key="disabled1" value="" disabled>{i18n.t('Output container format:')}</option>

      {detectedFileFormat && (
        <option key={detectedFileFormat} value={detectedFileFormat}>
          {detectedFileFormat} - {allOutFormats[detectedFileFormat]} {i18n.t('(detected)')}
        </option>
      )}

      <option key="disabled2" value="" disabled>--- {i18n.t('Common video/audio formats:')} ---</option>
      {renderFormatOptions(commonVideoAudioFormatsExceptDetectedFormat)}

      <option key="disabled3" value="" disabled>--- {i18n.t('Common audio formats:')} ---</option>
      {renderFormatOptions(commonAudioFormatsExceptDetectedFormat)}

      <option key="disabled4" value="" disabled>--- {i18n.t('Common subtitle formats:')} ---</option>
      {renderFormatOptions(commonSubtitleFormatsExceptDetectedFormat)}

      <option key="disabled5" value="" disabled>--- {i18n.t('All other formats:')} ---</option>
      {renderFormatOptions(otherFormats)}
    </Select>
  );
});

export default OutputFormatSelect;
