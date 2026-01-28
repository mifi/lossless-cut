import type { CSSProperties } from 'react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { FfmpegFormat } from '../outFormats';
import allOutFormats from '../outFormats';
import { withBlur } from '../util';
import Select from './Select';

const commonVideoAudioFormats = ['matroska', 'mov', 'mp4', 'mpegts', 'ogv', 'webm'] as const;
const commonAudioFormats = ['flac', 'ipod', 'mp3', 'oga', 'ogg', 'opus', 'wav'] as const;
const commonSubtitleFormats = ['ass', 'srt', 'sup', 'webvtt'] as const;

function renderFormatOptions(formats: FfmpegFormat[]) {
  return formats.map((format) => (
    <option key={format} value={format}>{format} - {allOutFormats[format]}</option>
  ));
}

function OutputFormatSelect({ style, disabled, detectedFileFormat, fileFormat, onOutputFormatUserChange }: {
  style: CSSProperties,
  disabled?: boolean,
  detectedFileFormat?: string | undefined,
  fileFormat?: string | undefined,
  onOutputFormatUserChange: (a: string) => void,
}) {
  const { t } = useTranslation();

  const commonVideoAudioFormatsExceptDetectedFormat = useMemo(() => commonVideoAudioFormats.filter((f) => f !== detectedFileFormat), [detectedFileFormat]);
  const commonAudioFormatsExceptDetectedFormat = useMemo(() => commonAudioFormats.filter((f) => f !== detectedFileFormat), [detectedFileFormat]);
  const commonSubtitleFormatsExceptDetectedFormat = useMemo(() => commonSubtitleFormats.filter((f) => f !== detectedFileFormat), [detectedFileFormat]);
  const commonFormatsAndDetectedFormat = useMemo(() => new Set([...commonVideoAudioFormats, ...commonAudioFormats, commonSubtitleFormats, detectedFileFormat]), [detectedFileFormat]);

  const otherFormats = useMemo(() => (Object.keys(allOutFormats) as (keyof typeof allOutFormats)[]).filter((format) => !commonFormatsAndDetectedFormat.has(format)), [commonFormatsAndDetectedFormat]);

  return (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <Select style={style} disabled={disabled} value={fileFormat || ''} title={t('Output container format:')} onChange={withBlur((e) => onOutputFormatUserChange(e.target.value))}>
      <option key="disabled1" value="" disabled>{t('Output container format:')}</option>

      {detectedFileFormat && (
        <option key={detectedFileFormat} value={detectedFileFormat}>
          {detectedFileFormat} - {(allOutFormats as Record<string, string>)[detectedFileFormat]} {t('(detected)')}
        </option>
      )}

      <option key="disabled2" value="" disabled>--- {t('Common video/audio formats:')} ---</option>
      {renderFormatOptions(commonVideoAudioFormatsExceptDetectedFormat)}

      <option key="disabled3" value="" disabled>--- {t('Common audio formats:')} ---</option>
      {renderFormatOptions(commonAudioFormatsExceptDetectedFormat)}

      <option key="disabled4" value="" disabled>--- {t('Common subtitle formats:')} ---</option>
      {renderFormatOptions(commonSubtitleFormatsExceptDetectedFormat)}

      <option key="disabled5" value="" disabled>--- {t('All other formats:')} ---</option>
      {renderFormatOptions(otherFormats)}
    </Select>
  );
}

export default memo(OutputFormatSelect);
