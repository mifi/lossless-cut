import { convertSegmentsToChapters, partitionIntoOverlappingRanges, getSegApparentStart, getSegApparentEnd } from './segments';

it('converts segments to chapters with gaps', () => {
  expect(convertSegmentsToChapters([
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

it('converts segments to chapters with no gaps', () => {
  expect(convertSegmentsToChapters([
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
  expect(convertSegmentsToChapters([
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
    { start: 9, end: 10.50 },
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
  ], getSegApparentStart, (seg) => getSegApparentEnd(seg, 2))).toEqual([
    [{ start: 1, end: undefined }, { start: 1.5, end: undefined }],
  ]);
});
