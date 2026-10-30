import padStart from 'lodash/padStart';

import type { FormatTimecode, ParseTimecode } from '../types';

export function formatDuration({ seconds: totalSecondsIn, fileNameFriendly, showFraction = true, shorten = false, fps }: {
  seconds?: number | undefined,
  fileNameFriendly?: boolean | undefined,
  showFraction?: boolean | undefined,
  shorten?: boolean | undefined,
  fps?: number | undefined,
}) {
  const totalSeconds = totalSecondsIn || 0;
  const totalSecondsAbs = Math.abs(totalSeconds);
  const sign = totalSeconds < 0 ? '-' : '';

  const unitsPerSec = fps != null ? fps : 1000;

  // round to integer for our current unit
  const totalUnits = Math.round(totalSecondsAbs * unitsPerSec);

  // epsilon: with fractional fps like 24000/1001, e.g. 24000 / fps = 1000.9999999999999
  const seconds = Math.floor(totalUnits / unitsPerSec + 1e-9);
  const secondsPadded = padStart(String(seconds % 60), 2, '0');
  const minutes = Math.floor(seconds / 60) % 60;
  const hours = Math.floor(seconds / 60 / 60);

  const minutesPadded = shorten && hours === 0 ? `${minutes}` : padStart(String(minutes), 2, '0');

  const remainder = Math.max(0, totalUnits - seconds * unitsPerSec);

  // Be nice to filenames and use .
  const delim = fileNameFriendly ? '.' : ':';

  let hoursPart = '';
  if (!shorten || hours !== 0) {
    const hoursPadded = shorten ? `${hours}` : padStart(String(hours), 2, '0');
    hoursPart = `${hoursPadded}${delim}`;
  }

  let fraction = '';
  if (showFraction && !(shorten && remainder === 0)) {
    const numDigits = fps != null ? 2 : 3;
    fraction = `.${padStart(String(Math.floor(remainder + 1e-6)), numDigits, '0')}`;
  }

  return `${sign}${hoursPart}${minutesPadded}${delim}${secondsPadded}${fraction}`;
}

const durationRegex = /^(-?)(?:(?:(\d+):)?(\d{1,2}):)?(\d+(?:[,.]\d+)?)$/;

export const isExactTimecodeMatch = (str: string, parseTimecode: ParseTimecode, formatTimecode: FormatTimecode) => {
  const seconds = parseTimecode(str);
  return seconds != null && Number.isFinite(seconds) && formatTimecode({ seconds }) === str;
};

// See also parseYoutube
export function parseDuration(str: string, fps?: number) {
  // eslint-disable-next-line unicorn/better-regex
  const match = durationRegex.exec(str.replaceAll(/\s/g, ''));

  if (!match) return undefined;

  const [, sign, hourStr, minStr, secStrRaw] = match;
  const hour = hourStr != null ? parseInt(hourStr, 10) : 0;
  const min = minStr != null ? parseInt(minStr, 10) : 0;

  const secWithFraction = secStrRaw!.replace(',', '.');

  if (min > 59) return undefined;

  let time: number;
  if (fps == null) {
    time = ((hour * 60) + min) * 60 + parseFloat(secWithFraction);
  } else {
    const [secStr, framesStr] = secWithFraction.split('.', 2);
    const wholeSeconds = ((hour * 60) + min) * 60 + parseInt(secStr!, 10);
    const frames = framesStr != null ? parseInt(framesStr, 10) : 0;
    // inverse of formatDuration (which floors the frame remainder), needed for non-integer fps like 29.97
    time = Math.max(0, Math.ceil(wholeSeconds * fps + frames - 1e-6)) / fps;
  }

  if (sign === '-') time *= -1;

  return time;
}
