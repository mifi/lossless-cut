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

export function parseDuration(str) {
  if (!str) return undefined;
  const match = str.trim().match(/^(-?)(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/);
  if (!match) return undefined;
  const isNegatve = match[1] === '-';
  const hours = parseInt(match[2], 10);
  const minutes = parseInt(match[3], 10);
  const seconds = parseInt(match[4], 10);
  const ms = parseInt(match[5], 10);
  if (hours > 59 || minutes > 59 || seconds > 59) return undefined;

  let ret = (((((hours * 60) + minutes) * 60) + seconds) + (ms / 1000));
  if (isNegatve) ret *= -1;
  return ret;
}
