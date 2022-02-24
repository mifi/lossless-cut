import { getMapStreamsArgs, getStreamIdsToCopy } from './streams';

const streams1 = [
  { index: 0, codec_type: 'video', codec_tag: '0x0000', codec_name: 'mjpeg', disposition: { attached_pic: 1 } },
  { index: 1, codec_type: 'audio', codec_tag: '0x6134706d', codec_name: 'aac' },
  { index: 2, codec_type: 'video', codec_tag: '0x31637661', codec_name: 'h264' },
  { index: 3, codec_type: 'video', codec_tag: '0x0000', codec_name: 'hevc' },
  { index: 4, codec_type: 'audio', codec_tag: '0x6134706d', codec_name: 'aac' },
  { index: 5, codec_type: 'attachment', codec_tag: '0x0000', codec_name: 'ttf' },
  { index: 6, codec_type: 'data', codec_tag: '0x64636d74' },
  { index: 7, codec_type: 'subtitle', codec_tag: '0x0000', codec_name: 'subrip' },
];

// Some files haven't got a valid video codec tag set, so change it to hvc1 (default by ffmpeg is hev1 which doesn't work in QuickTime)
// https://github.com/mifi/lossless-cut/issues/1032
// https://stackoverflow.com/questions/63468587/what-hevc-codec-tag-to-use-with-fmp4-hvc1-or-hev1
// https://stackoverflow.com/questions/32152090/encode-h265-to-hvc1-codec
test('getMapStreamsArgs', () => {
  const path = '/path/file.mp4';
  const outFormat = 'mp4';

  expect(getMapStreamsArgs({
    allFilesMeta: { [path]: { streams: streams1 } },
    copyFileStreams: [{ path, streamIds: streams1.map((stream) => stream.index) }],
    outFormat,
  })).toEqual([
    '-map', '0:0',
    '-map', '0:1',
    '-map', '0:2',
    '-map', '0:3', '-tag:3', 'hvc1',
    '-map', '0:4',
    '-map', '0:5',
    '-map', '0:6',
    '-map', '0:7', '-c:7', 'mov_text',
  ]);
});

test('getMapStreamsArgs, subtitles to matroska', () => {
  const path = '/path/file.mkv';
  const outFormat = 'matroska';

  const streams = [
    { index: 0, codec_type: 'subtitle', codec_tag: '0x67337874', codec_name: 'mov_text' },
  ];

  expect(getMapStreamsArgs({
    allFilesMeta: { [path]: { streams } },
    copyFileStreams: [{ path, streamIds: streams.map((stream) => stream.index) }],
    outFormat,
  })).toEqual([
    '-map', '0:0', '-c:0', 'srt',
  ]);
});

test('getMapStreamsArgs, disposition', () => {
  const path = '/path/file.mp4';
  const outFormat = 'mp4';

  expect(getMapStreamsArgs({
    allFilesMeta: { [path]: { streams: streams1 } },
    copyFileStreams: [{ path, streamIds: [0] }],
    outFormat,
    manuallyCopyDisposition: true,
  })).toEqual([
    '-map', '0:0',
    '-disposition:0', 'attached_pic',
  ]);
});

test('getStreamIdsToCopy, includeAllStreams false', () => {
  const streamIdsToCopy = getStreamIdsToCopy({ streams: streams1, includeAllStreams: false });
  expect(streamIdsToCopy).toEqual([2, 1, 7]);
});
