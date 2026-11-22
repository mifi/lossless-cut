import { test, expect } from 'vitest';

import { isRangeScanned } from './keyframes';

test('isRangeScanned', () => {
  expect(isRangeScanned([], 1, 2)).toBe(false);
  expect(isRangeScanned([{ from: 0, to: 60 }], 10, 20)).toBe(true);
  expect(isRangeScanned([{ from: 0, to: 60 }], 20, 10)).toBe(true); // reversed
  expect(isRangeScanned([{ from: 0, to: 60 }], 50, 70)).toBe(false);
  expect(isRangeScanned([{ from: 30, to: 90 }, { from: 0, to: 60 }], 10, 80)).toBe(true); // overlapping, unsorted
  expect(isRangeScanned([{ from: 0, to: 60 }, { from: 60, to: 120 }], 10, 110)).toBe(true); // touching
  expect(isRangeScanned([{ from: 0, to: 60 }, { from: 600, to: 660 }], 30, 630)).toBe(false); // gap
  expect(isRangeScanned([{ from: 0, to: 60 }], 60, 60)).toBe(true);
});
