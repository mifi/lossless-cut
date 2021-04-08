import { useState, useRef, useEffect } from 'react';
import useDebounceOld from 'react-use/lib/useDebounce'; // Want to phase out this
import { waveformColor } from '../colors';

import { renderWaveformPng } from '../ffmpeg';

export default ({ filePath, commandedTime, zoomedDuration, waveformEnabled, mainAudioStream, shouldShowWaveform, ffmpegExtractWindow }) => {
  const creatingWaveformPromise = useRef();
  const [waveform, setWaveform] = useState();

  useEffect(() => {
    setWaveform();
  }, [filePath]);

  useDebounceOld(() => {
    const shouldRun = () => filePath && mainAudioStream && commandedTime != null && shouldShowWaveform && waveformEnabled;

    async function run() {
      if (!shouldRun() || creatingWaveformPromise.current) return;
      try {
        const promise = renderWaveformPng({ filePath, aroundTime: commandedTime, window: ffmpegExtractWindow, color: waveformColor });
        creatingWaveformPromise.current = promise;
        if (!shouldRun()) return;
        const wf = await promise;
        setWaveform(wf);
      } catch (err) {
        console.error('Failed to render waveform', err);
      } finally {
        creatingWaveformPromise.current = undefined;
      }
    }

    run();
  }, 500, [filePath, commandedTime, zoomedDuration, waveformEnabled, mainAudioStream, shouldShowWaveform]);

  // Cleanup old
  useEffect(() => () => waveform && URL.revokeObjectURL(waveform.url), [waveform]);

  return { waveform };
};
