// https://www.ffmpeg.org/doxygen/3.2/libavutil_2utils_8c_source.html#l00079
export const defaultProcessedCodecTypes = [
  'video',
  'audio',
  'subtitle',
  'attachment',
];

// taken from `ffmpeg -codecs`
export const encodeablePcmCodecs = [
  'adpcm_adx',
  'adpcm_argo',
  'adpcm_g722',
  'adpcm_g726',
  'adpcm_g726le',
  'adpcm_ima_alp',
  'adpcm_ima_amv',
  'adpcm_ima_apm',
  'adpcm_ima_qt',
  'adpcm_ima_ssi',
  'adpcm_ima_wav',
  'adpcm_ms',
  'adpcm_swf',
  'adpcm_yamaha',

  'pcm_alaw',
  'pcm_dvd',

  'pcm_f32be',
  'pcm_f32le',
  'pcm_f64be',
  'pcm_f64le',

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

function getPerStreamQuirksFlags({ stream, outputIndex, outFormat, manuallyCopyDisposition = false }) {
  let args = [];
  if (['mov', 'mp4'].includes(outFormat)) {
    if (stream.codec_tag === '0x0000' && stream.codec_name === 'hevc') {
      args = [...args, `-tag:${outputIndex}`, 'hvc1'];
    }

    // mp4/mov only supports mov_text, so convert it https://stackoverflow.com/a/17584272/6519037
    // https://github.com/mifi/lossless-cut/issues/418
    if (stream.codec_type === 'subtitle' && stream.codec_name !== 'mov_text') {
      args = [...args, `-c:${outputIndex}`, 'mov_text'];
    }
  }

  if (outFormat === 'matroska') {
    // matroska doesn't support mov_text, so convert it to SRT (popular codec)
    // https://github.com/mifi/lossless-cut/issues/418
    // https://www.reddit.com/r/PleX/comments/bcfvev/can_someone_eli5_subtitles/
    if (stream.codec_type === 'subtitle' && stream.codec_name === 'mov_text') {
      args = [...args, `-c:${outputIndex}`, 'srt'];
    }
  }

  if (outFormat === 'webm') {
    // Only WebVTT subtitles are supported for WebM.
    if (stream.codec_type === 'subtitle' && stream.codec_name === 'mov_text') {
      args = [...args, `-c:${outputIndex}`, 'webvtt'];
    }
  }

  // when concat'ing, disposition doesn't seem to get automatically transferred by ffmpeg, so we must do it manually
  if (manuallyCopyDisposition && stream.disposition != null) {
    const activeDisposition = getActiveDisposition(stream.disposition);
    if (activeDisposition != null) {
      args = [...args, `-disposition:${outputIndex}`, String(activeDisposition)];
    }
  }

  return args;
}

// eslint-disable-next-line import/prefer-default-export
export function getMapStreamsArgs({ outFormat, allFilesMeta, copyFileStreams, manuallyCopyDisposition }) {
  let args = [];
  let outputIndex = 0;

  copyFileStreams.forEach(({ streamIds, path }, fileIndex) => {
    streamIds.forEach((streamId) => {
      const { streams } = allFilesMeta[path];
      const stream = streams.find((s) => s.index === streamId);
      args = [
        ...args,
        '-map', `${fileIndex}:${streamId}`,
        ...getPerStreamQuirksFlags({ stream, outputIndex, outFormat, manuallyCopyDisposition }),
      ];
      outputIndex += 1;
    });
  });
  return args;
}

export function shouldCopyStreamByDefault(stream) {
  if (!defaultProcessedCodecTypes.includes(stream.codec_type)) return false;
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

// With these codecs, the player will not give a playback error, but instead only play audio
export function doesPlayerSupportFile(streams) {
  const realVideoStreams = getRealVideoStreams(streams);
  // Don't check audio formats, assume all is OK
  if (realVideoStreams.length === 0) return true;
  // If we have at least one video that is NOT of the unsupported formats, assume the player will be able to play it natively
  // https://github.com/mifi/lossless-cut/issues/595
  // https://github.com/mifi/lossless-cut/issues/975
  // But cover art / thumbnail streams don't count e.g. hevc with a png stream (disposition.attached_pic=1)
  return realVideoStreams.some(s => !['hevc', 'prores', 'mpeg4', 'tscc2'].includes(s.codec_name));
}

export function isAudioDefinitelyNotSupported(streams) {
  const audioStreams = getAudioStreams(streams);
  if (audioStreams.length === 0) return false;
  // TODO this could be improved
  return audioStreams.every(stream => ['ac3'].includes(stream.codec_name));
}
