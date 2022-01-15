import { useState, useRef, useEffect } from 'react';
import sortBy from 'lodash/sortBy';
import useDebounceOld from 'react-use/lib/useDebounce'; // Want to phase out this
import { waveformColor } from '../colors';

import { renderWaveformPng } from '../ffmpeg';

const maxWaveforms = 100;
// const maxWaveforms = 3; // testing

export default ({ filePath, commandedTime, zoomedDuration, waveformEnabled, mainAudioStream, shouldShowWaveform, ffmpegExtractWindow }) => {
  const creatingWaveformPromise = useRef();
  const [waveforms, setWaveforms] = useState([]);

  useDebounceOld(() => {
    let aborted = false;

    (async () => {
      const alreadyHaveWaveformAtCommandedTime = waveforms.some((waveform) => waveform.from < commandedTime && waveform.to > commandedTime);
      const shouldRun = filePath && mainAudioStream && commandedTime != null && shouldShowWaveform && waveformEnabled && !alreadyHaveWaveformAtCommandedTime && !creatingWaveformPromise.current;
      if (!shouldRun) return;

      try {
        const promise = renderWaveformPng({ filePath, aroundTime: commandedTime, window: ffmpegExtractWindow, color: waveformColor });
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
  }, 500, [filePath, commandedTime, zoomedDuration, waveformEnabled, mainAudioStream, shouldShowWaveform, waveforms, ffmpegExtractWindow]);

  const lastWaveformsRef = useRef([]);
  useEffect(() => {
    const removedWaveforms = lastWaveformsRef.current.filter((wf) => !waveforms.includes(wf));
    // Cleanup old
    // if (removedWaveforms.length > 0) console.log('cleanup waveforms', removedWaveforms.length);
    removedWaveforms.forEach((waveform) => URL.revokeObjectURL(waveform.url));
    lastWaveformsRef.current = waveforms;
  }, [waveforms]);

  useEffect(() => setWaveforms([]), [filePath]);
  useEffect(() => () => setWaveforms([]), []);

  return { waveforms };
};
