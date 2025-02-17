import { useEffect, useRef, useState, useCallback, useMemo, memo, CSSProperties, RefObject, ReactEventHandler, FocusEventHandler } from 'react';
import { Spinner } from 'evergreen-ui';
import { useDebounce } from 'use-debounce';

import isDev from './isDev';
import { ChromiumHTMLVideoElement } from './types';
import { FFprobeStream } from '../../../ffprobe';

const { compatPlayer: { createMediaSourceStream, readOneJpegFrame } } = window.require('@electron/remote').require('./index.js');


async function startPlayback({ path, video, videoStreamIndex, audioStreamIndex, seekTo, signal, playSafe, onCanPlay, getTargetTime, size, fps }: {
  path: string,
  video: ChromiumHTMLVideoElement,
  videoStreamIndex?: number | undefined,
  audioStreamIndex?: number | undefined,
  seekTo: number,
  signal: AbortSignal,
  playSafe: () => void,
  onCanPlay: () => void,
  getTargetTime: () => number,
  size?: number | undefined,
  fps?: number | undefined,
}) {
  let canPlay = false;
  let bufferEndTime: number | undefined;
  let bufferStartTime = 0;
  let stream: ReturnType<typeof createMediaSourceStream> | undefined;
  let done = false;
  let interval: NodeJS.Timeout | undefined;
  let objectUrl: string | undefined;
  let processChunkTimeout: NodeJS.Timeout;

  function cleanup() {
    console.log('Cleanup');
    done = true;
    video.pause();
    if (interval != null) clearInterval(interval);
    if (processChunkTimeout != null) clearInterval(processChunkTimeout);
    stream?.abort();
    if (objectUrl != null) URL.revokeObjectURL(objectUrl);
    video.removeAttribute('src');
  }

  signal.addEventListener('abort', cleanup);

  // See chrome://media-internals

  const mediaSource = new MediaSource();

  let streamTimestamp: number | undefined;
  let lastRemoveTimestamp = 0;

  function setStandardPlaybackRate() {
    // set it a bit faster, so that we don't easily fall behind (better too fast than too slow)
    // eslint-disable-next-line no-param-reassign
    video.playbackRate = 1.05;
  }

  setStandardPlaybackRate();

  const codecs: string[] = [];
  if (videoStreamIndex != null) codecs.push('avc1.42C01F');
  if (audioStreamIndex != null) codecs.push('mp4a.40.2');
  const codecTag = codecs.join(', ');

  const mimeCodec = `video/mp4; codecs="${codecTag}"`;

  // mp4info sample-file.mp4 | grep Codec
  // https://developer.mozilla.org/en-US/docs/Web/API/Media_Source_Extensions_API/Transcoding_assets_for_MSE
  // https://stackoverflow.com/questions/16363167/html5-video-tag-codecs-attribute
  // https://cconcolato.github.io/media-mime-support/
  // https://github.com/cconcolato/media-mime-support
  // const mimeCodec = 'video/mp4; codecs="avc1.42C01E"'; // Video only
  // const mimeCodec = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"'; // Video+audio

  if (!MediaSource.isTypeSupported(mimeCodec)) {
    throw new Error(`Unsupported MIME type or codec: ${mimeCodec}`);
  }

  // console.log(mediaSource.readyState); // closed
  objectUrl = URL.createObjectURL(mediaSource);
  // eslint-disable-next-line no-param-reassign
  video.src = objectUrl;

  await new Promise((resolve) => mediaSource.addEventListener('sourceopen', resolve, { once: true }));
  // console.log(mediaSource.readyState); // open

  const sourceBuffer = mediaSource.addSourceBuffer(mimeCodec);

  const getBufferEndTime = () => {
    if (mediaSource.readyState !== 'open') {
      console.log('mediaSource.readyState was not open, but:', mediaSource.readyState);
      // else we will get: Uncaught DOMException: Failed to execute 'end' on 'TimeRanges': The index provided (0) is greater than or equal to the maximum bound (0).
      return undefined;
    }

    if (sourceBuffer.buffered.length === 0) {
      return undefined;
    }

    // https://developer.mozilla.org/en-US/docs/Web/API/TimeRanges/start
    return sourceBuffer.buffered.end(0);
  };

  sourceBuffer.addEventListener('updateend', () => {
    playSafe();
  }, { once: true });

  let firstChunkReceived = false;

  const processChunk = async () => {
    try {
      const chunk = await stream!.readChunk();
      if (chunk == null) {
        console.log('End of stream');
        return;
      }
      if (done) return;

      if (!firstChunkReceived) {
        firstChunkReceived = true;
        console.log('First chunk received');
      }

      sourceBuffer.appendBuffer(chunk);
    } catch (err) {
      console.error('processChunk failed', err);
      processChunkTimeout = setTimeout(processChunk, 1000);
    }
  };

  sourceBuffer.addEventListener('error', (err) => console.error('sourceBuffer error, check DevTools ▶ More Tools ▶ Media', err));

  // video.addEventListener('loadeddata', () => console.log('loadeddata'));
  // video.addEventListener('play', () => console.log('play'));
  video.addEventListener('canplay', () => {
    console.log('canplay');
    if (!canPlay) {
      canPlay = true;
      onCanPlay();
    }
  }, { once: true });

  sourceBuffer.addEventListener('updateend', ({ timeStamp }) => {
    if (done) return;

    streamTimestamp = timeStamp; // apparently this timestamp cannot be trusted much

    const bufferThrottleSec = isDev ? 5 : 10; // how many seconds ahead of playback we want to buffer
    const bufferMaxSec = bufferThrottleSec + (isDev ? 5 : 60); // how many seconds we want to buffer in total (ahead of playback and behind)

    bufferEndTime = getBufferEndTime();

    // console.log('updateend', { bufferEndTime })
    if (bufferEndTime != null) {
      const targetTime = getTargetTime();

      const bufferedTime = bufferEndTime - lastRemoveTimestamp;

      if (bufferedTime > bufferMaxSec && !sourceBuffer.updating) {
        try {
          lastRemoveTimestamp = bufferEndTime;
          const removeTo = bufferEndTime - bufferMaxSec;
          bufferStartTime = removeTo;
          console.log('sourceBuffer remove', 0, removeTo);
          sourceBuffer.remove(0, removeTo); // updateend will be emitted again when this is done
          return;
        } catch (err) {
          console.error('sourceBuffer remove failed', err);
        }
      }

      const bufferAheadSec = bufferEndTime - targetTime;
      if (bufferAheadSec > bufferThrottleSec) {
        console.debug(`buffer ahead by ${bufferAheadSec}, throttling stream read`);
        processChunkTimeout = setTimeout(processChunk, 1000);
        return;
      }
    }

    // make sure we always process the next chunk
    processChunk();
  });

  stream = createMediaSourceStream({ path, videoStreamIndex, audioStreamIndex, seekTo, size, fps });

  interval = setInterval(() => {
    if (mediaSource.readyState !== 'open') {
      console.warn('mediaSource.readyState was not open, but:', mediaSource.readyState);
      // else we will get: Uncaught DOMException: Failed to execute 'end' on 'TimeRanges': The index provided (0) is greater than or equal to the maximum bound (0).
      return;
    }

    const targetTime = getTargetTime();
    const playbackDiff = targetTime != null ? targetTime - video.currentTime : undefined;

    const streamTimestampDiff = streamTimestamp != null && bufferEndTime != null ? (streamTimestamp / 1000) - bufferEndTime : undefined; // not really needed, but log for curiosity
    console.debug('bufferStartTime', bufferStartTime, 'bufferEndTime', bufferEndTime, 'targetTime', targetTime, 'playback:', video.currentTime, 'playbackDiff:', playbackDiff, 'streamTimestamp diff:', streamTimestampDiff);

    if (!canPlay || targetTime == null) return;

    if (sourceBuffer.buffered.length !== 1) {
      // not sure why this would happen or how to handle this
      console.warn('sourceBuffer.buffered.length was', sourceBuffer.buffered.length);
    }

    if ((video.paused || video.ended) && !done) {
      console.warn('Resuming unexpectedly paused video');
      playSafe();
    }

    // make sure the playback keeps up
    // https://stackoverflow.com/questions/23301496/how-to-keep-a-live-mediasource-video-stream-in-sync
    if (playbackDiff != null && playbackDiff > 1) {
      console.warn(`playback severely behind by ${playbackDiff}s, seeking to desired time`);
      // eslint-disable-next-line no-param-reassign
      video.currentTime = targetTime;
      setStandardPlaybackRate();
    } else if (playbackDiff != null && playbackDiff > 0.3) {
      console.warn(`playback behind by ${playbackDiff}s, speeding up playback`);
      // eslint-disable-next-line no-param-reassign
      video.playbackRate = 1.5;
    } else {
      setStandardPlaybackRate();
    }
  }, 200);

  // OK, everything initialized and ready to stream!
  processChunk();
}

function drawJpegFrame(canvas: HTMLCanvasElement | null, jpegImage: Uint8Array) {
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  const img = new Image();
  if (ctx == null) {
    console.error('Canvas context is null');
    return;
  }
  // eslint-disable-next-line unicorn/prefer-add-event-listener
  img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  // eslint-disable-next-line unicorn/prefer-add-event-listener
  img.onerror = (error) => console.error('Canvas JPEG image error', error);
  // todo use Blob?
  img.src = `data:image/jpeg;base64,${Buffer.from(jpegImage).toString('base64')}`;
}

async function createPauseImage({ path, seekTo, videoStreamIndex, canvas, signal }: {
  path: string, seekTo: number, videoStreamIndex: number, canvas: HTMLCanvasElement | null, signal: AbortSignal,
}) {
  const { promise, abort } = readOneJpegFrame({ path, seekTo, videoStreamIndex });
  signal.addEventListener('abort', () => abort());
  const jpegImage = await promise;
  drawJpegFrame(canvas, jpegImage);
}

function MediaSourcePlayer({ rotate, filePath, playerTime, videoStream, audioStream, commandedTime, playing, eventId, masterVideoRef, mediaSourceQuality, playbackVolume }: {
  rotate: number | undefined, filePath: string, playerTime: number, videoStream: FFprobeStream | undefined, audioStream: FFprobeStream | undefined, commandedTime: number, playing: boolean, eventId: number, masterVideoRef: RefObject<HTMLVideoElement>, mediaSourceQuality: number, playbackVolume: number,
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);

  const onVideoError = useCallback<ReactEventHandler<HTMLVideoElement>>((error) => {
    console.error('video error', error);
  }, []);

  const state = useMemo(() => (playing
    ? { startTime: commandedTime, playing, eventId }
    : { startTime: playerTime, playing, eventId }
  ), [commandedTime, eventId, playerTime, playing]);

  const [debouncedState] = useDebounce(state, 300, {
    equalityFn: (a, b) => a.startTime === b.startTime && a.playing === b.playing && a.eventId === b.eventId,
    leading: true,
  });

  useEffect(() => {
    // console.log('debouncedState', debouncedState);
  }, [debouncedState]);

  const playSafe = useCallback(async () => {
    try {
      await videoRef.current?.play();
    } catch (err) {
      console.error('play failed', err);
    }
  }, []);

  useEffect(() => {
    setLoading(true);

    if (debouncedState.startTime == null) {
      return () => undefined;
    }

    const clearCanvas = () => {
      if (canvasRef.current == null) return;
      canvasRef.current.getContext('2d')?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    };

    const onCanPlay = () => {
      clearCanvas();
      setLoading(false);
    };
    const getTargetTime = () => masterVideoRef.current!.currentTime - debouncedState.startTime;

    const abortController = new AbortController();

    const video = videoRef.current;

    (async () => {
      try {
        // When playing, we use a secondary video element, but when paused we use a canvas
        if (debouncedState.playing) {
          if (video == null) throw new Error('No video ref');

          let size: number | undefined;
          if (videoStream != null) {
            if (mediaSourceQuality === 0) size = 800;
            else if (mediaSourceQuality === 1) size = 420;
          }

          let fps: number | undefined;
          if (mediaSourceQuality === 0) fps = 30;
          else if (mediaSourceQuality === 1) fps = 15;

          await startPlayback({ path: filePath, video, videoStreamIndex: videoStream?.index, audioStreamIndex: audioStream?.index, seekTo: debouncedState.startTime, signal: abortController.signal, playSafe, onCanPlay, getTargetTime, size, fps });
        } else { // paused
          if (videoStream != null) {
            await createPauseImage({ path: filePath, seekTo: debouncedState.startTime, videoStreamIndex: videoStream.index, canvas: canvasRef.current, signal: abortController.signal });
          }
          setLoading(false);
        }
      } catch (err) {
        console.error('Preview failed', err);
      }
    })();

    return () => abortController.abort();
    // Important that we also have eventId in the deps, so that we can restart the preview when the eventId changes
  }, [debouncedState.startTime, debouncedState.eventId, filePath, masterVideoRef, playSafe, debouncedState.playing, videoStream, mediaSourceQuality, audioStream?.index]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = playbackVolume;
  }, [playbackVolume]);

  const onFocus = useCallback<FocusEventHandler<HTMLVideoElement | HTMLCanvasElement>>((e) => {
    // prevent video element from stealing focus in fullscreen mode https://github.com/mifi/lossless-cut/issues/543#issuecomment-1868167775
    e.target.blur();
  }, []);

  const { videoStyle, canvasStyle } = useMemo(() => {
    const sharedStyle: CSSProperties = { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, display: 'block', width: '100%', height: '100%', objectFit: 'contain', transform: rotate ? `rotate(${rotate}deg)` : undefined };

    const shouldShowCanvas = !debouncedState.playing;

    return {
      videoStyle: { ...sharedStyle, visibility: loading || !debouncedState.playing ? 'hidden' : undefined },
      canvasStyle: { ...sharedStyle, visibility: shouldShowCanvas ? undefined : 'hidden' },
    } as { videoStyle: CSSProperties, canvasStyle: CSSProperties };
  }, [loading, debouncedState.playing, rotate]);

  return (
    <div style={{ width: '100%', height: '100%', left: 0, right: 0, top: 0, bottom: 0, position: 'absolute', overflow: 'hidden', background: 'black', pointerEvents: 'none' }}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video style={videoStyle} ref={videoRef} playsInline onError={onVideoError} tabIndex={-1} onFocusCapture={onFocus} />
      {videoStream != null && <canvas width={videoStream.width} height={videoStream.height} ref={canvasRef} style={canvasStyle} tabIndex={-1} onFocusCapture={onFocus} />}

      {loading && (
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}><Spinner /></div>
      )}
    </div>
  );
}

export default memo(MediaSourcePlayer);
