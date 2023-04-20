import { useState, useRef, useEffect } from 'react';
import sortBy from 'lodash/sortBy';
import useThrottle from 'react-use/lib/useThrottle';
import { waveformColorDark, waveformColorLight } from '../colors';

import { renderWaveformPng } from '../ffmpeg';

const maxWaveforms = 100;
// const maxWaveforms = 3; // testing

export default ({ darkMode, filePath, relevantTime, durationSafe, waveformEnabled, mainAudioStream, shouldShowWaveform, ffmpegExtractWindow }) => {
  const creatingWaveformPromise = useRef();
  const [waveforms, setWaveforms] = useState([]);
  const waveformsRef = useRef();

  useEffect(() => {
    waveformsRef.current = waveforms;
  }, [waveforms]);

  const waveformColor = darkMode ? waveformColorDark : waveformColorLight;

  const timeThrottled = useThrottle(relevantTime, 1000);

  useEffect(() => {
    let aborted = false;

    (async () => {
      const waveformStartTime = Math.floor(timeThrottled / ffmpegExtractWindow) * ffmpegExtractWindow;

      const alreadyHaveWaveformAtTime = (waveformsRef.current || []).some((waveform) => waveform.from === waveformStartTime);
      const shouldRun = filePath && mainAudioStream && timeThrottled != null && shouldShowWaveform && waveformEnabled && !alreadyHaveWaveformAtTime && !creatingWaveformPromise.current;
      if (!shouldRun) return;

      try {
        const safeExtractDuration = Math.min(waveformStartTime + ffmpegExtractWindow, durationSafe) - waveformStartTime;
        const promise = renderWaveformPng({ filePath, start: waveformStartTime, duration: safeExtractDuration, color: waveformColor });
        creatingWaveformPromise.current = promise;
        const newWaveform = await promise;
        if (aborted) return;
        setWaveforms((currentWaveforms) => {
          const waveformsByCreatedAt = sortBy(currentWaveforms, 'createdAt');
          return [
            // cleanup old
            ...(currentWaveforms.length >= maxWaveforms ? waveformsByCreatedAt.slice(1) : waveformsByCreatedAt),
            newWaveform,
          ];
        });
      } catch (err) {
        console.error('Failed to render waveform', err);
      } finally {
        creatingWaveformPromise.current = undefined;
      }
    })();

    return () => {
      aborted = true;
    };
  }, [filePath, timeThrottled, waveformEnabled, mainAudioStream, shouldShowWaveform, ffmpegExtractWindow, durationSafe, waveformColor, setWaveforms]);

  const lastWaveformsRef = useRef([]);
  useEffect(() => {
    const removedWaveforms = lastWaveformsRef.current.filter((wf) => !waveforms.includes(wf));
    // Cleanup old
    // if (removedWaveforms.length > 0) console.log('cleanup waveforms', removedWaveforms.length);
    removedWaveforms.forEach((waveform) => URL.revokeObjectURL(waveform.url));
    lastWaveformsRef.current = waveforms;
  }, [waveforms]);

  useEffect(() => setWaveforms([]), [filePath, setWaveforms]);
  useEffect(() => () => setWaveforms([]), [setWaveforms]);

  return { waveforms };
};
