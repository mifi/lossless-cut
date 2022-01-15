import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import sortBy from 'lodash/sortBy';
import useDebounceOld from 'react-use/lib/useDebounce'; // Want to phase out this

import { readFrames, findNearestKeyFrameTime as ffmpegFindNearestKeyFrameTime } from '../ffmpeg';

const maxKeyframes = 1000;
// const maxKeyframes = 100;

export default ({ keyframesEnabled, filePath, commandedTime, mainVideoStream, detectedFps, ffmpegExtractWindow }) => {
  const readingKeyframesPromise = useRef();
  const [neighbouringKeyFramesMap, setNeighbouringKeyFrames] = useState({});
  const neighbouringKeyFrames = useMemo(() => Object.values(neighbouringKeyFramesMap), [neighbouringKeyFramesMap]);

  const findNearestKeyFrameTime = useCallback(({ time, direction }) => ffmpegFindNearestKeyFrameTime({ frames: neighbouringKeyFrames, time, direction, fps: detectedFps }), [neighbouringKeyFrames, detectedFps]);

  useEffect(() => setNeighbouringKeyFrames({}), [filePath]);

  useDebounceOld(() => {
    let aborted = false;

    (async () => {
      // See getIntervalAroundTime
      // We still want to calculate keyframes even if not shouldShowKeyframes because maybe we want to be able to step to the closest keyframe
      const shouldRun = keyframesEnabled && filePath && mainVideoStream && commandedTime != null && !readingKeyframesPromise.current;
      if (!shouldRun) return;

      try {
        const promise = readFrames({ filePath, aroundTime: commandedTime, stream: mainVideoStream.index, window: ffmpegExtractWindow });
        readingKeyframesPromise.current = promise;
        const newFrames = await promise;
        if (aborted) return;
        const newKeyFrames = newFrames.filter((frame) => frame.keyframe);
        // console.log(newFrames);
        setNeighbouringKeyFrames((existingKeyFramesMap) => {
          let existingFrames = Object.values(existingKeyFramesMap);
          if (existingFrames.length >= maxKeyframes) {
            existingFrames = sortBy(existingFrames, 'createdAt').slice(newKeyFrames.length);
          }
          const toObj = (map) => Object.fromEntries(map.map((frame) => [frame.time, frame]));
          return {
            ...toObj(existingFrames),
            ...toObj(newKeyFrames),
          };
        });
      } catch (err) {
        console.error('Failed to read keyframes', err);
      } finally {
        readingKeyframesPromise.current = undefined;
      }
    })();

    return () => {
      aborted = true;
    };
  }, 500, [keyframesEnabled, filePath, commandedTime, mainVideoStream, ffmpegExtractWindow]);

  return {
    neighbouringKeyFrames, findNearestKeyFrameTime,
  };
};
