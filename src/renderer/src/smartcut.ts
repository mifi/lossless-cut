import i18n from 'i18next';

import { getRealVideoStreams, getVideoTimebase } from './util/streams';

import { readKeyframesAroundTime, findNextKeyframe, findKeyframeAtExactTime } from './ffmpeg';
import type { FFprobeStream } from '../../common/ffprobe';
import { UserFacingError } from '../errors';
import { readFileSize } from './util';


const mapVideoCodec = (codec: string) => ({ av1: 'libsvtav1' }[codec] ?? codec);

export async function needsSmartCut({ path, desiredCutFrom, videoStream }: {
  path: string,
  desiredCutFrom: number,
  videoStream: Pick<FFprobeStream, 'index'>,
}) {
  const readKeyframes = async (window: number) => readKeyframesAroundTime({ filePath: path, streamIndex: videoStream.index, aroundTime: desiredCutFrom, window });

  let keyframes = await readKeyframes(10);

  const keyframeAtExactTime = findKeyframeAtExactTime(keyframes, desiredCutFrom);
  if (keyframeAtExactTime) {
    console.log('Start cut is already on exact keyframe', keyframeAtExactTime.time);

    return {
      losslessCutFrom: keyframeAtExactTime.time,
      segmentNeedsSmartCut: false,
    };
  }

  let nextKeyframe = findNextKeyframe(keyframes, desiredCutFrom);

  if (nextKeyframe == null) {
    // try again with a larger window
    keyframes = await readKeyframes(60);
    nextKeyframe = findNextKeyframe(keyframes, desiredCutFrom);
  }
  if (nextKeyframe == null) throw new UserFacingError(i18n.t('Cannot find any keyframe after the desired start cut point'));

  console.log('Smart cut from keyframe', { keyframe: nextKeyframe.time, desiredCutFrom });

  return {
    losslessCutFrom: nextKeyframe.time,
    segmentNeedsSmartCut: true,
  };
}

// eslint-disable-next-line import/prefer-default-export
export async function getCodecParams({ path, fileDuration, streams }: {
  path: string,
  fileDuration: number | undefined,
  streams: Pick<FFprobeStream, 'time_base' | 'codec_type' | 'disposition' | 'index' | 'bit_rate' | 'codec_name'>[],
}) {
  const videoStreams = getRealVideoStreams(streams);
  if (videoStreams.length > 1) throw new Error('Can only smart cut video with exactly one video stream');

  const [videoStream] = videoStreams;

  if (videoStream == null) throw new Error('Smart cut only works on videos');

  let videoBitrate = parseInt(videoStream.bit_rate!, 10);
  if (Number.isNaN(videoBitrate)) {
    console.warn('Unable to detect input bitrate.');
    const size = await readFileSize(path);
    if (fileDuration == null) throw new Error('Video duration is unknown, cannot estimate bitrate');
    videoBitrate = (size * 8) / fileDuration;
    console.warn('Estimated bitrate.', videoBitrate / 1e6, 'Mbit/s');
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
    videoStream,
    videoCodec,
    videoBitrate: Math.floor(videoBitrate),
    videoTimebase: timebase,
  };
}
