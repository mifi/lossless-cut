import { useState, useCallback } from 'react';
import { Checkbox, RadioGroup, Paragraph } from 'evergreen-ui';
import i18n from 'i18next';
import withReactContent from 'sweetalert2-react-content';

import Swal from '../swal';
import { Html5ifyMode } from '../types';


const ReactSwal = withReactContent(Swal);


// eslint-disable-next-line import/prefer-default-export
export async function askForHtml5ifySpeed({ allowedOptions, showRemember, initialOption }: {
  allowedOptions: Html5ifyMode[], showRemember?: boolean | undefined, initialOption?: Html5ifyMode | undefined
}) {
  const availOptions: Record<Html5ifyMode, string> = {
    fastest: i18n.t('Fastest: FFmpeg-assisted playback'),
    fast: i18n.t('Fast: Full quality remux (no audio), likely to fail'),
    'fast-audio-remux': i18n.t('Fast: Full quality remux, likely to fail'),
    'fast-audio': i18n.t('Fast: Remux video, encode audio (fails if unsupported video codec)'),
    slow: i18n.t('Slow: Low quality encode (no audio)'),
    'slow-audio': i18n.t('Slow: Low quality encode'),
    slowest: i18n.t('Slowest: High quality encode'),
  };
  const inputOptions: Partial<Record<Html5ifyMode, string>> = {};
  allowedOptions.forEach((allowedOption) => {
    inputOptions[allowedOption] = availOptions[allowedOption];
  });

  let selectedOption: Html5ifyMode = initialOption != null && inputOptions[initialOption] ? initialOption : Object.keys(inputOptions)[0]! as Html5ifyMode;
  let rememberChoice = !!initialOption;

  const Html = () => {
    const [option, setOption] = useState(selectedOption);
    const [remember, setRemember] = useState(rememberChoice);
    const onOptionChange = useCallback((e) => {
      selectedOption = e.target.value;
      setOption(selectedOption);
    }, []);
    const onRememberChange = useCallback((e) => {
      rememberChoice = e.target.checked;
      setRemember(rememberChoice);
    }, []);
    return (
      <div style={{ textAlign: 'left' }}>
        <Paragraph>{i18n.t('These options will let you convert files to a format that is supported by the player. You can try different options and see which works with your file. Note that the conversion is for preview only. When you run an export, the output will still be lossless with full quality')}</Paragraph>
        <RadioGroup
          options={Object.entries(inputOptions).map(([value, label]) => ({ label, value }))}
          value={option}
          onChange={onOptionChange}
        />
        {showRemember && <Checkbox checked={remember} onChange={onRememberChange} label={i18n.t('Use this for all files until LosslessCut is restarted?')} />}
      </div>
    );
  };

  const { value: response } = await ReactSwal.fire({
    title: i18n.t('Convert to supported format'),
    html: <Html />,
    showCancelButton: true,
  });

  return {
    selectedOption: response != null ? selectedOption : undefined,
    remember: rememberChoice,
  };
}
