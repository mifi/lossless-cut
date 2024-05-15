import { getRealVideoStreams, getVideoTimebase } from './util/streams';

import { readKeyframesAroundTime, findNextKeyframe, findKeyframeAtExactTime } from './ffmpeg';
import { FFprobeStream } from '../../../ffprobe';

const { stat } = window.require('fs-extra');


const mapVideoCodec = (codec: string) => ({ av1: 'libsvtav1' }[codec] ?? codec);

// eslint-disable-next-line import/prefer-default-export
export async function getSmartCutParams({ path, videoDuration, desiredCutFrom, streams }: {
  path: string, videoDuration: number | undefined, desiredCutFrom: number, streams: FFprobeStream[],
}) {
  const videoStreams = getRealVideoStreams(streams);
  if (videoStreams.length > 1) throw new Error('Can only smart cut video with exactly one video stream');

  const [videoStream] = videoStreams;

  if (videoStream == null) throw new Error('Smart cut only works on videos');

  const readKeyframes = async (window: number) => readKeyframesAroundTime({ filePath: path, streamIndex: videoStream.index, aroundTime: desiredCutFrom, window });

  let keyframes = await readKeyframes(10);

  const keyframeAtExactTime = findKeyframeAtExactTime(keyframes, desiredCutFrom);
  if (keyframeAtExactTime) {
    console.log('Start cut is already on exact keyframe', keyframeAtExactTime.time);

    return {
      losslessCutFrom: keyframeAtExactTime.time,
      videoStreamIndex: videoStream.index,
      segmentNeedsSmartCut: false,
    };
  }

  let nextKeyframe = findNextKeyframe(keyframes, desiredCutFrom);

  if (nextKeyframe == null) {
    // try again with a larger window
    keyframes = await readKeyframes(60);
    nextKeyframe = findNextKeyframe(keyframes, desiredCutFrom);
  }
  if (nextKeyframe == null) throw new Error('Cannot find any keyframe after the desired start cut point');

  console.log('Smart cut from keyframe', { keyframe: nextKeyframe.time, desiredCutFrom });

  let videoBitrate = parseInt(videoStream.bit_rate!, 10);
  if (Number.isNaN(videoBitrate)) {
    console.warn('Unable to detect input bitrate');
    const stats = await stat(path);
    if (videoDuration == null) throw new Error('Video duration is unknown, cannot estimate bitrate');
    videoBitrate = (stats.size * 8) / videoDuration;
  }

  // to account for inaccuracies and quality loss
  // see discussion https://github.com/mifi/lossless-cut/issues/126#issuecomment-1602266688
  videoBitrate = Math.floor(videoBitrate * 1.2);

  const { codec_name: detectedVideoCodec } = videoStream;
  if (detectedVideoCodec == null) throw new Error('Unable to determine codec for smart cut');

  const videoCodec = mapVideoCodec(detectedVideoCodec);
  console.log({ detectedVideoCodec, videoCodec });

  const timebase = getVideoTimebase(videoStream);
  if (timebase == null) console.warn('Unable to determine timebase', videoStream.time_base);

  // seems like ffmpeg handles this itself well when encoding same source file
  // const videoLevel = parseLevel(videoStream);
  // const videoProfile = parseProfile(videoStream);

  return {
    losslessCutFrom: nextKeyframe.time,
    videoStreamIndex: videoStream.index,
    segmentNeedsSmartCut: true,
    videoCodec,
    videoBitrate: Math.floor(videoBitrate),
    videoTimebase: timebase,
  };
}
