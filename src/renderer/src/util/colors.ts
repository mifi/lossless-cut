import color from 'color';
import invariant from 'tiny-invariant';

import type { SegmentColorIndex } from '../types';

// Bright, evenly spaced hues that read well on both the dark and light theme
const colorStrings = '#34d399, #fbbf24, #f472b6, #60a5fa, #a78bfa, #fb923c, #22d3ee, #a3e635, #f87171, #2dd4bf, #e879f9, #facc15, #818cf8, #4ade80, #fb7185, #38bdf8, #c084fc, #fdba74, #5eead4'.split(',').map((str) => str.trim());
const colors = colorStrings.map((str) => color(str));

function getColor(n: number) {
  const ret = colors[n % colors.length];
  invariant(ret != null);
  return ret;
}

// eslint-disable-next-line import/prefer-default-export
export function getSegColor(seg: SegmentColorIndex | undefined) {
  if (!seg) {
    return color({
      h: 0,
      s: 0,
      v: 100,
    });
  }
  const { segColorIndex } = seg;

  return getColor(segColorIndex);
}
