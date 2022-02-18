import color from 'color';

// http://phrogz.net/css/distinct-colors.html
const colorStrings = '#ff5100, #ffc569, #ddffd1, #00ccff, #e9d1ff, #ff0084, #ff6975, #ffe6d1, #ffff69, #69ff96, #008cff, #ae00ff, #ff002b, #ff8c00, #8cff00, #69ffff, #0044ff, #ff00d4, #ffd1d9'.split(',').map((str) => str.trim());
const colors = colorStrings.map((str) => color(str));

function getColor(n) {
  return colors[n % colors.length];
}

// eslint-disable-next-line import/prefer-default-export
export function getSegColor(seg) {
  if (!seg) {
    return color({
      h: 0,
      s: 0,
      v: 100,
    });
  }
  const { segIndex } = seg;

  return getColor(segIndex);
}
