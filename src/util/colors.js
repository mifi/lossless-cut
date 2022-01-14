import color from 'color';

// https://github.com/mock-end/random-color/blob/master/index.js
/* eslint-disable */
function getColor(saturation, value, n) {
  var ratioMul = 0.618033988749895;
  var initialHue = 0.65;

  const hue = (initialHue + ((n + 1) * ratioMul)) % 1;

  return color({
    h: hue * 360,
    s: saturation * 100,
    v: value * 100,
  });
};
/* eslint-enable */

// eslint-disable-next-line import/prefer-default-export
export function getSegColors(seg) {
  if (!seg) return {};
  const { segIndex } = seg;

  const segColor = getColor(1, 0.95, segIndex);

  return {
    segBgColor: segColor.alpha(0.5).string(),
    segActiveBgColor: segColor.lighten(0.5).alpha(0.5).string(),
    segBorderColor: segColor.lighten(0.5).string(),
  };
}
