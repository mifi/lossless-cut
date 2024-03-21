// eslint-disable-line unicorn/filename-case
import { describe, it, expect } from 'vitest';

import { adjustRate, DEFAULT_PLAYBACK_RATE } from './rate-calculator';

it('inverts for reverse direction', () => {
  const r = adjustRate(1, -1, 2);
  expect(r).toBeLessThan(1);
});

it('uses default rate', () => {
  const r = adjustRate(1, 1);
  expect(r).toBe(1 * DEFAULT_PLAYBACK_RATE);
});

it('allows multiplier override', () => {
  const r = adjustRate(1, 1, Math.PI);
  expect(r).toBe(1 * Math.PI);
});

describe('speeding up', () => {
  it('sets rate to 1 if close to 1', () => {
    expect(adjustRate(1 / DEFAULT_PLAYBACK_RATE + 0.01, 1)).toBe(1);
  });

  it('sets rate to 1 if passing 1 ', () => {
    expect(adjustRate(0.5, 1, 2)).toBe(1);
  });

  it('will not play faster than 16', () => {
    expect(adjustRate(15.999999, 1, 2)).toBe(16);
  });
});

describe('slowing down', () => {
  it('sets rate to 1 if close to 1', () => {
    expect(adjustRate(DEFAULT_PLAYBACK_RATE + 0.01, -1)).toBe(1);
  });

  it('sets rate to 1 if passing 1', () => {
    expect(adjustRate(1.1, -1, 2)).toBe(1);
  });

  it('will not play slower than 0.1', () => {
    expect(adjustRate(0.1111, -1, 2)).toBe(0.1);
  });
});
