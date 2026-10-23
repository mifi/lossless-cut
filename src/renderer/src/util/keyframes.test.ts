import { describe, expect, it } from 'vitest';

import { pickActualCutStart } from './keyframes';

describe('pickActualCutStart', () => {
  // 1-second GOP
  const keyframes = [{ time: 2328 }, { time: 2329 }, { time: 2330 }, { time: 2331 }];

  it('snaps back to the previous keyframe when cutting between keyframes', () => {
    // keyframe cut at 2329.67 will start at the keyframe 2329.0
    expect(pickActualCutStart(keyframes, 2329.669985443957)).toBe(2329);
  });

  it('keeps the cut point when it is exactly on a keyframe', () => {
    expect(pickActualCutStart(keyframes, 2329)).toBe(2329);
    expect(pickActualCutStart(keyframes, 2330)).toBe(2330);
  });

  it('keeps the cut point when no keyframe exists at or before it', () => {
    expect(pickActualCutStart([{ time: 2330 }, { time: 2331 }], 2329)).toBe(2329);
    expect(pickActualCutStart([], 2329)).toBe(2329);
  });

  it('uses the closest keyframe before the cut point', () => {
    expect(pickActualCutStart(keyframes, 2330.5)).toBe(2330);
  });
});
