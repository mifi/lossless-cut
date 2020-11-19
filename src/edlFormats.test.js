/* eslint-disable no-undef */
import { parseYouTube } from './edlFormats';

it('parseYoutube', () => {
  const str = `
Jump to chapters:
00:00 Test 1
00:01 Test 2
00:02 00:57 double
00:01:01 Test 3
01:01:01.012 Test 4
00:01:01.012 Test 5
   01:01.012 Test 6
  :01:02.012 Test 7
00:57:01.0123 Invalid 2
00:57:01. Invalid 3
01:15: Invalid 4
0132 Invalid 5
00:03
00:04     
00:05 
`;
  const edl = parseYouTube(str);
  expect(edl).toEqual([
    { start: 0, end: 1, name: 'Test 1' },
    { start: 1, end: 2, name: 'Test 2' },
    { start: 2, end: 4, name: '00:57 double' },
    { start: 4, end: 5, name: '' },
    { start: 5, end: 61, name: '' },
    { start: 61, end: 61.012, name: 'Test 3' },
    { start: 61.012, end: 62.012, name: 'Test 6' },
    { start: 62.012, end: 3661.012, name: 'Test 7' },
    { start: 3661.012, end: undefined, name: 'Test 4' },
  ]);
});

it('parseYouTube eol', () => {
  const str = ' 00:00 Test 1\n00:01 Test 2';
  const edl = parseYouTube(str);
  expect(edl).toEqual([
    { start: 0, end: 1, name: 'Test 1' },
    { start: 1, end: undefined, name: 'Test 2' },
  ]);
});
