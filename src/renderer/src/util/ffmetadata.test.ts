import { it, expect } from 'vitest';

import { escapeFfmetadataValue, getChaptersFfmetadata } from './ffmetadata';

it('escapes ffmetadata special characters', () => {
  expect(escapeFfmetadataValue(String.raw`a=b;c#d\e`)).toBe(String.raw`a\=b\;c\#d\\e`);
  expect(escapeFfmetadataValue('plain name')).toBe('plain name');
  expect(escapeFfmetadataValue('')).toBe('');
});

it('escapes newlines, and collapses CRLF', () => {
  expect(escapeFfmetadataValue('line1\nline2')).toBe(`line1${String.raw`\ `.trim()}\nline2`);
  expect(escapeFfmetadataValue('line1\r\nline2')).toBe(`line1${String.raw`\ `.trim()}\nline2`);
});

it('generates chapters ffmetadata', () => {
  expect(getChaptersFfmetadata([
    { start: 0, end: 1.5, name: 'Intro; part=1' },
    { start: 1.5, end: 3.0004 },
  ])).toBe([
    '[CHAPTER]',
    'TIMEBASE=1/1000',
    'START=0',
    'END=1500',
    String.raw`title=Intro\; part\=1`,
    '',
    '[CHAPTER]',
    'TIMEBASE=1/1000',
    'START=1500',
    'END=3000',
    'title=',
  ].join('\n'));
});
