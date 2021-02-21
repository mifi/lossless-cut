import randomColor from './random-color';

export function generateColor() {
  return randomColor(1, 0.95);
}

export function getSegColors(seg) {
  if (!seg) return {};
  const { color } = seg;
  return {
    segBgColor: color.alpha(0.5).string(),
    segActiveBgColor: color.lighten(0.5).alpha(0.5).string(),
    segBorderColor: color.lighten(0.5).string(),
  };
}
