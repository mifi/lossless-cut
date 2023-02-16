import { it, expect } from 'vitest';

import { formatDuration, parseDuration } from './duration';

it('should format duration properly', () => {
  expect(formatDuration({ seconds: 1.5, fps: 30 })).toBe('00:00:01.15');
  expect(formatDuration({ seconds: 1.5, fps: 30, shorten: true })).toBe('0:01.15');
  expect(formatDuration({ seconds: 1.5, fps: 30, fileNameFriendly: true })).toBe('00.00.01.15');
  expect(formatDuration({ seconds: -1.5, fps: 30 })).toBe('-00:00:01.15');
  expect(formatDuration({ seconds: 101.5 })).toBe('00:01:41.500');
  expect(formatDuration({ seconds: 101.5, shorten: true })).toBe('1:41.500');
  expect(formatDuration({ seconds: 10000 })).toBe('02:46:40.000');
  expect(formatDuration({ seconds: 10000, shorten: true })).toBe('2:46:40');
  expect(formatDuration({ seconds: 10000.5, shorten: true })).toBe('2:46:40.500');
  expect(formatDuration({ seconds: 101.5, showMs: false })).toBe('00:01:41');
  expect(formatDuration({ seconds: 101.5, showMs: false, shorten: true })).toBe('1:41');
});

it('shoud format and parse duration with correct rounding', () => {
  expect(formatDuration({ seconds: parseDuration('00:00:15.426') })).toBe('00:00:15.426');
  expect(formatDuration({ seconds: parseDuration('00:00:15.427') })).toBe('00:00:15.427');
  expect(formatDuration({ seconds: parseDuration('00:00:00.000') })).toBe('00:00:00.000');
  expect(formatDuration({ seconds: parseDuration('00:00:00.001') })).toBe('00:00:00.001');
  expect(formatDuration({ seconds: parseDuration('00:00:01.000') })).toBe('00:00:01.000');
  expect(formatDuration({ seconds: parseDuration('00:00:01.001') })).toBe('00:00:01.001');
  expect(formatDuration({ seconds: parseDuration('24:59:59.999') })).toBe('24:59:59.999');
});
