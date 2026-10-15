import { describe, expect, it } from 'vitest';

import { combineConsecutiveSegments } from './segments';
import type { StateSegment } from './types';

const makeSegment = (segId: string, start: number, end?: number): StateSegment => ({
  segId, start, end, name: segId, segColorIndex: 1, selected: true,
});

const segments = [
  makeSegment('a', 0, 10),
  makeSegment('b', 10, 20),
  makeSegment('c', 20, 30),
  makeSegment('d', 30, 40),
];

const combine = (ids: string[], input = segments) => combineConsecutiveSegments(input, new Set(ids));

describe('combineConsecutiveSegments', () => {
  it('combines a single timeline selection with its next neighbour', () => {
    const result = combine(['b']);
    expect(result?.segments).toEqual([segments[0], { ...segments[1], end: 30 }, segments[3]]);
    expect(result?.mergedSegmentIndex).toBe(1);
    expect(segments[1]?.end).toBe(20);
  });

  it('combines a consecutive multi-selection without adding its next neighbour', () => {
    expect(combine(['b', 'c'])?.segments).toEqual([segments[0], { ...segments[1], end: 30 }, segments[3]]);
  });

  it('combines all selected neighbours into one', () => {
    expect(combine(['d', 'b', 'a', 'c'])?.segments).toEqual([{ ...segments[0], end: 40 }]);
  });

  it.each([[], ['d'], ['a', 'c'], ['a', 'b', 'd'], ['missing'], ['a', 'missing']].map((ids) => ({ ids })))('does nothing for selection $ids', ({ ids }) => {
    expect(combine(ids)).toBeUndefined();
  });

  it('does nothing for an empty timeline', () => {
    expect(combine([], [])).toBeUndefined();
  });

  it('uses chronological timeline order even when the sidebar is reordered', () => {
    const reordered = [segments[3]!, segments[1]!, segments[0]!, segments[2]!];
    const result = combine(['b'], reordered);
    expect(result?.segments).toEqual([segments[3], { ...segments[1], end: 30 }, segments[0]]);
    expect(result?.mergedSegmentIndex).toBe(1);
    expect(combine(['a', 'c'], reordered)).toBeUndefined();
  });

  it('allows a time gap when no other segment is between the selection', () => {
    const input = [makeSegment('a', 0, 10), makeSegment('b', 20, 30)];
    expect(combine(['a'], input)?.segments).toEqual([{ ...input[0], end: 30 }]);
  });

  it('keeps the furthest end for overlapping or nested segments', () => {
    const input = [makeSegment('a', 0, 50), makeSegment('b', 10, 20)];
    expect(combine(['a'], input)?.segments).toEqual([{ ...input[0], end: 50 }]);
  });

  it('preserves the first segment identity, label, tags, color, and export checkbox', () => {
    const first = { ...segments[0]!, tags: { note: 'keep' }, selected: false };
    const result = combine(['a', 'b'], [first, ...segments.slice(1)]);
    expect(result?.segments[0]).toEqual({ ...first, end: 20 });
    expect(result?.segments[1]).toBe(segments[2]);
    expect(first.end).toBe(10);
  });

  it('treats a marker between selected segments as an intervening segment', () => {
    const input = [segments[0]!, makeSegment('marker', 10), segments[1]!];
    expect(combine(['a', 'b'], input)).toBeUndefined();
  });

  it('can combine consecutive markers without inventing a duration at the same timestamp', () => {
    const input = [makeSegment('a', 10), makeSegment('b', 10)];
    expect(combine(['a'], input)?.segments).toEqual([{ ...input[0], end: undefined }]);
  });
});
