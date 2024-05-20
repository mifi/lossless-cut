// This code is for future use (e.g. creating black video to fill in using same codec parameters)

import { FFprobeStream } from '../../../ffprobe';

export function parseLevel(videoStream: FFprobeStream) {
  const { level: levelNumeric, codec_name: videoCodec } = videoStream;

  if (levelNumeric == null || Number.isNaN(levelNumeric)) return undefined;

  if (videoCodec === 'h264') {
    if (levelNumeric === 9) return '1b'; // 13 is 1.3. That are all like that (20 is 2.0, etc) except 1b which is 9.

    let level = (levelNumeric / 10).toFixed(1); // https://stackoverflow.com/questions/42619191/what-does-level-mean-in-ffprobe-output
    if (parseFloat(level) >= 0) {
      if (level.slice(-2) === '.0') level = level.slice(0, -2); // slice off .0
      const validLevels = ['1', '1b', '1.1', '1.2', '1.3', '2', '2.1', '2.2', '3', '3.1', '3.2', '4', '4.1', '4.2', '5', '5.1', '5.2', '6', '6.1', '6.2']; // https://en.wikipedia.org/wiki/Advanced_Video_Coding#Levels
      if (validLevels.includes(level)) return level;
    }
  } else if (videoCodec === 'hevc') {
    // Note that on MacOS we don't use x265, but videotoolbox
    let level = (levelNumeric / 30).toFixed(1); // https://stackoverflow.com/questions/69983131/whats-the-difference-between-ffprobe-level-and-h-264-level
    if (parseFloat(level) >= 0) {
      if (level.slice(-2) === '.0') level = level.slice(0, -2); // slice off .0
      const validLevels = ['1', '2', '2.1', '3', '3.1', '4', '4.1', '5', '5.1', '5.2', '6', '6.1', '6.2']; // https://en.wikipedia.org/wiki/High_Efficiency_Video_Coding_tiers_and_levels
      if (validLevels.includes(level)) return level;
    }
  }

  console.warn('Invalid level', videoCodec, levelNumeric);

  return undefined;
}

export function parseProfile(videoStream) {
  const { profile: ffprobeProfile, codec_name: videoCodec } = videoStream;

  let map;
  if (videoCodec === 'h264') {
    // List of profiles that x264 supports https://trac.ffmpeg.org/wiki/Encode/H.264
    // baseline, main, high, high10 (first 10 bit compatible profile), high422 (supports yuv420p, yuv422p, yuv420p10le and yuv422p10le), high444 (supports as above as well as yuv444p and yuv444p10le)
    // profiles returned by ffprobe: https://github.com/FFmpeg/FFmpeg/blob/c56f5be6782014fee165d361de1f548eaac7a272/libavcodec/profiles.c#L58
    // Not sure about all these...
    map = new Map([
      ['Baseline', { profile: 'baseline', warn: true }],
      ['Constrained Baseline', { profile: 'baseline', warn: true }],
      ['Main', { profile: 'main' }],
      ['Extended', { profile: 'main', warn: true }],
      ['High', { profile: 'high' }],
      ['High 10', { profile: 'high10' }],
      ['High 10 Intra', { profile: 'high10', warn: true }],
      ['High 4:2:2', { profile: 'high422' }],
      ['High 4:2:2 Intra', { profile: 'high422', warn: true }],
      ['High 4:4:4', { profile: 'high444' }],
      ['High 4:4:4 Predictive', { profile: 'high444', warn: true }],
      ['High 4:4:4 Intra', { profile: 'high444', warn: true }],
      // ['CAVLC 4:4:4', { profile: 'high444', warn: true }],
      // ['Multiview High', { profile: 'high', warn: true }],
      // ['Stereo High', { profile: 'high', warn: true }],
    ]);
  // Note that on MacOS we don't use x265, but videotoolbox
  } else if (videoCodec === 'hevc') {
    // List of profiles that x265 supports: https://x265.readthedocs.io/en/master/cli.html#profile-level-tier
    // profiles returned by ffprobe: https://github.com/FFmpeg/FFmpeg/blob/c56f5be6782014fee165d361de1f548eaac7a272/libavcodec/profiles.c#L83
    map = new Map([
      ['Main', { profile: 'main' }],
      ['Main 10', { profile: 'main10' }],
      ['Main Still Picture', { profile: 'mainstillpicture' }],
      // ['Rext', { profile: 'main', warn: true }],
    ]);
  } else {
    return undefined;
  }

  if (!map.has(ffprobeProfile)) {
    console.warn('Unknown ffprobe profile', ffprobeProfile);
    return undefined;
  }

  const match = map.get(ffprobeProfile);
  if (match.warn) console.warn('Possibly unknown ffprobe profile', ffprobeProfile);
  return match.profile;
}
