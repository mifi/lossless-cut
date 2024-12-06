import { useState, useRef, useEffect } from 'react';
import sortBy from 'lodash/sortBy';
import { useThrottle } from '@uidotdev/usehooks';
import { waveformColorDark, waveformColorLight } from '../colors';

import { renderWaveformPng, safeCreateBlob } from '../ffmpeg';
import { RenderableWaveform } from '../types';
import { FFprobeStream } from '../../../../ffprobe';


const maxWaveforms = 100;
// const maxWaveforms = 3; // testing

export default ({ darkMode, filePath, relevantTime, duration, waveformEnabled, audioStream, ffmpegExtractWindow }: {
  darkMode: boolean, filePath: string | undefined, relevantTime: number, duration: number | undefined, waveformEnabled: boolean, audioStream: FFprobeStream | undefined, ffmpegExtractWindow: number,
}) => {
  const creatingWaveformPromise = useRef<Promise<unknown>>();
  const [waveforms, setWaveforms] = useState<RenderableWaveform[]>([]);
  const waveformsRef = useRef<RenderableWaveform[]>();

  useEffect(() => {
    waveformsRef.current = waveforms;
  }, [waveforms]);

  const waveformColor = darkMode ? waveformColorDark : waveformColorLight;

  useEffect(() => {
    waveformsRef.current = [];
    setWaveforms([]);
  }, [filePath, audioStream, setWaveforms]);

  const waveformStartTime = Math.floor(relevantTime / ffmpegExtractWindow) * ffmpegExtractWindow;
  const safeExtractDuration = duration != null ? Math.min(waveformStartTime + ffmpegExtractWindow, duration) - waveformStartTime : undefined;

  const waveformStartTimeThrottled = useThrottle(waveformStartTime, 1000);

  useEffect(() => {
    let aborted = false;

    (async () => {
      const alreadyHaveWaveformAtTime = (waveformsRef.current ?? []).some((waveform) => waveform.from === waveformStartTimeThrottled);
      const shouldRun = !!filePath && safeExtractDuration != null && audioStream && waveformEnabled && !alreadyHaveWaveformAtTime && !creatingWaveformPromise.current;
      if (!shouldRun) return;

      try {
        const promise = renderWaveformPng({ filePath, start: waveformStartTimeThrottled, duration: safeExtractDuration, color: waveformColor, streamIndex: audioStream.index });
        creatingWaveformPromise.current = promise;

        setWaveforms((currentWaveforms) => {
          const waveformsByCreatedAt = sortBy(currentWaveforms, 'createdAt');
          return [
            // cleanup old
            ...(currentWaveforms.length >= maxWaveforms ? waveformsByCreatedAt.slice(1) : waveformsByCreatedAt),
            // add new
            {
              from: waveformStartTimeThrottled,
              to: waveformStartTimeThrottled + safeExtractDuration,
              duration: safeExtractDuration,
              createdAt: new Date(),
            },
          ];
        });

        const { buffer } = await promise;

        if (aborted) {
          setWaveforms((currentWaveforms) => currentWaveforms.filter((w) => w.from !== waveformStartTimeThrottled));
          return;
        }

        setWaveforms((currentWaveforms) => currentWaveforms.map((w) => {
          if (w.from !== waveformStartTimeThrottled) {
            return w;
          }

          return {
            ...w,
            url: URL.createObjectURL(safeCreateBlob(buffer, { type: 'image/png' })),
          };
        }));
      } catch (err) {
        console.error('Failed to render waveform', err);
      } finally {
        creatingWaveformPromise.current = undefined;
      }
    })();

    return () => {
      aborted = true;
    };
  }, [audioStream, filePath, safeExtractDuration, waveformColor, waveformEnabled, waveformStartTimeThrottled]);

  const lastWaveformsRef = useRef<RenderableWaveform[]>([]);
  useEffect(() => {
    const removedWaveforms = lastWaveformsRef.current.filter((wf) => !waveforms.includes(wf));
    // Cleanup old
    // if (removedWaveforms.length > 0) console.log('cleanup waveforms', removedWaveforms.length);
    removedWaveforms.forEach((waveform) => {
      if (waveform.url != null) {
        console.log('Cleanup waveform', waveform.from, waveform.to);
        URL.revokeObjectURL(waveform.url);
      }
    });
    lastWaveformsRef.current = waveforms;
  }, [waveforms]);

  useEffect(() => () => setWaveforms([]), [setWaveforms]);

  return { waveforms };
};
