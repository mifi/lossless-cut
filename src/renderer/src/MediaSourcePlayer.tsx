import { useEffect, useRef, useState, useCallback, useMemo, memo, CSSProperties, RefObject, ReactEventHandler, FocusEventHandler } from 'react';
import { Spinner } from 'evergreen-ui';
import { useDebounce } from 'use-debounce';
import invariant from 'tiny-invariant';

import isDev from './isDev';
import { ChromiumHTMLVideoElement } from './types';
import { FFprobeStream } from '../../../ffprobe';

const { compatPlayer: { createMediaSourceStream, readOneJpegFrame } } = window.require('@electron/remote').require('./index.js');


async function startPlayback({ path, video, videoStreamIndex, audioStreamIndexes, seekTo, signal, onPlayRequested, onCanPlay, getTargetTime, size, fps, rotate }: {
  path: string,
  video: ChromiumHTMLVideoElement,
  videoStreamIndex?: number | undefined,
  audioStreamIndexes: number[],
  seekTo: number,
  signal: AbortSignal,
  onPlayRequested: () => void,
  onCanPlay: () => void,
  getTargetTime: () => number,
  size?: number | undefined,
  fps?: number | undefined,
  rotate: number | undefined,
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
  if (audioStreamIndexes.length > 0) codecs.push('mp4a.40.2');
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
    onPlayRequested();
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

  stream = createMediaSourceStream({ path, videoStreamIndex, audioStreamIndexes, seekTo, size, fps, rotate });

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
      onPlayRequested();
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

async function createPauseImage({ path, seekTo, videoStreamIndex, image, rotate, signal }: {
  path: string,
  seekTo: number,
  videoStreamIndex: number,
  image: HTMLImageElement | null,
  rotate: number | undefined,
  signal: AbortSignal,
}) {
  const { promise, abort } = readOneJpegFrame({ path, seekTo, videoStreamIndex, rotate });
  signal.addEventListener('abort', () => abort());
  const jpegImage = await promise;

  invariant(image);
  if (image.src) URL.revokeObjectURL(image.src);
  // eslint-disable-next-line no-param-reassign
  image.src = URL.createObjectURL(new Blob([Buffer.from(jpegImage)], { type: 'image/jpeg' }));
}

function MediaSourcePlayer({ rotate, filePath, playerTime, videoStream, audioStreams, commandedTime, playing, eventId, masterVideoRef, mediaSourceQuality, playbackVolume }: {
  rotate: number | undefined,
  filePath: string,
  playerTime: number,
  videoStream: FFprobeStream | undefined,
  audioStreams: FFprobeStream[],
  commandedTime: number,
  playing: boolean,
  eventId: number,
  masterVideoRef: RefObject<HTMLVideoElement>,
  mediaSourceQuality: number,
  playbackVolume: number,
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [loading, setLoading] = useState(true);

  const onVideoError = useCallback<ReactEventHandler<HTMLVideoElement>>((error) => {
    console.error('video error', error);
  }, []);

  const state = useMemo(() => (playing
    ? { startTime: commandedTime, playing, eventId }
    : { startTime: playerTime, playing, eventId }
  ), [commandedTime, eventId, playerTime, playing]);

  const audioStreamIndexes = useMemo(() => audioStreams.map((s) => s.index), [audioStreams]);

  const [debouncedState] = useDebounce(state, 300, {
    equalityFn: (a, b) => a.startTime === b.startTime && a.playing === b.playing && a.eventId === b.eventId,
    leading: true,
  });

  useEffect(() => {
    // console.log('debouncedState', debouncedState);
  }, [debouncedState]);

  const onPlayRequested = useCallback(async () => {
    try {
      await videoRef.current?.play();
    } catch (err) {
      console.error('play failed', err);
    }
  }, []);

  useEffect(() => {
    setLoading(true);

    let { startTime: seekTo } = debouncedState;

    const video = videoRef.current;
    invariant(video != null);

    const masterVideo = masterVideoRef.current;
    invariant(masterVideo != null);

    if (seekTo >= masterVideo.duration) seekTo = 0; // start over if reached end

    if (seekTo == null) {
      return () => undefined;
    }

    const onCanPlay = () => {
      setLoading(false);
    };
    const getTargetTime = () => masterVideoRef.current!.currentTime - seekTo;

    const abortController = new AbortController();

    (async () => {
      try {
        // When playing, we use a secondary video element, but when paused we use an img
        if (debouncedState.playing) {
          let size: number | undefined;
          if (videoStream != null) {
            if (mediaSourceQuality === 0) size = 800;
            else if (mediaSourceQuality === 1) size = 420;
          }

          let fps: number | undefined;
          if (mediaSourceQuality === 0) fps = 30;
          else if (mediaSourceQuality === 1) fps = 15;

          await startPlayback({ signal: abortController.signal, path: filePath, video, videoStreamIndex: videoStream?.index, audioStreamIndexes, seekTo, onPlayRequested, onCanPlay, getTargetTime, size, fps, rotate });
        } else if (videoStream != null) { // paused
          try {
            await createPauseImage({ signal: abortController.signal, path: filePath, videoStreamIndex: videoStream.index, seekTo, image: imgRef.current, rotate });
          } finally {
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Preview failed', err);
      }
    })();

    return () => abortController.abort();
    // Important that we also have eventId in the deps, so that we can restart the preview when the eventId changes
  }, [debouncedState.startTime, debouncedState.eventId, filePath, masterVideoRef, onPlayRequested, debouncedState.playing, videoStream, mediaSourceQuality, audioStreamIndexes, rotate, debouncedState]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = playbackVolume;
  }, [playbackVolume]);

  const onFocus = useCallback<FocusEventHandler<HTMLVideoElement | HTMLImageElement>>((e) => {
    // prevent video element from stealing focus in fullscreen mode https://github.com/mifi/lossless-cut/issues/543#issuecomment-1868167775
    e.target.blur();
  }, []);

  const { videoStyle, imgStyle } = useMemo<{ videoStyle: CSSProperties, imgStyle: CSSProperties }>(() => {
    const sharedStyle: CSSProperties = {
      position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, display: 'block', width: '100%', height: '100%', objectFit: 'contain', transform: rotate ? `rotate(${rotate}deg)` : undefined,
    };

    const shouldShowImage = !debouncedState.playing;

    return {
      videoStyle: { ...sharedStyle, visibility: loading || !debouncedState.playing ? 'hidden' : undefined },
      imgStyle: { ...sharedStyle, visibility: shouldShowImage ? undefined : 'hidden' },
    };
  }, [loading, debouncedState.playing, rotate]);

  return (
    <div style={{ width: '100%', height: '100%', left: 0, right: 0, top: 0, bottom: 0, position: 'absolute', overflow: 'hidden', background: 'black', pointerEvents: 'none' }}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video style={videoStyle} ref={videoRef} playsInline onError={onVideoError} tabIndex={-1} onFocusCapture={onFocus} />
      {videoStream != null && <img alt="" width={videoStream.width} height={videoStream.height} ref={imgRef} style={imgStyle} tabIndex={-1} onFocusCapture={onFocus} />}

      {loading && (
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}><Spinner /></div>
      )}
    </div>
  );
}

export default memo(MediaSourcePlayer);
