import { useCallback, useMemo } from 'react';
import { FormatTimecode, ParseTimecode } from '../types';
import { getFrameCountRaw } from '../edlFormats';
import { getFrameDuration } from '../util';
import { TimecodeFormat } from '../../../../types';
import { formatDuration, parseDuration } from '../util/duration';


export default ({ detectedFps, timecodeFormat }: {
  detectedFps: number | undefined,
  timecodeFormat: TimecodeFormat,
}) => {
  const getFrameCount = useCallback((sec: number) => getFrameCountRaw(detectedFps, sec), [detectedFps]);
  const frameCountToDuration = useCallback((frames: number) => getFrameDuration(detectedFps) * frames, [detectedFps]);

  const formatTimecode = useCallback<FormatTimecode>(({ seconds, shorten, fileNameFriendly }) => {
    if (timecodeFormat === 'frameCount') {
      const frameCount = getFrameCount(seconds);
      return frameCount != null ? String(frameCount) : '';
    }
    if (timecodeFormat === 'seconds') {
      return seconds.toFixed(3);
    }
    if (timecodeFormat === 'timecodeWithFramesFraction') {
      return formatDuration({ seconds, shorten, fileNameFriendly, fps: detectedFps });
    }
    return formatDuration({ seconds, shorten, fileNameFriendly });
  }, [detectedFps, timecodeFormat, getFrameCount]);

  const timecodePlaceholder = useMemo(() => formatTimecode({ seconds: 0, shorten: false }), [formatTimecode]);

  const parseTimecode = useCallback<ParseTimecode>((val: string) => {
    if (timecodeFormat === 'frameCount') {
      const parsed = parseInt(val, 10);
      return frameCountToDuration(parsed);
    }
    if (timecodeFormat === 'seconds') {
      return parseFloat(val);
    }
    if (timecodeFormat === 'timecodeWithFramesFraction') {
      return parseDuration(val, detectedFps);
    }
    return parseDuration(val);
  }, [detectedFps, frameCountToDuration, timecodeFormat]);

  const formatTimeAndFrames = useCallback((seconds: number) => {
    const frameCount = getFrameCount(seconds);

    const timeStr = timecodeFormat === 'timecodeWithFramesFraction'
      ? formatDuration({ seconds, fps: detectedFps })
      : formatDuration({ seconds });

    return `${timeStr} (${frameCount ?? '0'})`;
  }, [detectedFps, timecodeFormat, getFrameCount]);

  return {
    parseTimecode,
    formatTimecode,
    formatTimeAndFrames,
    timecodePlaceholder,
    getFrameCount,
  };
};
