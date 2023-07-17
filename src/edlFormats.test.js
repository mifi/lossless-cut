import fs from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { it, describe, expect } from 'vitest';


import { parseYouTube, formatYouTube, parseMplayerEdl, parseXmeml, parseFcpXml, parseCsv, getTimeFromFrameNum, formatCsvFrames, getFrameCountRaw, parsePbf } from './edlFormats';

// eslint-disable-next-line no-underscore-dangle
const __dirname = dirname(fileURLToPath(import.meta.url));

const readFixture = async (name, encoding = 'utf-8') => fs.readFile(join(__dirname, 'fixtures', name), encoding);

const expectYouTube1 = [
  { start: 0, end: 1, name: '00:01 Test 1' },
  { start: 1, end: 2, name: '"Test 2":' },
  { start: 2, end: 4, name: '00:57 double' },
  { start: 4, end: 5, name: '' },
  { start: 5, end: 61, name: '' },
  { start: 61, end: 61.012, name: 'Test 3' },
  { start: 61.012, end: 62.012, name: 'Test 6' },
  { start: 62.012, end: 3661.012, name: 'Test 7' },
  { start: 3661.012, end: 10074, name: 'Test - 4' },
  { start: 10074, end: undefined, name: 'Short - hour and hyphen' },
];

describe('parseYouTube', () => {
  it('parses different cases', () => {
    const str = `
  Jump to chapters:
  0:00 00:01 Test 1
  00:01 "Test 2":
  00:02 00:57 double
  00:01:01 Test 3
  01:01:01.012 Test - 4
  00:01:01.012 Test 5
     01:01.012 Test 6
    :01:02.012 Test 7
  2:47:54 - Short - hour and hyphen
  00:57:01.0123 Invalid 2
  00:57:01. Invalid 3
  01:15:: Invalid 4
  0132 Invalid 5
  00:03
  00:04     
  00:05 
  `;
    const edl = parseYouTube(str);
    expect(edl).toEqual(expectYouTube1);
  });

  it('eol', () => {
    const str = ' 00:00 Test 1\n00:01 Test 2';
    const edl = parseYouTube(str);
    expect(edl).toEqual([
      { start: 0, end: 1, name: 'Test 1' },
      { start: 1, end: undefined, name: 'Test 2' },
    ]);
  });

  it('colon after time', () => {
    const str = ' 00:00: Test 1';
    const edl = parseYouTube(str);
    expect(edl).toEqual([
      { start: 0, end: undefined, name: 'Test 1' },
    ]);
  });
});

it('formatYouTube', () => {
  expect(formatYouTube([
    { start: 1, end: 2, name: 'Label 🎉' },
    { start: 3, end: 5 },
    { start: 10000, end: 10001, name: '' },
  ]).split('\n')).toEqual([
    '0:01 Label 🎉',
    '0:03',
    '2:46:40',
  ]);
  expect(formatYouTube([
    { start: 0, end: 100 },
  ]).split('\n')).toEqual([
    '0:00',
  ]);
});

it('formatYouTube 2', () => {
  expect(formatYouTube(expectYouTube1).split('\n')).toEqual([
    '0:00 00:01 Test 1',
    '0:01 "Test 2":',
    '0:02 00:57 double',
    '0:04',
    '0:05',
    '1:01 Test 3',
    '1:01 Test 6',
    '1:02 Test 7',
    '1:01:01 Test - 4',
    '2:47:54 Short - hour and hyphen',
  ]);
});

// https://kodi.wiki/view/Edit_decision_list
// http://www.mplayerhq.hu/DOCS/HTML/en/edl.html
it('parseMplayerEdl', async () => {
  // TODO support more durations (frames and timestamps):
  /*
  const str = `\
5.3     7.1     0
15      16.7    1
7:00    13:42   3
1       4:15.3  2
12:00.1         2
`;
  const str = `\
#127   #170    0
#360   #400    1
#10080 #19728  3
#1     #6127   2
#17282         2
`;
*/

  const str = await readFixture('mplayer.edl');

  expect(await parseMplayerEdl(str)).toEqual([
    { start: 0,
      end: 5.3,
      name: 'Cut',
      tags: { mplayerEdlType: 0 },
    },
    { start: 7.1,
      end: undefined,
      name: 'Cut',
      tags: { mplayerEdlType: 0 },
    },
    {
      end: 16.7,
      start: 15,
      name: 'Mute',
      tags: { mplayerEdlType: 1 },
    },
    {
      end: 255.3,
      start: 1,
      name: 'Scene Marker',
      tags: { mplayerEdlType: 2 },
    },
    {
      end: 822,
      start: 420,
      name: 'Commercial Break',
      tags: { mplayerEdlType: 3 },
    },
  ]);
});

it('parseMplayerEdl, starting at 0', async () => {
  const str2 = '  0   1.1    0\n';

  expect(await parseMplayerEdl(str2)).toEqual([{
    start: 1.1,
    end: undefined,
    name: 'Cut',
    tags: {
      mplayerEdlType: 0,
    },
  }]);
});

it('parses xmeml 1', async () => {
  expect(await parseXmeml(await readFixture('Final Cut Pro XMEML.xml'))).toMatchSnapshot();
});

it('parses xmeml 2', async () => {
  expect(await parseXmeml(await readFixture('Final Cut Pro XMEML 2.xml'))).toMatchSnapshot();
});

// see https://github.com/mifi/lossless-cut/issues/1195
it('parses xmeml - with multiple tracks', async () => {
  expect(await parseXmeml(await readFixture('Final Cut Pro XMEML 3.xml'))).toMatchSnapshot();
});

// see https://github.com/mifi/lossless-cut/issues/1195
it('parses fcpxml 1.9', async () => {
  expect(await parseFcpXml(await readFixture('FCPXML_1_9.fcpxml'))).toMatchSnapshot();
});

// https://github.com/mifi/lossless-cut/issues/1024
const csvFramesStr = `\
0,155,EP106_SQ010_SH0010
156,251,EP106_SQ010_SH0020
252,687,EP106_SQ010_SH0030
688,747,EP106_SQ020_SH0010
`;

it('parses csv with frames', async () => {
  const fps = 30;
  const parsed = await parseCsv(csvFramesStr, (frameCount) => getTimeFromFrameNum(fps, frameCount));

  expect(parsed).toEqual([
    { end: 5.166666666666667, name: 'EP106_SQ010_SH0010', start: 0 },
    { end: 8.366666666666667, name: 'EP106_SQ010_SH0020', start: 5.2 },
    { end: 22.9, name: 'EP106_SQ010_SH0030', start: 8.4 },
    { end: 24.9, name: 'EP106_SQ020_SH0010', start: 22.933333333333334 },
  ]);

  const formatted = await formatCsvFrames({
    cutSegments: parsed,
    getFrameCount: (sec) => getFrameCountRaw(fps, sec),
  });
  expect(formatted).toEqual(csvFramesStr);
});

it('parses pbf', async () => {
  expect(parsePbf(await readFixture('test1.pbf', null))).toMatchSnapshot();
  expect(parsePbf(await readFixture('test2.pbf', null))).toMatchSnapshot();
  expect(parsePbf(await readFixture('test3.pbf', null))).toMatchSnapshot();
  expect(parsePbf(await readFixture('potplayer bookmark format utf16le issue 867.pbf', null))).toMatchSnapshot();
});
