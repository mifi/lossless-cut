import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import sortBy from 'lodash/sortBy';
import useDebounceOld from 'react-use/lib/useDebounce'; // Want to phase out this
import { useTranslation } from 'react-i18next';

import type { Frame } from '../ffmpeg';
import { readFramesAroundTime, findNearestKeyFrameTime as ffmpegFindNearestKeyFrameTime, readFrames } from '../ffmpeg';
import type { FFprobeStream } from '../../../common/ffprobe';
import { getFrameCountRaw } from '../edlFormats';
import type { HandleError } from '../contexts';


const toObj = (map: Frame[]) => Object.fromEntries(map.map((frame) => [frame.time, frame]));

function useKeyframes({ keyframesEnabled, filePath, commandedTime, videoStream, detectedFps, ffmpegExtractWindow, maxKeyframes, currentCutSegOrWholeTimeline, setWorking, setMaxKeyframes, handleError }: {
  keyframesEnabled: boolean,
  filePath: string | undefined,
  commandedTime: number,
  videoStream: FFprobeStream | undefined,
  detectedFps: number | undefined,
  ffmpegExtractWindow: number,
  maxKeyframes: number,
  currentCutSegOrWholeTimeline: { start: number, end: number },
  setWorking: (w: { text: string, abortController?: AbortController } | undefined) => void,
  setMaxKeyframes: (max: number) => void,
  handleError: HandleError,
}) {
  const { t } = useTranslation();

  const readingKeyframesPromise = useRef<Promise<unknown>>();
  const [neighbouringKeyFramesMap, setNeighbouringKeyFrames] = useState<Record<string, Frame>>({});

  const neighbouringKeyFrames = useMemo(() => Object.values(neighbouringKeyFramesMap), [neighbouringKeyFramesMap]);

  const keyframeByNumber = useMemo(() => {
    const map: Record<number, Frame> = {};
    if (detectedFps != null) {
      neighbouringKeyFrames.forEach((frame) => {
        map[getFrameCountRaw(detectedFps, frame.time)!] = frame;
      });
    }
    return map;
  }, [detectedFps, neighbouringKeyFrames]);

  const findNearestKeyFrameTime = useCallback(({ time, direction }: { time: number, direction: number }) => ffmpegFindNearestKeyFrameTime({ frames: neighbouringKeyFrames, time, direction, fps: detectedFps }), [neighbouringKeyFrames, detectedFps]);

  useEffect(() => setNeighbouringKeyFrames({}), [filePath, videoStream]);

  useDebounceOld(() => {
    let aborted = false;

    (async () => {
      // See getIntervalAroundTime
      // We still want to calculate keyframes even if not shouldShowKeyframes because maybe we want to be able to step to the closest keyframe
      const shouldRun = keyframesEnabled && filePath != null && videoStream && commandedTime != null && !readingKeyframesPromise.current;
      if (!shouldRun) return;

      try {
        const promise = readFramesAroundTime({ filePath, aroundTime: commandedTime, streamIndex: videoStream.index, window: ffmpegExtractWindow });
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
    // NOTE: you have to manually pass dependencies here, eslint doesn't recognize it
  }, 500, [keyframesEnabled, filePath, commandedTime, videoStream, ffmpegExtractWindow, maxKeyframes]);

  const readAllKeyframes = useCallback(async () => {
    const { start, end } = currentCutSegOrWholeTimeline;

    if (!filePath || !videoStream) return;
    try {
      setWorking({ text: t('Reading all keyframes') });
      const newFrames = await readFrames({ filePath, from: start, to: end, streamIndex: videoStream.index });
      const newKeyFrames = newFrames.filter((frame) => frame.keyframe);
      setNeighbouringKeyFrames(toObj(newKeyFrames));
      setMaxKeyframes(newKeyFrames.length);
    } catch (err) {
      handleError({ err });
    } finally {
      setWorking(undefined);
    }
  }, [currentCutSegOrWholeTimeline, filePath, handleError, setMaxKeyframes, setWorking, t, videoStream]);


  return {
    neighbouringKeyFrames, findNearestKeyFrameTime, keyframeByNumber, readAllKeyframes,
  };
}

export default useKeyframes;
