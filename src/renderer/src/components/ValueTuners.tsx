import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import ValueTuner from './ValueTuner';
import useUserSettings from '../hooks/useUserSettings';
import { TunerType } from '../types';

const ValueTuners = memo(({ type, onFinished }: { type: TunerType, onFinished: () => void }) => {
  const { t } = useTranslation();
  const { wheelSensitivity, setWheelSensitivity, keyboardNormalSeekSpeed, keyboardSeekSpeed2, setKeyboardSeekSpeed2, keyboardSeekSpeed3, setKeyboardSeekSpeed3, setKeyboardNormalSeekSpeed, keyboardSeekAccFactor, setKeyboardSeekAccFactor } = useUserSettings();

  // NOTE default values are duplicated in src/main/configStore.js
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
      title: t('Timeline keyboard seek interval'),
      value: keyboardNormalSeekSpeed,
      setValue: setKeyboardNormalSeekSpeed,
      min: 0,
      max: 120,
      default: 1,
    },
    keyboardSeekSpeed2: {
      title: t('Timeline keyboard seek interval (longer)'),
      value: keyboardSeekSpeed2,
      setValue: setKeyboardSeekSpeed2,
      min: 0,
      max: 600,
      default: 10,
    },
    keyboardSeekSpeed3: {
      title: t('Timeline keyboard seek interval (longest)'),
      value: keyboardSeekSpeed3,
      setValue: setKeyboardSeekSpeed3,
      min: 0,
      max: 3600,
      default: 60,
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
