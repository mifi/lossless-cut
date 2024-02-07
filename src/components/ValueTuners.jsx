import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';

import ValueTuner from './ValueTuner';
import useUserSettings from '../hooks/useUserSettings';

const ValueTuners = memo(({ type, onFinished }) => {
  const { t } = useTranslation();
  const { wheelSensitivity, setWheelSensitivity, keyboardNormalSeekSpeed, setKeyboardNormalSeekSpeed, keyboardSeekAccFactor, setKeyboardSeekAccFactor } = useUserSettings();

  // NOTE default values are duplicated in public/configStore.js
  const types = {
    wheelSensitivity: {
      title: t('Timeline trackpad/wheel sensitivity'),
      value: wheelSensitivity,
      setValue: setWheelSensitivity,
      min: 0,
      max: 4,
      default: 0.2,
    },
    keyboardNormalSeekSpeed: {
      title: t('Timeline keyboard seek speed'),
      value: keyboardNormalSeekSpeed,
      setValue: setKeyboardNormalSeekSpeed,
      min: 0,
      max: 100,
      default: 1,
    },
    keyboardSeekAccFactor: {
      title: t('Timeline keyboard seek acceleration'),
      value: keyboardSeekAccFactor,
      setValue: setKeyboardSeekAccFactor,
      min: 1,
      max: 2,
      default: 1.03,
    },
  };
  const { title, value, setValue, min, max, default: defaultValue } = types[type];

  const resetToDefault = () => setValue(defaultValue);

  return <ValueTuner title={title} value={value} setValue={setValue} onFinished={onFinished} max={max} min={min} resetToDefault={resetToDefault} />;
});


export default ValueTuners;
