import { useState, useCallback, useRef, useEffect } from 'react';
import useDebounceOld from 'react-use/lib/useDebounce'; // Want to phase out this

import { readFrames, findNearestKeyFrameTime as ffmpegFindNearestKeyFrameTime } from '../ffmpeg';


export default ({ keyframesEnabled, filePath, commandedTime, mainVideoStream, detectedFps, ffmpegExtractWindow }) => {
  const readingKeyframesPromise = useRef();
  const [neighbouringFrames, setNeighbouringFrames] = useState([]);

  const findNearestKeyFrameTime = useCallback(({ time, direction }) => ffmpegFindNearestKeyFrameTime({ frames: neighbouringFrames, time, direction, fps: detectedFps }), [neighbouringFrames, detectedFps]);

  useEffect(() => {
    setNeighbouringFrames([]);
  }, [filePath]);

  useDebounceOld(() => {
    // We still want to calculate keyframes even if not shouldShowKeyframes because maybe we want to be able to step to the closest keyframe
    const shouldRun = () => keyframesEnabled && filePath && mainVideoStream && commandedTime != null;

    async function run() {
      if (!shouldRun() || readingKeyframesPromise.current) return;

      try {
        const promise = readFrames({ filePath, aroundTime: commandedTime, stream: mainVideoStream.index, window: ffmpegExtractWindow });
        readingKeyframesPromise.current = promise;
        const newFrames = await promise;
        if (!shouldRun()) return;
        // console.log(newFrames);
        setNeighbouringFrames(newFrames);
      } catch (err) {
        console.error('Failed to read keyframes', err);
      } finally {
        readingKeyframesPromise.current = undefined;
      }
    }
    run();
  }, 500, [keyframesEnabled, filePath, commandedTime, mainVideoStream]);

  return {
    neighbouringFrames, findNearestKeyFrameTime,
  };
};
