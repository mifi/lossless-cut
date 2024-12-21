import { it, describe, expect, test } from 'vitest';

import { parseSrtToSegments, formatSrt, parseYouTube, formatYouTube, parseMplayerEdl, parseXmeml, parseFcpXml, parseCsv, parseCsvTime, getFrameValParser, formatCsvFrames, getFrameCountRaw, parsePbf, parseDvAnalyzerSummaryTxt, parseCutlist, parseGpsLine } from './edlFormats';
import { readFixture, readFixtureBinary } from './test/util';


const expectYouTube1 = [
  { start: 0, end: 1, name: '00:01 Test 1' },
  { start: 1, end: 2, name: '"Test 2":' },
  { start: 2, end: 4, name: '00:57 double' },
  { start: 4, end: 5, name: '' },
  { start: 5, end: 6, name: '' },
  { start: 6, end: 6.01, name: '6 label' },
  { start: 6.01, end: 61, name: '6.01 label' },
  { start: 61, end: 61.012, name: 'Test 3' },
  { start: 61.012, end: 62.012, name: 'Test 6' },
  { start: 62.012, end: 132, name: 'Test 7' },
  { start: 132, end: 3661.012, name: 'Integer' },
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
  0132 Integer
  00:03
  00:04     
  00:05 
  6 6 label
  6.01 6.01 label
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
    '0:06 6 label',
    '0:06 6.01 label',
    '1:01 Test 3',
    '1:01 Test 6',
    '1:02 Test 7',
    '2:12 Integer',
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
      tags: { mplayerEdlType: '0' },
    },
    { start: 7.1,
      end: undefined,
      name: 'Cut',
      tags: { mplayerEdlType: '0' },
    },
    {
      end: 16.7,
      start: 15,
      name: 'Mute',
      tags: { mplayerEdlType: '1' },
    },
    {
      end: 255.3,
      start: 1,
      name: 'Scene Marker',
      tags: { mplayerEdlType: '2' },
    },
    {
      end: 822,
      start: 420,
      name: 'Commercial Break',
      tags: { mplayerEdlType: '3' },
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
      mplayerEdlType: '0',
    },
  }]);
});

it('parses xmeml 1', async () => {
  expect(parseXmeml(await readFixture('Final Cut Pro XMEML.xml'))).toMatchSnapshot();
});

it('parses xmeml 2', async () => {
  expect(parseXmeml(await readFixture('Final Cut Pro XMEML 2.xml'))).toMatchSnapshot();
});

// see https://github.com/mifi/lossless-cut/issues/1195
it('parses xmeml - with multiple tracks', async () => {
  expect(parseXmeml(await readFixture('Final Cut Pro XMEML 3.xml'))).toMatchSnapshot();
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
  const parsed = await parseCsv(csvFramesStr, getFrameValParser(fps));

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

const csvTimestampStr = `\
00:01:54.612,00:03:09.053,A
  00:05:00.448,00:07:56.194,B  
00:09:27.075,00:11:44.264,C
0,1,D
1.01,1.99,E
0:2,0:3,F
`;

it('parses csv with timestamps', async () => {
  const parsed = await parseCsv(csvTimestampStr, parseCsvTime);

  expect(parsed).toEqual([
    { end: 189.053, name: 'A', start: 114.612 },
    { end: 476.194, name: 'B', start: 300.448 },
    { end: 704.264, name: 'C', start: 567.075 },
    { end: 1, name: 'D', start: 0 },
    { end: 1.99, name: 'E', start: 1.01 },
    { start: 2, name: 'F', end: 3 },
  ]);
});

const cutlistStr = `
[General]
Application=SomeApplication.exe
Version=0.0.0.1
FramesPerSecond=25
IntendedCutApplicationName=SomeApplication
IntendedCutApplication=SomeApplication.exe
VDUseSmartRendering=1
IntendedCutApplicationVersion=1.7.8
comment1=The following parts of the movie will be kept, the rest will be cut out.
comment2=All values are given in seconds.
NoOfCuts=2
ApplyToFile=Some_File_Name.avi
OriginalFileSizeBytes=123456

[Cut0]
Start=849.12
StartFrame=21228
Duration=1881.84
DurationFrames=47046

[Cut1]
Start=3147.72
StartFrame=78693
Duration=944.6
DurationFrames=23615

[Info]
Author=AuthorName
RatingByAuthor=0
EPGError=0
ActualContent=
MissingBeginning=0
MissingEnding=0
MissingVideo=0
MissingAudio=0
OtherError=0
OtherErrorDescription=
SuggestedMovieName=
UserComment=cutted with XXXX

[Meta]
CutlistId=12345
GeneratedOn=1900-01-01 00:00:01
GeneratedBy=cutlist v0.0.0
`;

it('parses cutlist', async () => {
  const parsed = await parseCutlist(cutlistStr);

  expect(parsed).toEqual([
    { end: 2730.96, name: 'Cut 0', start: 849.12 },
    { end: 4092.32, name: 'Cut 1', start: 3147.72 },
  ]);
});

it('parses pbf', async () => {
  expect(parsePbf(await readFixtureBinary('test1.pbf'))).toMatchSnapshot();
  expect(parsePbf(await readFixtureBinary('test2.pbf'))).toMatchSnapshot();
  expect(parsePbf(await readFixtureBinary('test3.pbf'))).toMatchSnapshot();
  expect(parsePbf(await readFixtureBinary('potplayer bookmark format utf16le issue 867.pbf'))).toMatchSnapshot();
});

it('parses srt', async () => {
  expect(parseSrtToSegments(await readFixture('sample.srt'))).toMatchSnapshot();
});

it('format srt', async () => {
  expect(formatSrt(parseSrtToSegments(await readFixture('sample.srt')))).toMatchSnapshot();
});

// https://github.com/mifi/lossless-cut/issues/1664
it('parses DV Analyzer Summary.txt', async () => {
  expect(parseDvAnalyzerSummaryTxt(await readFixture('DV Analyzer Summary.txt', 'utf8'))).toMatchSnapshot();
});

test('parseGpsLine', () => {
  expect(parseGpsLine('F/2.8, SS 776.89, ISO 100, EV -1.0, GPS (15.0732, 67.9771, 19), D 67.78m, H 20.30m, H.S 1.03m/s, V.S 0.00m/s')).toMatchSnapshot();
  // https://github.com/mifi/lossless-cut/issues/2072#issuecomment-2325755148
  expect(parseGpsLine('F/2.8, SS 678.52, ISO 100, EV 0, DZOOM 1.000, GPS (-3.9130, 56.5019, 26), D 0.57m, H 102.40m, H.S 0.00m/s, V.S -0.00m/s')).toMatchSnapshot();
});
