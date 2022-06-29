import { getRealVideoStreams, getVideoTimebase } from './util/streams';

import { readFrames } from './ffmpeg';

const { stat } = window.require('fs-extra');

function mapInputToOutputCodec(inputCodec) {
  // if (inputCodec === 'hevc') return 'libx265';
  return inputCodec;
}

// eslint-disable-next-line import/prefer-default-export
export async function getSmartCutParams({ path, videoDuration, desiredCutFrom, streams }) {
  const videoStreams = getRealVideoStreams(streams);
  if (videoStreams.length > 1) throw new Error('Can only smart cut video with exactly one video stream');

  const videoStream = videoStreams[0];

  async function readKeyframes(window) {
    const frames = await readFrames({ filePath: path, aroundTime: desiredCutFrom, streamIndex: videoStream.index, window });
    return frames.filter((frame) => frame.keyframe);
  }

  let keyframes = await readKeyframes(10);

  const keyframeAtExactTime = keyframes.find((keyframe) => Math.abs(keyframe.time - desiredCutFrom) < 0.000001);
  if (keyframeAtExactTime) {
    console.log('Start cut is already on exact keyframe', keyframeAtExactTime.time);

    return {
      cutFrom: keyframeAtExactTime.time,
      videoStreamIndex: videoStream.index,
      needsSmartCut: false,
    };
  }

  const findNextKeyframe = () => keyframes.find((keyframe) => keyframe.time > desiredCutFrom); // (they are already sorted)
  let nextKeyframe = findNextKeyframe();
  if (!nextKeyframe) {
    console.log('Cannot find any keyframe after desired start cut point, trying with larger window');
    keyframes = await readKeyframes(60);
    nextKeyframe = findNextKeyframe();
  }

  if (!nextKeyframe) throw new Error('Cannot find any keyframe after desired start cut point');

  console.log('Smart cut from keyframe', { keyframe: nextKeyframe.time, desiredCutFrom });

  let videoBitrate = parseInt(videoStream.bit_rate, 10);
  if (Number.isNaN(videoBitrate)) {
    console.warn('Unable to detect input bitrate');
    const stats = await stat(path);
    videoBitrate = stats.size / videoDuration;
  }

  const videoCodec = mapInputToOutputCodec(videoStream.codec_name);
  if (videoCodec == null) throw new Error('Unable to determine codec for smart cut');

  const timebase = getVideoTimebase(videoStream);
  if (timebase == null) console.warn('Unable to determine timebase', videoStream.time_base);

  return {
    cutFrom: nextKeyframe.time,
    videoStreamIndex: videoStream.index,
    needsSmartCut: true,
    videoCodec,
    videoBitrate: Math.floor(videoBitrate),
    videoTimebase: timebase,
  };
}
