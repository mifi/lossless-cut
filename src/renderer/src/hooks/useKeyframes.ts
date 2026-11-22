import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import sortBy from 'lodash/sortBy';
import useDebounceOld from 'react-use/lib/useDebounce'; // Want to phase out this
import { useTranslation } from 'react-i18next';

import type { Frame } from '../ffmpeg';
import { getIntervalAroundTime, findNearestKeyFrameTime as ffmpegFindNearestKeyFrameTime, readFrames } from '../ffmpeg';
import type { FFprobeStream } from '../../../common/ffprobe';
import { getFrameCountRaw } from '../edlFormats';
import type { HandleError } from '../contexts';
import type { ScannedInterval } from '../util/keyframes';
import { isRangeScanned } from '../util/keyframes';


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

  const readingKeyframesPromise = useRef<Promise<unknown>>(undefined);
  // keyframes + the time intervals that have actually been read (so we know where we *don't* have keyframe info)
  const [{ frames: neighbouringKeyFramesMap, scannedIntervals }, setKeyframesState] = useState<{ frames: Record<string, Frame>, scannedIntervals: ScannedInterval[] }>({ frames: {}, scannedIntervals: [] });

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

  const findNearestKeyFrameTime = useCallback(({ time, direction }: { time: number, direction: number }) => ffmpegFindNearestKeyFrameTime({ frames: neighbouringKeyFrames, time, direction }), [neighbouringKeyFrames]);

  // Like findNearestKeyFrameTime, but only returns a keyframe if every packet between `fromTime` and that keyframe has been read.
  // Otherwise (e.g. right after a seek to a new location, before keyframes there have been read)
  // the "nearest" keyframe found in the cache could be far away, from a previously visited location,
  // while the real nearest keyframe is simply not known yet.
  const findNearestKnownKeyFrameTime = useCallback(({ fromTime, time, direction }: { fromTime: number, time: number, direction: number }) => {
    const keyframeTime = ffmpegFindNearestKeyFrameTime({ frames: neighbouringKeyFrames, time, direction });
    if (keyframeTime == null) return undefined;
    if (!isRangeScanned(scannedIntervals, fromTime, keyframeTime)) return undefined;
    return keyframeTime;
  }, [neighbouringKeyFrames, scannedIntervals]);

  // used to discard results from a previously opened file
  const fileKey = useRef(0);

  useEffect(() => {
    fileKey.current += 1;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKeyframesState({ frames: {}, scannedIntervals: [] });
  }, [filePath, videoStream]);

  useDebounceOld(() => {
    // See getIntervalAroundTime
    // We still want to calculate keyframes even if not shouldShowKeyframes because maybe we want to be able to step to the closest keyframe
    const shouldRun = keyframesEnabled && filePath != null && videoStream && commandedTime != null;
    if (!shouldRun) return;

    const myFileKey = fileKey.current;

    // If a read is already in progress, queue this one after it, instead of skipping it
    // (skipping meant that the new location would never get read unless the user seeked again)
    const promise = (async () => {
      try {
        await readingKeyframesPromise.current;
      } catch {
        // handled below
      }
      if (fileKey.current !== myFileKey) return;

      try {
        const { from, to } = getIntervalAroundTime(commandedTime, ffmpegExtractWindow);
        const newFrames = await readFrames({ filePath, from, to, streamIndex: videoStream.index });
        // Note: we don't discard the results if the user has seeked elsewhere in the meantime, because they are still valid keyframes for this file
        if (fileKey.current !== myFileKey) return;
        const createdAt = newFrames[0]?.createdAt ?? new Date();
        const newKeyFrames = newFrames.filter((frame) => frame.keyframe);
        // console.log(newFrames);
        setKeyframesState(({ frames: existingKeyFramesMap, scannedIntervals: existingIntervals }) => {
          let existingFrames = Object.values(existingKeyFramesMap);
          let intervals = existingIntervals;
          if (existingFrames.length >= maxKeyframes) {
            const sorted = sortBy(existingFrames, 'createdAt');
            const evicted = sorted.slice(0, newKeyFrames.length);
            existingFrames = sorted.slice(newKeyFrames.length);
            // we no longer have all keyframes of the intervals whose frames were evicted, so forget those intervals
            const newestEvicted = evicted.at(-1)?.createdAt;
            if (newestEvicted != null) intervals = intervals.filter((interval) => interval.createdAt > newestEvicted);
          }
          return {
            frames: {
              ...toObj(existingFrames),
              ...toObj(newKeyFrames),
            },
            scannedIntervals: [...intervals, { from, to, createdAt }],
          };
        });
      } catch (err) {
        console.error('Failed to read keyframes', err);
      }
    })();
    readingKeyframesPromise.current = promise;
    // NOTE: you have to manually pass dependencies here, eslint doesn't recognize it
  }, 500, [keyframesEnabled, filePath, commandedTime, videoStream, ffmpegExtractWindow, maxKeyframes]);

  const readAllKeyframes = useCallback(async () => {
    const { start, end } = currentCutSegOrWholeTimeline;

    if (!filePath || !videoStream) return;
    try {
      setWorking({ text: t('Reading all keyframes') });
      const newFrames = await readFrames({ filePath, from: start, to: end, streamIndex: videoStream.index });
      const newKeyFrames = newFrames.filter((frame) => frame.keyframe);
      setKeyframesState({ frames: toObj(newKeyFrames), scannedIntervals: [{ from: start, to: end, createdAt: newFrames[0]?.createdAt ?? new Date() }] });
      setMaxKeyframes(newKeyFrames.length);
    } catch (err) {
      handleError({ err });
    } finally {
      setWorking(undefined);
    }
  }, [currentCutSegOrWholeTimeline, filePath, handleError, setMaxKeyframes, setWorking, t, videoStream]);


  return {
    neighbouringKeyFrames, findNearestKeyFrameTime, findNearestKnownKeyFrameTime, keyframeByNumber, readAllKeyframes,
  };
}

export type FindNearestKeyframeTime = ReturnType<typeof useKeyframes>['findNearestKeyFrameTime'];

export default useKeyframes;
