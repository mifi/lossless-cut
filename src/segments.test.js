import { convertSegmentsToChapters } from './segments';

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
