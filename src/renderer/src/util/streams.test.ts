import { test, expect } from 'vitest';

import { getMapStreamsArgs, getStreamIdsToCopy } from './streams';
import type { FFprobeStreamDisposition } from '../../../common/ffprobe';
import type { LiteFFprobeStream } from '../types';


const makeDisposition = (override?: Partial<FFprobeStreamDisposition>): FFprobeStreamDisposition => ({
  default: 0,
  dub: 0,
  original: 0,
  comment: 0,
  lyrics: 0,
  karaoke: 0,
  forced: 0,
  hearing_impaired: 0,
  visual_impaired: 0,
  clean_effects: 0,
  attached_pic: 0,
  timed_thumbnails: 0,
  captions: 0,
  descriptions: 0,
  metadata: 0,
  dependent: 0,
  still_image: 0,
  ...override,
});

const streams1: LiteFFprobeStream[] = [
  { index: 0, codec_type: 'video', codec_tag: '0x0000', codec_name: 'mjpeg', time_base: '', disposition: makeDisposition({ attached_pic: 1 }) },
  { index: 1, codec_type: 'audio', codec_tag: '0x6134706d', codec_name: 'aac', time_base: '', disposition: makeDisposition() },
  { index: 2, codec_type: 'video', codec_tag: '0x31637661', codec_name: 'h264', time_base: '', disposition: makeDisposition() },
  { index: 3, codec_type: 'video', codec_tag: '0x0000', codec_name: 'hevc', time_base: '', disposition: makeDisposition() },
  { index: 4, codec_type: 'audio', codec_tag: '0x6134706d', codec_name: 'aac', time_base: '', disposition: makeDisposition() },
  { index: 5, codec_type: 'attachment', codec_tag: '0x0000', codec_name: 'ttf', time_base: '', disposition: makeDisposition() },
  { index: 6, codec_type: 'data', codec_tag: '0x64636d74', codec_name: '', time_base: '', disposition: makeDisposition() },
  { index: 7, codec_type: 'subtitle', codec_tag: '0x0000', codec_name: 'subrip', time_base: '', disposition: makeDisposition() },
];

const path = '/path/to/file';

const allFilesMeta = { [path]: { streams: streams1 } };

// Some files haven't got a valid video codec tag set, so change it to hvc1 (default by ffmpeg is hev1 which doesn't work in QuickTime)
// https://github.com/mifi/lossless-cut/issues/1032
// https://stackoverflow.com/questions/63468587/what-hevc-codec-tag-to-use-with-fmp4-hvc1-or-hev1
// https://stackoverflow.com/questions/32152090/encode-h265-to-hvc1-codec
test('getMapStreamsArgs', () => {
  const outFormat = 'mp4';

  expect(getMapStreamsArgs({
    allFilesMeta,
    copyFileStreams: [{ path, streamIds: streams1.map((stream) => stream.index) }],
    outFormat,
  })).toEqual([
    '-map', '0:0', '-c:0', 'copy',
    '-map', '0:1', '-c:1', 'copy',
    '-map', '0:2', '-c:2', 'copy',
    '-map', '0:3', '-c:3', 'copy',
    '-map', '0:4', '-c:4', 'copy',
    '-map', '0:5', '-c:5', 'copy',
    '-map', '0:6', '-c:6', 'copy',
    '-map', '0:7', '-c:7', 'mov_text',
  ]);
});

test('getMapStreamsArgs, subtitles to matroska', () => {
  const outFormat = 'matroska';

  const streams: LiteFFprobeStream[] = [
    { index: 0, codec_type: 'subtitle', codec_tag: '0x67337874', codec_name: 'mov_text', time_base: '', disposition: makeDisposition() },
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
  const outFormat = 'mp4';

  expect(getMapStreamsArgs({
    allFilesMeta,
    copyFileStreams: [{ path, streamIds: [0] }],
    outFormat,
    manuallyCopyDisposition: true,
  })).toEqual([
    '-map', '0:0',
    '-c:0', 'copy',
    '-disposition:0', 'attached_pic',
  ]);
});

test('getMapStreamsArgs, smart cut', () => {
  const outFormat = 'mp4';

  expect(getMapStreamsArgs({
    allFilesMeta,
    copyFileStreams: [{ path, streamIds: [1, 2, 4, 5, 6, 7] }], // only 1 video stream and the rest
    outFormat,
    manuallyCopyDisposition: true,
    getVideoArgs: ({ streamIndex, outputIndex }) => {
      if (streamIndex === 2) {
        return [
          `-c:${outputIndex}`, 'h264',
          `-b:${outputIndex}`, '123456789',
        ];
      }
      return undefined;
    },
  })).toEqual([
    '-map', '0:1',
    '-c:0', 'copy',
    '-map', '0:2',
    '-c:1', 'h264',
    '-b:1', '123456789',
    '-map', '0:4',
    '-c:2', 'copy',
    '-map', '0:5',
    '-c:3', 'copy',
    '-map', '0:6',
    '-c:4', 'copy',
    '-map', '0:7',
    '-c:5', 'mov_text',
  ]);
});

test('getStreamIdsToCopy, includeAllStreams false', () => {
  const { streamIdsToCopy, excludedStreamIds } = getStreamIdsToCopy({ streams: streams1, includeAllStreams: false });
  expect(streamIdsToCopy).toEqual([2, 1, 7]);
  expect(excludedStreamIds).toEqual([0, 3, 4, 5, 6]);
});

test('srt output', () => {
  expect(getMapStreamsArgs({
    allFilesMeta: { [path]: { streams: [{ index: 0, codec_type: 'subtitle', codec_tag: '0x67337874', codec_name: 'mov_text', time_base: '', disposition: makeDisposition() }] } },
    copyFileStreams: [{ path, streamIds: [0] }],
    outFormat: 'srt',
  })).toEqual([
    '-map', '0:0', '-c:0', 'srt',
  ]);
});

test('webvtt output', () => {
  expect(getMapStreamsArgs({
    allFilesMeta: { [path]: { streams: [{ index: 0, codec_type: 'subtitle', codec_tag: '0x67337874', codec_name: 'mov_text', time_base: '', disposition: makeDisposition() }] } },
    copyFileStreams: [{ path, streamIds: [0] }],
    outFormat: 'webvtt',
  })).toEqual([
    '-map', '0:0', '-c:0', 'webvtt',
  ]);
});

test('ass output', () => {
  expect(getMapStreamsArgs({
    allFilesMeta: { [path]: { streams: [{ index: 0, codec_type: 'subtitle', codec_tag: '0x67337874', codec_name: 'mov_text', time_base: '', disposition: makeDisposition() }] } },
    copyFileStreams: [{ path, streamIds: [0] }],
    outFormat: 'ass',
  })).toEqual([
    '-map', '0:0', '-c:0', 'ass',
  ]);
});
