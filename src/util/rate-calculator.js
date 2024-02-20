// eslint-disable-line unicorn/filename-case
import clamp from 'lodash/clamp';

/**
 * @constant {number}
 * @default
 * The default playback rate multiplier is used to adjust the current playback
 * rate when no additional modifiers are applied. This is set to ∛2 so that striking
 * the fast forward key (`l`) three times speeds playback up to twice the speed.
 */
export const DEFAULT_PLAYBACK_RATE = (2 ** (1 / 3));

/**
 * Adjusts the current playback rate up or down
 * @param {number} playbackRate current playback rate
 * @param {number} direction positive for forward, negative for reverse
 * @param {number} [multiplier] rate multiplier, defaults to {@link DEFAULT_PLAYBACK_RATE}
 * @returns a new playback rate
 */
export function adjustRate(playbackRate, direction, multiplier) {
  const m = multiplier || DEFAULT_PLAYBACK_RATE;
  const factor = direction > 0 ? m : (1 / m);
  let newRate = playbackRate * factor;
  // If the multiplier causes us to go faster than real time or slower than real time,
  // stop along the way at 1.0. This could happen if the current playbackRate was reached
  // using a different multiplier (e.g., holding the shift key).
  // https://github.com/mifi/lossless-cut/issues/447#issuecomment-766339083
  if ((newRate > 1 && playbackRate < 1) || (newRate < 1 && playbackRate > 1)) {
    newRate = 1;
  }
  // And, clean up any rounding errors that get us to almost 1.0 (e.g., treat 1.00001 as 1)
  if ((newRate > (m ** (-1 / 2))) && (newRate < (m ** (1 / 2)))) {
    newRate = 1;
  }
  return clamp(newRate, 0.1, 16);
}

export default adjustRate;
