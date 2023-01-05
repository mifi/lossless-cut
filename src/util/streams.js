// https://www.ffmpeg.org/doxygen/3.2/libavutil_2utils_8c_source.html#l00079
const defaultProcessedCodecTypes = [
  'video',
  'audio',
  'subtitle',
  'attachment',
];

const unprocessableCodecs = [
  'dvb_teletext', // ffmpeg doesn't seem to support this https://github.com/mifi/lossless-cut/issues/1343
];

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

export function getActiveDisposition(disposition) {
  if (disposition == null) return undefined;
  const existingActiveDispositionEntry = Object.entries(disposition).find(([, value]) => value === 1);
  if (!existingActiveDispositionEntry) return undefined;
  return existingActiveDispositionEntry[0]; // return the key
}

export const isMov = (format) => ['ismv', 'ipod', 'mp4', 'mov'].includes(format);

function getPerStreamFlags({ stream, outputIndex, outFormat, manuallyCopyDisposition = false, getVideoArgs = () => {} }) {
  let args = [];

  function addCodecArgs(codec) {
    args = [...args, `-c:${outputIndex}`, codec];
  }

  if (stream.codec_type === 'subtitle') {
    // mp4/mov only supports mov_text, so convert it https://stackoverflow.com/a/17584272/6519037
    // https://github.com/mifi/lossless-cut/issues/418
    if (isMov(outFormat) && stream.codec_name !== 'mov_text') {
      addCodecArgs('mov_text');
    } else if (outFormat === 'matroska' && stream.codec_name === 'mov_text') {
      // matroska doesn't support mov_text, so convert it to SRT (popular codec)
      // https://github.com/mifi/lossless-cut/issues/418
      // https://www.reddit.com/r/PleX/comments/bcfvev/can_someone_eli5_subtitles/
      addCodecArgs('srt');
    } else if (outFormat === 'webm' && stream.codec_name === 'mov_text') {
      // Only WebVTT subtitles are supported for WebM.
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
    if (outFormat !== 'mpegts' && stream.codec_name === 'pcm_bluray') {
      addCodecArgs('pcm_s24le');
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
      if (['0x0000', '0x31637668'].includes(stream.codec_tag) && stream.codec_name === 'hevc') {
        args = [...args, `-tag:${outputIndex}`, 'hvc1'];
      }
    }
  } else { // other stream types
    addCodecArgs('copy');
  }

  // when concat'ing, disposition doesn't seem to get automatically transferred by ffmpeg, so we must do it manually
  if (manuallyCopyDisposition && stream.disposition != null) {
    const activeDisposition = getActiveDisposition(stream.disposition);
    if (activeDisposition != null) {
      args = [...args, `-disposition:${outputIndex}`, String(activeDisposition)];
    }
  }

  args = [...args];

  return args;
}

export function getMapStreamsArgs({ startIndex = 0, outFormat, allFilesMeta, copyFileStreams, manuallyCopyDisposition, getVideoArgs }) {
  let args = [];
  let outputIndex = startIndex;

  copyFileStreams.forEach(({ streamIds, path }, fileIndex) => {
    streamIds.forEach((streamId) => {
      const { streams } = allFilesMeta[path];
      const stream = streams.find((s) => s.index === streamId);
      args = [
        ...args,
        '-map', `${fileIndex}:${streamId}`,
        ...getPerStreamFlags({ stream, outputIndex, outFormat, manuallyCopyDisposition, getVideoArgs }),
      ];
      outputIndex += 1;
    });
  });
  return args;
}

export function shouldCopyStreamByDefault(stream) {
  if (!defaultProcessedCodecTypes.includes(stream.codec_type)) return false;
  if (unprocessableCodecs.includes(stream.codec_name)) return false;
  return true;
}

export function isStreamThumbnail(stream) {
  return stream && stream.disposition && stream.disposition.attached_pic === 1;
}

export const getAudioStreams = (streams) => streams.filter(stream => stream.codec_type === 'audio');
export const getRealVideoStreams = (streams) => streams.filter(stream => stream.codec_type === 'video' && !isStreamThumbnail(stream));
export const getSubtitleStreams = (streams) => streams.filter(stream => stream.codec_type === 'subtitle');

export function getStreamIdsToCopy({ streams, includeAllStreams }) {
  if (includeAllStreams) return streams.map((stream) => stream.index);

  // If preserveMetadataOnMerge option is enabled, we MUST explicitly map all streams even if includeAllStreams=false.
  // We cannot use the ffmpeg's automatic stream selection or else ffmpeg might use the metadata source input (index 1)
  // instead of the concat input (index 0)
  // https://ffmpeg.org/ffmpeg.html#Automatic-stream-selection
  const ret = [];
  // TODO try to mimic ffmpeg default mapping https://ffmpeg.org/ffmpeg.html#Automatic-stream-selection
  const videoStreams = getRealVideoStreams(streams);
  const audioStreams = getAudioStreams(streams);
  const subtitleStreams = getSubtitleStreams(streams);
  if (videoStreams.length > 0) ret.push(videoStreams[0].index);
  if (audioStreams.length > 0) ret.push(audioStreams[0].index);
  if (subtitleStreams.length > 0) ret.push(subtitleStreams[0].index);
  return ret;
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
export function willPlayerProperlyHandleVideo({ streams, hevcPlaybackSupported }) {
  const realVideoStreams = getRealVideoStreams(streams);
  // If audio-only format, assume all is OK
  if (realVideoStreams.length === 0) return true;
  // If we have at least one video that is NOT of the unsupported formats, assume the player will be able to play it natively
  // But cover art / thumbnail streams don't count e.g. hevc with a png stream (disposition.attached_pic=1)
  // https://github.com/mifi/lossless-cut/issues/595
  // https://github.com/mifi/lossless-cut/issues/975
  // https://github.com/mifi/lossless-cut/issues/1407
  const chromiumSilentlyFailCodecs = ['prores', 'mpeg4', 'tscc2', 'dvvideo'];
  if (!hevcPlaybackSupported) chromiumSilentlyFailCodecs.push('hevc');
  return realVideoStreams.some((stream) => !chromiumSilentlyFailCodecs.includes(stream.codec_name));
}

export function isAudioDefinitelyNotSupported(streams) {
  const audioStreams = getAudioStreams(streams);
  if (audioStreams.length === 0) return false;
  // TODO this could be improved
  return audioStreams.every(stream => ['ac3'].includes(stream.codec_name));
}

export function getVideoTimebase(videoStream) {
  const timebaseMatch = videoStream.time_base && videoStream.time_base.split('/');
  if (timebaseMatch) {
    const timebaseParsed = parseInt(timebaseMatch[1], 10);
    if (!Number.isNaN(timebaseParsed)) return timebaseParsed;
  }
  return undefined;
}
