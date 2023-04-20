import React, { useState, useCallback } from 'react';
import { Checkbox, RadioGroup, Paragraph } from 'evergreen-ui';
import i18n from 'i18next';
import withReactContent from 'sweetalert2-react-content';

import Swal from '../swal';


const ReactSwal = withReactContent(Swal);


// eslint-disable-next-line import/prefer-default-export
export async function askForHtml5ifySpeed({ allowedOptions, showRemember, initialOption }) {
  const availOptions = {
    fastest: i18n.t('Fastest: Low playback speed (no audio)'),
    'fastest-audio': i18n.t('Fastest: Low playback speed'),
    'fastest-audio-remux': i18n.t('Fastest: Low playback speed (audio remux), likely to fail'),
    fast: i18n.t('Fast: Full quality remux (no audio), likely to fail'),
    'fast-audio-remux': i18n.t('Fast: Full quality remux, likely to fail'),
    'fast-audio': i18n.t('Fast: Remux video, encode audio (fails if unsupported video codec)'),
    slow: i18n.t('Slow: Low quality encode (no audio)'),
    'slow-audio': i18n.t('Slow: Low quality encode'),
    slowest: i18n.t('Slowest: High quality encode'),
  };
  const inputOptions = {};
  allowedOptions.forEach((allowedOption) => {
    inputOptions[allowedOption] = availOptions[allowedOption];
  });

  let selectedOption = inputOptions[initialOption] ? initialOption : Object.keys(inputOptions)[0];
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
    selectedOption: response && selectedOption,
    remember: rememberChoice,
  };
}
