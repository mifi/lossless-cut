import invariant from 'tiny-invariant';
import { FFprobeStream, FFprobeStreamDisposition } from '../../../../ffprobe';
import { AllFilesMeta, ChromiumHTMLAudioElement, ChromiumHTMLVideoElement, CopyfileStreams, LiteFFprobeStream } from '../types';
import type { FileStream } from '../ffmpeg';


// taken from `ffmpeg -codecs`
export const pcmAudioCodecs = [
  'adpcm_4xm',
  'adpcm_adx',
  'adpcm_afc',
  'adpcm_agm',
  'adpcm_aica',
  'adpcm_argo',
  'adpcm_ct',
  'adpcm_dtk',
  'adpcm_ea',
  'adpcm_ea_maxis_xa',
  'adpcm_ea_r1',
  'adpcm_ea_r2',
  'adpcm_ea_r3',
  'adpcm_ea_xas',
  'adpcm_g722',
  'adpcm_g726',
  'adpcm_g726le',
  'adpcm_ima_alp',
  'adpcm_ima_amv',
  'adpcm_ima_apc',
  'adpcm_ima_apm',
  'adpcm_ima_cunning',
  'adpcm_ima_dat4',
  'adpcm_ima_dk3',
  'adpcm_ima_dk4',
  'adpcm_ima_ea_eacs',
  'adpcm_ima_ea_sead',
  'adpcm_ima_iss',
  'adpcm_ima_moflex',
  'adpcm_ima_mtf',
  'adpcm_ima_oki',
  'adpcm_ima_qt',
  'adpcm_ima_rad',
  'adpcm_ima_smjpeg',
  'adpcm_ima_ssi',
  'adpcm_ima_wav',
  'adpcm_ima_ws',
  'adpcm_ms',
  'adpcm_mtaf',
  'adpcm_psx',
  'adpcm_sbpro_2',
  'adpcm_sbpro_3',
  'adpcm_sbpro_4',
  'adpcm_swf',
  'adpcm_thp',
  'adpcm_thp_le',
  'adpcm_vima',
  'adpcm_xa',
  'adpcm_yamaha',
  'adpcm_zork',
  'pcm_alaw',
  'pcm_bluray',
  'pcm_dvd',
  'pcm_f16le',
  'pcm_f24le',
  'pcm_f32be',
  'pcm_f32le',
  'pcm_f64be',
  'pcm_f64le',
  'pcm_lxf',
  'pcm_mulaw',
  'pcm_s16be',
  'pcm_s16be_planar',
  'pcm_s16le',
  'pcm_s16le_planar',
  'pcm_s24be',
  'pcm_s24daud',
  'pcm_s24le',
  'pcm_s24le_planar',
  'pcm_s32be',
  'pcm_s32le',
  'pcm_s32le_planar',
  'pcm_s64be',
  'pcm_s64le',
  'pcm_s8',
  'pcm_s8_planar',
  'pcm_sga',
  'pcm_u16be',
  'pcm_u16le',
  'pcm_u24be',
  'pcm_u24le',
  'pcm_u32be',
  'pcm_u32le',
  'pcm_u8',
  'pcm_vidc',
];

export function getActiveDisposition(disposition: FFprobeStreamDisposition | undefined) {
  if (disposition == null) return undefined;
  const existingActiveDispositionEntry = Object.entries(disposition).find(([, value]) => value === 1);
  if (!existingActiveDispositionEntry) return undefined;
  return existingActiveDispositionEntry[0]; // return the key
}

export const isMov = (format: string | undefined) => format != null && ['ismv', 'ipod', 'mp4', 'mov'].includes(format);

export const isMatroska = (format: string | undefined) => format != null && ['matroska', 'webm'].includes(format);

type GetVideoArgsFn = (a: { streamIndex: number, outputIndex: number }) => string[] | undefined;

function getPerStreamFlags({ stream, outputIndex, outFormat, manuallyCopyDisposition = false, getVideoArgs = () => undefined, areWeCutting }: {
  stream: LiteFFprobeStream, outputIndex: number, outFormat: string | undefined, manuallyCopyDisposition?: boolean | undefined, getVideoArgs?: GetVideoArgsFn | undefined, areWeCutting: boolean | undefined
}) {
  let args: string[] = [];

  function addArgs(...newArgs: string[]) {
    args.push(...newArgs);
  }
  function addCodecArgs(codec: string) {
    addArgs(`-c:${outputIndex}`, codec);
  }

  // eslint-disable-next-line unicorn/prefer-switch
  if (stream.codec_type === 'subtitle') {
    // mp4/mov only supports mov_text, so convert it https://stackoverflow.com/a/17584272/6519037
    // https://github.com/mifi/lossless-cut/issues/418
    // and dvb_subtitle cannot be converted to mov_text (it will give error "Subtitle encoding currently only possible from text to text or bitmap to bitmap")
    if (isMov(outFormat) && !['dvb_subtitle', 'mov_text'].includes(stream.codec_name)) {
      addCodecArgs('mov_text');
    } else if (outFormat === 'matroska' && stream.codec_name === 'mov_text') {
      // matroska doesn't support mov_text, so convert it to SRT (popular codec)
      // https://github.com/mifi/lossless-cut/issues/418
      // https://www.reddit.com/r/PleX/comments/bcfvev/can_someone_eli5_subtitles/
      addCodecArgs('srt');
    } else if (outFormat === 'webm' && stream.codec_name !== 'webvtt') {
      // Only WebVTT subtitles are supported for WebM.
      // https://github.com/mifi/lossless-cut/issues/2179#issuecomment-2395413115
      addCodecArgs('webvtt');
    // eslint-disable-next-line unicorn/prefer-switch
    } else if (outFormat === 'srt') { // not technically lossless but why not
      addCodecArgs('srt');
    } else if (outFormat === 'ass') { // not technically lossless but why not
      addCodecArgs('ass');
    } else if (outFormat === 'webvtt') { // not technically lossless but why not
      addCodecArgs('webvtt');
    } else {
      addCodecArgs('copy');
    }
  } else if (stream.codec_type === 'audio') {
    // pcm_bluray should only ever be put in Blu-ray-style m2ts files, Matroska has no format mapping for it anyway.
    // Use normal PCM (ie. pcm_s16le or pcm_s24le depending on bitdepth).
    // https://forum.doom9.org/showthread.php?t=174718
    // https://github.com/mifi/lossless-cut/issues/476
    // ffmpeg cannot encode pcm_bluray
    if (stream.codec_name === 'pcm_bluray' && outFormat !== 'mpegts') {
      addCodecArgs('pcm_s24le');
    } else if (stream.codec_name === 'pcm_dvd' && outFormat != null && ['matroska', 'mov'].includes(outFormat)) {
      // https://github.com/mifi/lossless-cut/discussions/2092
      // coolitnow-partial.vob
      // https://superuser.com/questions/1272614/use-ffmpeg-to-merge-mpeg2-files-with-pcm-dvd-audio
      addCodecArgs('pcm_s32le');
    } else if (outFormat === 'dv' && stream.codec_name === 'pcm_s16le' && stream.sample_rate !== '48000') {
      // DV seems to require 48kHz output
      // https://trac.ffmpeg.org/ticket/8352
      // I think DV format only supports PCM_S16LE https://github.com/FFmpeg/FFmpeg/blob/b92028346c35dad837dd1160930435d88bd838b5/libavformat/dvenc.c#L450
      addCodecArgs('pcm_s16le');
      addArgs(`-ar:${outputIndex}`, '48000'); // maybe technically not lossless?
    } else if (outFormat === 'flac' && areWeCutting && stream.codec_name === 'flac') { // https://github.com/mifi/lossless-cut/issues/1809
      addCodecArgs('flac'); // lossless because flac is a lossless codec
    } else {
      addCodecArgs('copy');
    }
  } else if (stream.codec_type === 'video') {
    const videoArgs = getVideoArgs({ streamIndex: stream.index, outputIndex });
    if (videoArgs) {
      args = [...videoArgs];
    } else {
      addCodecArgs('copy');
    }

    if (isMov(outFormat)) {
      // 0x31766568 see https://github.com/mifi/lossless-cut/issues/1444
      // eslint-disable-next-line unicorn/prefer-switch, unicorn/no-lonely-if
      if (['0x0000', '0x31637668', '0x31766568'].includes(stream.codec_tag) && stream.codec_name === 'hevc') {
        addArgs(`-tag:${outputIndex}`, 'hvc1');
      }
    }
  } else { // other stream types
    addCodecArgs('copy');
  }

  // when concat'ing, disposition doesn't seem to get automatically transferred by ffmpeg, so we must do it manually
  if (manuallyCopyDisposition && stream.disposition != null) {
    const activeDisposition = getActiveDisposition(stream.disposition);
    if (activeDisposition != null) {
      addArgs(`-disposition:${outputIndex}`, String(activeDisposition));
    }
  }

  args = [...args];

  return args;
}

export function getMapStreamsArgs({ startIndex = 0, outFormat, allFilesMeta, copyFileStreams, manuallyCopyDisposition, getVideoArgs, areWeCutting }: {
  startIndex?: number,
  outFormat: string | undefined,
  allFilesMeta: Record<string, Pick<AllFilesMeta[string], 'streams'>>,
  copyFileStreams: CopyfileStreams,
  manuallyCopyDisposition?: boolean,
  getVideoArgs?: GetVideoArgsFn,
  areWeCutting?: boolean,
}) {
  let args: string[] = [];
  let outputIndex = startIndex;

  copyFileStreams.forEach(({ streamIds, path }, fileIndex) => {
    streamIds.forEach((streamId) => {
      const { streams } = allFilesMeta[path]!;
      const stream = streams.find((s) => s.index === streamId);
      invariant(stream != null);
      args = [
        ...args,
        '-map', `${fileIndex}:${streamId}`,
        ...getPerStreamFlags({ stream, outputIndex, outFormat, manuallyCopyDisposition, getVideoArgs, areWeCutting }),
      ];
      outputIndex += 1;
    });
  });
  return args;
}

export function shouldCopyStreamByDefault(stream: FFprobeStream) {
  // https://www.ffmpeg.org/doxygen/3.2/libavutil_2utils_8c_source.html#l00079
  switch (stream.codec_type) {
    case 'audio':
    case 'attachment':
    case 'video': {
      return true;
    }
    case 'subtitle': {
      return stream.codec_name !== 'dvb_teletext'; // ffmpeg doesn't seem to support this https://github.com/mifi/lossless-cut/issues/1343
    }
    case 'data': {
      // can handle gopro gpmd https://github.com/mifi/lossless-cut/issues/2134
      // no other data tracks are known to be supported (might be added later)
      return stream.codec_name === 'bin_data' && stream.codec_tag_string === 'gpmd';
    }

    default: {
      return false;
    }
  }
}

export const attachedPicDisposition = 'attached_pic';

export function isStreamThumbnail(stream: Pick<FFprobeStream, 'codec_type' | 'disposition'>) {
  return stream && stream.codec_type === 'video' && stream.disposition?.[attachedPicDisposition] === 1;
}

export const getAudioStreams = <T extends Pick<FFprobeStream, 'codec_type'>>(streams: T[]) => streams.filter((stream) => stream.codec_type === 'audio');
export const getRealVideoStreams = <T extends Pick<FFprobeStream, 'codec_type' | 'disposition'>>(streams: T[]) => streams.filter((stream) => stream.codec_type === 'video' && !isStreamThumbnail(stream));
export const getSubtitleStreams = <T extends Pick<FFprobeStream, 'codec_type'>>(streams: T[]) => streams.filter((stream) => stream.codec_type === 'subtitle');
export const isGpsStream = <T extends Pick<FileStream, 'guessedType' | 'codec_type' | 'tags'>>(stream: T) => stream.codec_type === 'subtitle' && (stream.tags?.['handler_name'] === '\u0010DJI.Subtitle' || stream.guessedType === 'dji-gps-srt');

// videoTracks/audioTracks seems to be 1-indexed, while ffmpeg is 0-indexes
const getHtml5TrackId = (ffmpegTrackIndex: number) => String(ffmpegTrackIndex + 1);

const getHtml5VideoTracks = (video: ChromiumHTMLVideoElement) => [...(video.videoTracks ?? [])];
const getHtml5AudioTracks = (audio: ChromiumHTMLAudioElement) => [...(audio.audioTracks ?? [])];

const getVideoTrackForStreamIndex = (video: ChromiumHTMLVideoElement, index: number) => getHtml5VideoTracks(video).find((videoTrack) => videoTrack.id === getHtml5TrackId(index));
const getAudioTrackForStreamIndex = (audio: ChromiumHTMLAudioElement, index: number) => getHtml5AudioTracks(audio).find((audioTrack) => audioTrack.id === getHtml5TrackId(index));

// although not technically correct, if video and audio index is null, assume that we can play
// the user can select an audio/video track if they want ffmpeg assisted playback
export const canHtml5PlayerPlayStreams = (videoEl: ChromiumHTMLVideoElement, videoIndex: number | undefined, audioIndex: number | undefined) => (
  (videoIndex == null || getVideoTrackForStreamIndex(videoEl, videoIndex) != null)
  && (audioIndex == null || getAudioTrackForStreamIndex(videoEl, audioIndex) != null)
);

function resetVideoTrack(video: ChromiumHTMLVideoElement) {
  console.log('Resetting video track');
  getHtml5VideoTracks(video).forEach((track, index) => {
    // eslint-disable-next-line no-param-reassign
    track.selected = index === 0;
  });
}

function resetAudioTrack(video: ChromiumHTMLVideoElement) {
  console.log('Resetting audio track');
  getHtml5AudioTracks(video).forEach((track, index) => {
    // eslint-disable-next-line no-param-reassign
    track.enabled = index === 0;
  });
}

// https://github.com/mifi/lossless-cut/issues/256
export function enableVideoTrack(video: ChromiumHTMLVideoElement, index: number | undefined) {
  if (index == null) {
    console.log('Resetting video track');
    resetVideoTrack(video);
    return;
  }
  console.log('Enabling video track', index);
  getHtml5VideoTracks(video).forEach((track) => {
    // eslint-disable-next-line no-param-reassign
    track.selected = track.id === getHtml5TrackId(index);
  });
}

export function enableAudioTrack(video: ChromiumHTMLVideoElement, index: number | undefined) {
  if (index == null) {
    console.log('Resetting audio track');
    resetAudioTrack(video);
    return;
  }
  console.log('Enabling audio track', index);
  getHtml5AudioTracks(video).forEach((track) => {
    // eslint-disable-next-line no-param-reassign
    track.enabled = track.id === getHtml5TrackId(index);
  });
}

export function getStreamIdsToCopy({ streams, includeAllStreams }: { streams: LiteFFprobeStream[], includeAllStreams: boolean }) {
  if (includeAllStreams) {
    return {
      streamIdsToCopy: streams.map((stream) => stream.index),
      excludedStreamIds: [],
    };
  }

  // If preserveMetadataOnMerge option is enabled, we MUST explicitly map all streams even if includeAllStreams=false.
  // We cannot use the ffmpeg's automatic stream selection or else ffmpeg might use the metadata source input (index 1)
  // instead of the concat input (index 0)
  // https://ffmpeg.org/ffmpeg.html#Automatic-stream-selection
  const streamIdsToCopy: number[] = [];
  // TODO try to mimic ffmpeg default mapping https://ffmpeg.org/ffmpeg.html#Automatic-stream-selection
  const videoStreams = getRealVideoStreams(streams);
  const audioStreams = getAudioStreams(streams);
  const subtitleStreams = getSubtitleStreams(streams);
  if (videoStreams.length > 0) streamIdsToCopy.push(videoStreams[0]!.index);
  if (audioStreams.length > 0) streamIdsToCopy.push(audioStreams[0]!.index);
  if (subtitleStreams.length > 0) streamIdsToCopy.push(subtitleStreams[0]!.index);

  const excludedStreamIds = streams.filter((s) => !streamIdsToCopy.includes(s.index)).map((s) => s.index);
  return { streamIdsToCopy, excludedStreamIds };
}

// this is just a rough check, could be improved
// todo check more accurately based on actual video stream
// https://github.com/StaZhu/enable-chromium-hevc-hardware-decoding#how-to-verify-certain-profile-or-resolution-is-supported
// https://github.com/mifi/lossless-cut/issues/88#issuecomment-1363828563
export async function doesPlayerSupportHevcPlayback() {
  const { supported } = await navigator.mediaCapabilities.decodingInfo({
    type: 'file',
    video: {
      contentType: 'video/mp4; codecs="hev1.1.6.L93.B0"', // Main
      width: 1920,
      height: 1080,
      bitrate: 10000,
      framerate: 30,
    },
  });
  return supported;
}

// With some codecs, the player will not give a playback error, but instead only play audio,
// so we will detect these codecs and convert to dummy
// "properly handle" here means either play it back or give a playback error if the video codec is not supported
// todo maybe improve https://github.com/mifi/lossless-cut/issues/88#issuecomment-1363828563
export function willPlayerProperlyHandleVideo({ streams, hevcPlaybackSupported, isMasBuild }: {
  streams: FFprobeStream[],
  hevcPlaybackSupported: boolean,
  isMasBuild: boolean,
}) {
  const realVideoStreams = getRealVideoStreams(streams);
  // If audio-only format, assume all is OK
  if (realVideoStreams.length === 0) return true;

  // https://github.com/mifi/lossless-cut/issues/2562
  // https://github.com/mifi/lossless-cut/issues/2548
  // https://github.com/electron/electron/issues/47947
  if (isMasBuild && realVideoStreams.some((s) => s.color_space != null && ['bt2020nc', 'bt2020_ncl', 'bt2020c', 'bt2020_cl'].includes(s.color_space) && s.color_primaries === 'bt2020')) {
    return false;
  }

  // If we have at least one video that is NOT of the unsupported formats, assume the player will be able to play it natively
  // But cover art / thumbnail streams don't count e.g. hevc with a png stream (disposition.attached_pic=1)
  // https://github.com/mifi/lossless-cut/issues/595
  // https://github.com/mifi/lossless-cut/issues/975
  // https://github.com/mifi/lossless-cut/issues/1407
  // https://github.com/mifi/lossless-cut/issues/1505 https://samples.ffmpeg.org/archive/video/mjpeg/mov+mjpeg+pcm_u8++MPlayerRC1PlaybackCrash_david@pastornet.net.au.mov
  // https://github.com/mifi/lossless-cut/issues/2110
  const chromiumSilentlyFailCodecs = ['prores', 'mpeg4', 'mpeg2video', 'tscc2', 'dvvideo', 'mjpeg', 'ffv1'];
  if (!hevcPlaybackSupported) chromiumSilentlyFailCodecs.push('hevc');
  return realVideoStreams.some((stream) => !chromiumSilentlyFailCodecs.includes(stream.codec_name));
}

export function isAudioDefinitelyNotSupported(streams: FFprobeStream[]) {
  const audioStreams = getAudioStreams(streams);
  if (audioStreams.length === 0) return false;
  // TODO this could be improved
  return audioStreams.every((stream) => ['ac3', 'eac3', 'dts'].includes(stream.codec_name));
}

export function getVideoTimebase(videoStream: Pick<FFprobeStream, 'time_base'>) {
  const timebaseMatch = videoStream.time_base && videoStream.time_base.split('/');
  if (timebaseMatch) {
    const timebaseParsed = parseInt(timebaseMatch[1]!, 10);
    if (!Number.isNaN(timebaseParsed)) return timebaseParsed;
  }
  return undefined;
}
