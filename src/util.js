const _ = require('lodash');

function formatDuration(_seconds) {
  const seconds = _seconds || 0;
  const minutes = seconds / 60;
  const hours = minutes / 60;

  const hoursPadded = _.padStart(Math.floor(hours), 2, '0');
  const minutesPadded = _.padStart(Math.floor(minutes % 60), 2, '0');
  const secondsPadded = _.padStart(Math.floor(seconds) % 60, 2, '0');
  const msPadded = _.padStart(Math.floor((seconds - Math.floor(seconds)) * 1000), 3, '0');

  // Be nice to filenames and use .
  return `${hoursPadded}.${minutesPadded}.${secondsPadded}.${msPadded}`;
}

module.exports = {
  formatDuration,
};
