// https://github.com/mock-end/random-color/blob/master/index.js
/* eslint-disable */

import color from 'color';

var ratio = 0.618033988749895;
var hue   = 0.65;

export default (saturation, value) => {
  hue += ratio;
  hue %= 1;

  if (typeof saturation !== 'number') {
    saturation = 0.5;
  }

  if (typeof value !== 'number') {
    value = 0.95;
  }

  return color({
    h: hue * 360,
    s: saturation * 100,
    v: value * 100,
  });
};
