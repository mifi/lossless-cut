import padStart from 'lodash/padStart';

export function formatDuration({ seconds: secondsIn, fileNameFriendly, showMs = true, shorten = false, fps }) {
  const seconds = secondsIn || 0;
  const secondsAbs = Math.abs(seconds);
  const minutes = Math.floor((secondsAbs / 60) % 60);
  const hours = Math.floor(secondsAbs / 60 / 60);

  // Be nice to filenames and use .
  const delim = fileNameFriendly ? '.' : ':';

  let hoursPart = '';
  if (!shorten || hours !== 0) {
    const hoursPadded = shorten ? `${hours}` : padStart(hours, 2, '0');
    hoursPart = `${hoursPadded}${delim}`;
  }

  const minutesPadded = shorten && hours === 0 ? `${minutes}` : padStart(minutes, 2, '0');

  const secondsAbsFloored = Math.floor(secondsAbs);
  const secondsPadded = padStart(secondsAbsFloored % 60, 2, '0');
  const ms = secondsAbs - secondsAbsFloored;
  let msPart = '';
  if (showMs && !(shorten && ms === 0)) {
    const msPadded = fps != null
      ? padStart(Math.round(ms * fps), 2, '0')
      : padStart(Math.round(ms * 1000), 3, '0');
    msPart = `.${msPadded}`;
  }

  const sign = secondsIn < 0 ? '-' : '';
  return `${sign}${hoursPart}${minutesPadded}${delim}${secondsPadded}${msPart}`;
}

export const isExactDurationMatch = (str) => /^-?\d{2}:\d{2}:\d{2}.\d{3}$/.test(str);

// See also parseYoutube
export function parseDuration(str) {
  const match = str.replace(/\s/g, '').match(/^(-?)(?:(?:(\d{1,}):)?(\d{1,2}):)?(\d{1,2}(?:[.,]\d{1,3})?)$/);

  if (!match) return undefined;

  const [, sign, hourStr, minStr, secStrRaw] = match;
  const secStr = secStrRaw.replace(',', '.');
  const hour = hourStr != null ? parseInt(hourStr, 10) : 0;
  const min = minStr != null ? parseInt(minStr, 10) : 0;
  const sec = parseFloat(secStr);

  if (min > 59 || sec >= 60) return undefined;

  let time = (((hour * 60) + min) * 60 + sec);

  if (sign === '-') time *= -1;

  return time;
}
