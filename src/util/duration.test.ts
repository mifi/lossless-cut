import { it, expect } from 'vitest';

import { formatDuration, parseDuration } from './duration';

it('should format duration properly', () => {
  expect(formatDuration({ seconds: 1.5, fps: 30 })).toBe('00:00:01.15');
  expect(formatDuration({ seconds: 1.5, fps: 30, shorten: true })).toBe('0:01.15');
  expect(formatDuration({ seconds: 1.5, fps: 30, fileNameFriendly: true })).toBe('00.00.01.15');
  expect(formatDuration({ seconds: -1.5, fps: 30 })).toBe('-00:00:01.15');
  expect(formatDuration({ seconds: 32.670476, fps: 23.976 })).toBe('00:00:32.15');
  expect(formatDuration({ seconds: 101.5 })).toBe('00:01:41.500');
  expect(formatDuration({ seconds: 101.5, shorten: true })).toBe('1:41.500');
  expect(formatDuration({ seconds: 10000 })).toBe('02:46:40.000');
  expect(formatDuration({ seconds: 10000, shorten: true })).toBe('2:46:40');
  expect(formatDuration({ seconds: 10000.5, shorten: true })).toBe('2:46:40.500');
  expect(formatDuration({ seconds: 101.5, showFraction: false })).toBe('00:01:41');
  expect(formatDuration({ seconds: 101.5, showFraction: false, shorten: true })).toBe('1:41');
});

it('should format and parse duration with correct rounding', () => {
  // https://github.com/mifi/lossless-cut/issues/1217
  expect(formatDuration({ seconds: parseDuration('00:00:15.426') })).toBe('00:00:15.426');
  expect(formatDuration({ seconds: parseDuration('00:00:15.427') })).toBe('00:00:15.427');
  expect(formatDuration({ seconds: parseDuration('00:00:00.000') })).toBe('00:00:00.000');
  expect(formatDuration({ seconds: parseDuration('00:00:00.001') })).toBe('00:00:00.001');
  expect(formatDuration({ seconds: parseDuration('00:00:01.000') })).toBe('00:00:01.000');
  expect(formatDuration({ seconds: parseDuration('00:00:01.001') })).toBe('00:00:01.001');
  expect(formatDuration({ seconds: parseDuration('24:59:59.999') })).toBe('24:59:59.999');
  expect(formatDuration({ seconds: parseDuration('01:02:03.45') })).toBe('01:02:03.450');
  expect(formatDuration({ seconds: parseDuration('01:02:03,45') })).toBe('01:02:03.450');
  expect(formatDuration({ seconds: parseDuration('01:02:03.4') })).toBe('01:02:03.400');
  expect(formatDuration({ seconds: parseDuration('01:02:03.456') })).toBe('01:02:03.456');
  expect(formatDuration({ seconds: parseDuration('-01:02:03.456') })).toBe('-01:02:03.456');
  expect(formatDuration({ seconds: parseDuration('01:02.345') })).toBe('00:01:02.345');
  expect(formatDuration({ seconds: parseDuration('01:02.003') })).toBe('00:01:02.003');
  expect(formatDuration({ seconds: parseDuration('01:01.2') })).toBe('00:01:01.200');
  expect(formatDuration({ seconds: parseDuration('1:1.2') })).toBe('00:01:01.200');
  expect(formatDuration({ seconds: parseDuration('01.234') })).toBe('00:00:01.234');
  expect(formatDuration({ seconds: parseDuration('1.234') })).toBe('00:00:01.234');
  expect(formatDuration({ seconds: parseDuration('1') })).toBe('00:00:01.000');
  expect(formatDuration({ seconds: parseDuration('-1') })).toBe('-00:00:01.000');
  expect(formatDuration({ seconds: parseDuration('01') })).toBe('00:00:01.000');
  expect(formatDuration({ seconds: parseDuration('01:00:00.000') })).toBe('01:00:00.000');
});

// https://github.com/mifi/lossless-cut/issues/1603
it('should round up properly', () => {
  const fps = 30;
  const halfFrame = (1 / fps) / 2;
  expect(formatDuration({ seconds: 1 })).toBe('00:00:01.000');
  expect(formatDuration({ seconds: 1, fps })).toBe('00:00:01.00');
  expect(formatDuration({ seconds: 0.999999 })).toBe('00:00:01.000');
  expect(formatDuration({ seconds: 1 - halfFrame + 0.001, fps })).toBe('00:00:01.00');
  expect(formatDuration({ seconds: 0.999 })).toBe('00:00:00.999');
  expect(formatDuration({ seconds: 1 - halfFrame - 0.001, fps })).toBe('00:00:00.29');
  expect(formatDuration({ seconds: 59.999 })).toBe('00:00:59.999');
  expect(formatDuration({ seconds: 60 - halfFrame - 0.001, fps })).toBe('00:00:59.29');
  expect(formatDuration({ seconds: 59.9999 })).toBe('00:01:00.000');
  expect(formatDuration({ seconds: (60 - halfFrame) + 0.001, fps })).toBe('00:01:00.00');
  expect(formatDuration({ seconds: 3599.999 })).toBe('00:59:59.999');
  expect(formatDuration({ seconds: (3600 - halfFrame) - 0.001, fps })).toBe('00:59:59.29');
  expect(formatDuration({ seconds: 3599.9999 })).toBe('01:00:00.000');
  expect(formatDuration({ seconds: (3600 - halfFrame) + 0.001, fps })).toBe('01:00:00.00');
});
