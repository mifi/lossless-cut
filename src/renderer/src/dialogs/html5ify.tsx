import { useState, useCallback, ChangeEventHandler } from 'react';
import i18n from 'i18next';

import { ReactSwal } from '../swal';
import { Html5ifyMode } from '../../../../types';
import Checkbox from '../components/Checkbox';


// eslint-disable-next-line import/prefer-default-export
export async function askForHtml5ifySpeed({ allowedOptions, showRemember, initialOption }: {
  allowedOptions: Html5ifyMode[],
  showRemember?: boolean | undefined,
  initialOption?: Html5ifyMode | undefined,
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

  function AskForHtml5ifySpeed() {
    const [option, setOption] = useState(selectedOption);
    const [remember, setRemember] = useState(rememberChoice);

    const onOptionChange = useCallback<ChangeEventHandler<HTMLInputElement>>((e) => {
      selectedOption = e.currentTarget.value as Html5ifyMode;
      setOption(selectedOption);
    }, []);

    const onRememberChange = useCallback((checked: boolean) => {
      rememberChoice = checked;
      setRemember(rememberChoice);
    }, []);

    return (
      <div style={{ textAlign: 'left' }}>
        <p>{i18n.t('These options will let you convert files to a format that is supported by the player. You can try different options and see which works with your file. Note that the conversion is for preview only. When you run an export, the output will still be lossless with full quality')}</p>

        {Object.entries(inputOptions).map(([value, label]) => {
          const id = `html5ify-${value}`;
          return (
            <div key={value}>
              <input
                id={id}
                type="radio"
                name="html5ify-speed"
                value={value}
                checked={option === value}
                onChange={onOptionChange}
              />
              {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
              <label htmlFor={id} style={{ marginLeft: '.5em' }}>{label}</label>
            </div>
          );
        })}

        {showRemember && <Checkbox checked={remember} onCheckedChange={onRememberChange} label={i18n.t('Use this for all files until LosslessCut is restarted?')} style={{ marginTop: '.5em' }} />}
      </div>
    );
  }

  const { value: response } = await ReactSwal.fire({
    title: i18n.t('Convert to supported format'),
    html: <AskForHtml5ifySpeed />,
    showCancelButton: true,
  });

  return {
    selectedOption: response != null ? selectedOption : undefined,
    remember: rememberChoice,
  };
}
