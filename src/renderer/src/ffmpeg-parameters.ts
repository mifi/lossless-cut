// eslint-disable-line unicorn/filename-case
import i18n from 'i18next';

export const blackdetect = () => ({
  black_min_duration: {
    value: '2.0',
    hint: i18n.t('Set the minimum detected black duration expressed in seconds. It must be a non-negative floating point number.'),
  },
  picture_black_ratio_th: {
    value: '0.98',
    hint: i18n.t('Set the threshold for considering a picture "black".'),
  },
  pixel_black_th: {
    value: '0.10',
    hint: i18n.t('Set the threshold for considering a pixel "black".'),
  },
  mode: {
    value: '1',
    hint: i18n.t('Segment mode: "{{mode1}}" will create segments bounding the black sections. "{{mode2}}" will create segments that start/stop at the center of each black section.', { mode1: '1', mode2: '2' }),
  },
});

export const silencedetect = () => ({
  noise: {
    value: '-60dB',
    hint: i18n.t('Set noise tolerance. Can be specified in dB (in case "dB" is appended to the specified value) or amplitude ratio. Default is -60dB, or 0.001.'),
  },
  duration: {
    value: '2.0',
    hint: i18n.t('Set minimum silence duration that will be converted into a segment.'),
  },
  mode: {
    value: '1',
    hint: i18n.t('Segment mode: "{{mode1}}" will create segments bounding the silent sections. "{{mode2}}" will create segments that start/stop at the center of each silent section.', { mode1: '1', mode2: '2' }),
  },
});

export const sceneChange = () => ({
  minChange: {
    value: '0.3',
    hint: i18n.t('Minimum change between two frames to be considered a new scene. A value between 0.3 and 0.5 is generally a sane choice.'),
  },
});
