import { describe, expect, it } from 'vitest';

import getAlignedKeyframeCut from './keyframeCut';

const frames = [
  { time: 0, keyframe: true },
  { time: 4.271, decodeTime: 4.238, keyframe: true },
  { time: 5.339, decodeTime: 5.305, keyframe: true },
  { time: 9.343, decodeTime: 9.309, keyframe: true },
];

const cut = (cutFrom: number, cutTo: number) => getAlignedKeyframeCut({ frames, cutFrom, cutTo });

describe('getAlignedKeyframeCut', () => {
  it('uses DTS to remove the previous GOP without discarding the desired keyframe', () => {
    const result = cut(4.271, 9.343);
    expect(result?.outputSeek).toBe(4.238);
    expect(result?.duration).toBeCloseTo(5.071, 6);
  });

  it('excludes the next keyframe at the end of a very short segment', () => {
    expect(cut(4.271, 5.339)?.duration).toBeCloseTo(1.067, 6);
  });

  it('does not trim away the first keyframe when its DTS is missing', () => {
    expect(cut(0, 4.271)).toEqual({ outputSeek: undefined, duration: 4.238 });
  });

  it('keeps normal keyframe-cut behavior for an unaligned start', () => {
    expect(cut(4, 9.343)).toBeUndefined();
  });

  it('keeps the requested duration when the end is not on a keyframe', () => {
    expect(cut(4.271, 8)?.duration).toBeCloseTo(3.729, 6);
  });

  it('does not change a full-file export without aligned boundaries', () => {
    expect(cut(0, 119.3)).toBeUndefined();
  });

  it('does not treat a non-keyframe as a safe start', () => {
    expect(getAlignedKeyframeCut({ frames: [{ time: 4.271, decodeTime: 4.238, keyframe: false }], cutFrom: 4.271, cutTo: 8 })).toBeUndefined();
  });

  it.each([undefined, Number.NaN, Number.POSITIVE_INFINITY])('rejects an unknown or invalid start DTS %s', (decodeTime) => {
    expect(getAlignedKeyframeCut({ frames: [{ time: 4.271, decodeTime, keyframe: true }], cutFrom: 4.271, cutTo: 8 })).toBeUndefined();
  });

  it('rejects an invalid duration', () => {
    expect(cut(9.343, 4.271)).toBeUndefined();
  });
});
