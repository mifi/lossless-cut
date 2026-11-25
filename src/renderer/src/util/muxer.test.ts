import { test, expect } from 'vitest';

import { getMovFlags } from './muxer';

const options = { outFormat: 'mp4', preserveMovData: true, movFastStart: true, hasAttachedPicture: false };

test('keeps MOV metadata and faststart without cover art', () => {
  expect(getMovFlags(options)).toStrictEqual(['-movflags', 'use_metadata_tags', '-movflags', '+faststart']);
});

test('preserves attached pictures instead of enabling incompatible MOV metadata mode', () => {
  expect(getMovFlags({ ...options, hasAttachedPicture: true })).toStrictEqual(['-movflags', '+faststart']);
  expect(getMovFlags({ ...options, hasAttachedPicture: true, movFastStart: false })).toStrictEqual([]);
});

test('does not add MOV options to other muxers', () => {
  expect(getMovFlags({ ...options, outFormat: 'matroska' })).toStrictEqual([]);
  expect(getMovFlags({ ...options, outFormat: undefined, hasAttachedPicture: true })).toStrictEqual(['-movflags', '+faststart']);
});
