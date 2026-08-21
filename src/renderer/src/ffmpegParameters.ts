// eslint-disable-line unicorn/filename-case
import i18n from 'i18next';

const parametersRaw = {
  blackdetect: {
    black_min_duration: {
      value: '2.0',
      hint: () => i18n.t('Set the minimum detected black duration expressed in seconds. It must be a non-negative floating point number.'),
    },
    picture_black_ratio_th: {
      value: '0.98',
      hint: () => i18n.t('Set the threshold for considering a picture "black".'),
    },
    pixel_black_th: {
      value: '0.10',
      hint: () => i18n.t('Set the threshold for considering a pixel "black".'),
    },
    mode: {
      value: '1',
      hint: () => i18n.t('Segment mode: "{{mode1}}" will create segments bounding the black sections. "{{mode2}}" will create segments that start/stop at the center of each black section.', { mode1: '1', mode2: '2' }),
    },
  },
  silencedetect: {
    noise: {
      value: '-60dB',
      hint: () => i18n.t('Set noise tolerance. Can be specified in dB (in case "dB" is appended to the specified value) or amplitude ratio. Default is -60dB, or 0.001.'),
    },
    duration: {
      value: '2.0',
      hint: () => i18n.t('Set minimum silence duration that will be converted into a segment.'),
    },
    mode: {
      value: '1',
      hint: () => i18n.t('Segment mode: "{{mode1}}" will create segments bounding the silent sections. "{{mode2}}" will create segments that start/stop at the center of each silent section.', { mode1: '1', mode2: '2' }),
    },
  },
  sceneChange: {
    minChange: {
      value: '0.3',
      hint: () => i18n.t('Minimum change between two frames to be considered a new scene. A value between 0.3 and 0.5 is generally a sane choice.'),
    },
  },
  cropdetect: {
    limit: {
      value: '24',
      hint: () => i18n.t('Set higher black value threshold, which can be optionally specified from nothing (0) to everything (255 for 8-bit based formats). An intensity value greater to the set value is considered non-black. It defaults to 24. You can also specify a value between 0.0 and 1.0 which will be scaled depending on the bitdepth of the pixel format. '),
    },
    reset_count: {
      value: '1',
      hint: () => i18n.t('Set the counter that determines after how many frames cropdetect will reset the previously detected largest video area and start over to detect the current optimal crop area. Default ffmpeg value is 0, but for detecting segments it is >=1. This can be useful when channel logos distort the video area. 0 indicates ’never reset’, and returns the largest area encountered during playback. '),
    },
    minSegmentDuration: {
      value: '1',
      hint: () => i18n.t('Set minimum duration in seconds that is required to create a new segment.'),
    },
    width: {
      value: '0',
      hint: () => i18n.t('Crop Values with a lower or equal width than this will be part of a segment. Is not used if 0. If width and height are 0 every crop change indicates a new segment'),
    },
    height: {
      value: '0',
      hint: () => i18n.t('Crop Values with a lower or equal height than this will be part of a segment. Is not used if 0. If width and height are 0 every crop change indicates a new segment'),
    },
  },
};

export type FfmpegDialog = keyof typeof parametersRaw;

// widen types
export const parameters: Record<FfmpegDialog, Record<string, { value: string, hint?: () => string, label?: string }>> = parametersRaw;

export const getHint = (dialogType: FfmpegDialog, param: string) => parameters[dialogType][param]?.hint?.();
export const getLabel = (dialogType: FfmpegDialog, param: string) => parameters[dialogType][param]?.label;
