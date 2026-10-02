import { test, it, expect, describe } from 'vitest';

import { convertSegmentsToChaptersWithGaps, partitionIntoOverlappingRanges, formatSegNum, combineOverlappingSegments, invertSegments, getSegmentAroundPlayhead } from './segments';

it('converts segments to chapters with gaps', () => {
  expect(convertSegmentsToChaptersWithGaps([
    {
      start: 104.612,
      end: 189.053,
      name: 'label 1',
    },
    {
      start: 300.448,
      end: 476.194,
      name: 'label 2',
    },
    {
      start: 567.075,
      end: 704.264,
      name: 'label 3',
    },
    {
      start: 704.264,
      end: 855.455,
      name: 'label 4',
    },
  ])).toMatchSnapshot();
});

it('converts segments to chapters with no gaps when adjacent', () => {
  expect(convertSegmentsToChaptersWithGaps([
    {
      start: 0,
      end: 2,
      name: 'label 1',
    },
    {
      start: 2,
      end: 3,
      name: 'label 2',
    },
  ])).toMatchSnapshot();
});

it('converts segments to chapters with single long segment', () => {
  expect(convertSegmentsToChaptersWithGaps([
    {
      start: 0,
      end: 1,
      name: 'label 1',
    },
  ])).toMatchSnapshot();
});

it('detects overlapping segments', () => {
  expect(partitionIntoOverlappingRanges([
    { start: 0, end: 1 },
  ])).toEqual([]);

  expect(partitionIntoOverlappingRanges([
    { start: 0, end: 1 },
    { start: 1, end: 2 },
  ])).toEqual([]);

  expect(partitionIntoOverlappingRanges([
    { start: 0, end: 1 },
    { start: 0.5, end: 2 },
    { start: 2, end: 3 },
  ])).toEqual([
    [
      { start: 0, end: 1 },
      { start: 0.5, end: 2 },
    ],
  ]);

  expect(partitionIntoOverlappingRanges([
    { start: 0, end: 2 },
    { start: 0.5, end: 1 },
  ])).toEqual([
    [
      { start: 0, end: 2 },
      { start: 0.5, end: 1 },
    ],
  ]);

  expect(partitionIntoOverlappingRanges([
    { start: 9, end: 10.5 },
    { start: 11, end: 12 },
    { start: 11.5, end: 12.5 },
    { start: 11.5, end: 13 },
    { start: 15, end: 17 },
    { start: 17, end: 20 },
    { start: 17.5, end: 18.5 },
    { start: 18, end: 19.5 },
    { start: 19, end: 19.5 },
    { start: 19.5, end: 22 },
    { start: 22, end: 25 },
  ])).toEqual([
    [{ start: 11, end: 12 }, { start: 11.5, end: 13 }, { start: 11.5, end: 12.5 }],
    [{ start: 17, end: 20 }, { start: 17.5, end: 18.5 }, { start: 18, end: 19.5 }, { start: 19, end: 19.5 }, { start: 19.5, end: 22 }],
  ]);
});

it('detects overlapping segments, undefined end', () => {
  expect(partitionIntoOverlappingRanges([
    { start: 1, end: undefined },
    { start: 1.5, end: undefined },
  ])).toEqual([]);
});

test('formatSegNum', () => {
  expect(formatSegNum(0, 9)).toBe('1');
  expect(formatSegNum(0, 10)).toBe('01');

  expect(formatSegNum(0, 10, 2)).toBe('01');
  expect(formatSegNum(0, 10, 3)).toBe('001');
});

describe('invertSegments', () => {
  test('normal', () => {
    expect(invertSegments([
      { start: 1, name: 'Marker 1' },
      { start: 2, end: 3, name: 'Segment 2' },
      { start: 5, name: 'Segment 3' },
    ], true, true, 100)).toMatchSnapshot();
  });

  test('none', () => {
    expect(invertSegments([], true, true, 100)).toMatchSnapshot();
  });

  test('adjacent', () => {
    expect(invertSegments([
      { start: 2, end: 3, name: 'Segment 1' },
      { start: 3, end: 4, name: 'Segment 2' },
    ], true, true, 100)).toMatchSnapshot();
  });

  test('overlap 1', () => {
    expect(invertSegments([
      { start: 2, end: 3.5 },
      { start: 3, end: 4 },
    ], true, true, 100)).toMatchSnapshot();
  });

  test('overlap 2', () => {
    expect(invertSegments([
      { start: 2, end: 5 },
      { start: 3, end: 4 },
    ], true, true, 100)).toMatchSnapshot();
  });

  test('undefined duration', () => {
    expect(invertSegments([
      { start: 3, name: 'Marker 1' },
    ], true, true)).toMatchSnapshot();
  });

  test('undefined duration 2', () => {
    expect(invertSegments([
      { start: 3 },
    ], false, false)).toMatchSnapshot();
  });
});

describe('combineOverlappingSegments', () => {
  test('non touching', () => {
    expect(combineOverlappingSegments([
      { start: 1, end: 2 },
      { start: 3, end: 4 },
    ])).toMatchSnapshot();
  });
  test('overlapping and non overlapping', () => {
    expect(combineOverlappingSegments([
      { start: 1, end: 2 },
      { start: 1.5, end: 3 },
      { start: 4, end: 5 },
    ])).toMatchSnapshot();
  });
  test('adjacent', () => {
    expect(combineOverlappingSegments([
      { start: 1, end: 2 },
      { start: 2, end: 3 },
      { start: 3, end: 4 },
    ])).toMatchSnapshot();
  });

  test('various', () => {
    const segments = [
      {
        start: 0,
      },
      {
        start: 838,
        end: 1101,
      },
      {
        start: 1101,
        end: 1244,
      },
      {
        start: 1216,
        end: 1487,
      },
      {
        start: 1487,
      },
      {
        start: 1625,
      },
      {
        start: 503,
        end: 669,
      },
      {
        start: 392,
        end: 716,
      },
      {
        start: 229,
        end: 784,
      },
      {
        start: 0,
        end: 87,
      },
      {
        start: 1561,
        end: 1831,
      },
      {
        start: 2027,
      },
    ];

    expect(combineOverlappingSegments(segments)).toMatchSnapshot();
  });
});


describe('getSegmentAroundPlayhead', () => {
  it.each([
    [30, 60, 15, 15, 15, 45],
    [5, 60, 15, 15, 0, 20],
    [55, 60, 15, 15, 40, 60],
    [0, 60, 15, 15, 0, 15],
    [60, 60, 15, 15, 45, 60],
    [2, 5, 15, 15, 0, 5],
    [30, 60, 5, 20, 25, 50],
    [30.25, 60, 1.5, 2.75, 28.75, 33],
    [30, 60, 0, 15, 30, 45],
    [30, 60, 15, 0, 15, 30],
    [-1, 60, 15, 15, 0, 15],
    [61, 60, 15, 15, 45, 60],
    [30, 60, Number.MAX_VALUE, Number.MAX_VALUE, 0, 60],
  ])('clamps time %s with duration %s and offsets %s/%s to %s–%s', (time, duration, before, after, start, end) => {
    expect(getSegmentAroundPlayhead({ time, duration, before, after })).toEqual({ start, end });
  });

  it.each([undefined, 0, -1, NaN, Infinity])('rejects invalid duration %s', (duration) => {
    expect(getSegmentAroundPlayhead({ time: 30, duration, before: 15, after: 15 })).toBeUndefined();
  });

  it.each([NaN, Infinity, -Infinity])('rejects invalid playhead %s', (time) => {
    expect(getSegmentAroundPlayhead({ time, duration: 60, before: 15, after: 15 })).toBeUndefined();
  });

  it.each([-1, NaN, Infinity, -Infinity])('rejects invalid offset %s', (offset) => {
    expect(getSegmentAroundPlayhead({ time: 30, duration: 60, before: offset, after: 15 })).toBeUndefined();
    expect(getSegmentAroundPlayhead({ time: 30, duration: 60, before: 15, after: offset })).toBeUndefined();
  });

  it.each([
    [30, 0, 0],
    [0, 15, 0],
    [60, 0, 15],
  ])('does not create an empty segment at %s with offsets %s/%s', (time, before, after) => {
    expect(getSegmentAroundPlayhead({ time, duration: 60, before, after })).toBeUndefined();
  });
});
