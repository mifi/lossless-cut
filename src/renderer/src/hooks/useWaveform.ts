import { useState, useRef, useEffect } from 'react';
import sortBy from 'lodash/sortBy';

import { renderWaveformPng, safeCreateBlob } from '../ffmpeg';
import { RenderableWaveform } from '../types';
import { FFprobeStream } from '../../../../ffprobe';


const maxWaveforms = 100;
// const maxWaveforms = 3; // testing

export default ({ filePath, relevantTime, fileDuration, waveformEnabled, audioStream, ffmpegExtractWindow }: {
  filePath: string | undefined,
  relevantTime: number,
  fileDuration: number | undefined,
  waveformEnabled: boolean,
  audioStream: FFprobeStream | undefined,
  ffmpegExtractWindow: number,
}) => {
  const [waveforms, setWaveforms] = useState<RenderableWaveform[]>([]);
  const waveformsRef = useRef<RenderableWaveform[]>();

  useEffect(() => {
    waveformsRef.current = waveforms;
  }, [waveforms]);

  useEffect(() => {
    waveformsRef.current = [];
    setWaveforms([]);
  }, [filePath, audioStream, setWaveforms]);

  const waveformStartTime = Math.floor(relevantTime / ffmpegExtractWindow) * ffmpegExtractWindow;
  const safeExtractDuration = fileDuration != null ? Math.min(waveformStartTime + ffmpegExtractWindow, fileDuration) - waveformStartTime : undefined;

  const waveformStartTimeRef = useRef(waveformStartTime);

  useEffect(() => {
    waveformStartTimeRef.current = waveformStartTime;
  }, [waveformStartTime]);

  useEffect(() => {
    let aborted = false;

    (async () => {
      if (!filePath || safeExtractDuration == null || !audioStream || !waveformEnabled) {
        return;
      }

      while (!aborted) {
        const times = [
          waveformStartTimeRef.current,
          waveformStartTimeRef.current + ffmpegExtractWindow,
          waveformStartTimeRef.current - ffmpegExtractWindow,
        ];

        for (const time of times) {
          const alreadyHaveWaveformAtTime = (waveformsRef.current ?? []).some((waveform) => waveform.from === time);
          if (!alreadyHaveWaveformAtTime) {
            try {
              const promise = renderWaveformPng({ filePath, start: time, duration: safeExtractDuration, color: '##000000', streamIndex: audioStream.index });

              setWaveforms((currentWaveforms) => {
                const waveformsByCreatedAt = sortBy(currentWaveforms, 'createdAt');
                return [
                  // If too many waveforms, cleanup old
                  ...(currentWaveforms.length >= maxWaveforms ? waveformsByCreatedAt.slice(1) : waveformsByCreatedAt),
                  // Add new waveform
                  {
                    from: time,
                    to: time + safeExtractDuration,
                    duration: safeExtractDuration,
                    createdAt: new Date(),
                  },
                ];
              });

              const { buffer } = await promise;

              if (aborted) {
                // remove unfinished waveform
                setWaveforms((currentWaveforms) => currentWaveforms.filter((w) => w.from !== time));
                return;
              }

              setWaveforms((currentWaveforms) => currentWaveforms.map((w) => {
                if (w.from !== time) {
                  return w;
                }

                return {
                  ...w,
                  url: URL.createObjectURL(safeCreateBlob(buffer, { type: 'image/png' })),
                };
              }));
            } catch (err) {
              console.error('Failed to render waveform', err);
            }
          }
        }

        // could be problematic if we spawn ffmpeg processes too often, so throttle it
        await new Promise((r) => setTimeout(r, 100));
      }
    })();

    return () => {
      aborted = true;
    };
  }, [audioStream, ffmpegExtractWindow, filePath, safeExtractDuration, waveformEnabled]);

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
