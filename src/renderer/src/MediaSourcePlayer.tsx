import { useEffect, useRef, useState, useCallback, useMemo, memo, CSSProperties, RefObject, ReactEventHandler, FocusEventHandler } from 'react';
import invariant from 'tiny-invariant';
import debounce from 'lodash/debounce.js';
import { FaVideo } from 'react-icons/fa';

import isDev from './isDev';
import { ChromiumHTMLVideoElement } from './types';
import { FFprobeStream } from '../../common/ffprobe';
import { getFrameDuration } from './util';

const { compatPlayer: { createMediaSourceStream } } = window.require('@electron/remote').require('./index.js');


async function startPlayback({ path, slaveVideo, masterVideo, videoStreamIndex, audioStreamIndexes, seekTo, signal, size, fps, rotate, onCanPlay, onResetNeeded, onWaiting }: {
  path: string,
  slaveVideo: ChromiumHTMLVideoElement,
  masterVideo: ChromiumHTMLVideoElement,
  videoStreamIndex?: number | undefined,
  audioStreamIndexes: number[],
  seekTo: number,
  signal: AbortSignal,
  size?: number | undefined,
  fps?: number | undefined,
  rotate: number | undefined,
  onCanPlay: () => void,
  onResetNeeded: () => void,
  onWaiting: () => void,
}) {
  let canPlay = false;
  let bufferEndTime: number | undefined;
  let bufferStartTime = seekTo;
  let stream: ReturnType<typeof createMediaSourceStream> | undefined;
  let interval: NodeJS.Timeout | undefined;
  let interval2: NodeJS.Timeout | undefined;
  let objectUrl: string | undefined;
  let processChunkTimeout: NodeJS.Timeout;

  signal.addEventListener('abort', () => {
    console.log('Cleanup');
    slaveVideo.pause();
    if (interval != null) clearInterval(interval);
    if (interval2 != null) clearInterval(interval2);
    if (processChunkTimeout != null) clearInterval(processChunkTimeout);
    stream?.abort();
    if (objectUrl != null) URL.revokeObjectURL(objectUrl);
    slaveVideo.removeAttribute('src');
  });

  // See chrome://media-internals

  let streamTimestamp: number | undefined;
  let lastRemoveTimestamp = seekTo;

  const setPlaybackRate = (r: number) => {
    const maxAllowedPlaybackRate = 16; // or else we get an error in Chromium
    const newAdjustedRate = Math.min(maxAllowedPlaybackRate, r * masterVideo.playbackRate);
    if (slaveVideo.playbackRate === newAdjustedRate) {
      return false;
    }

    // eslint-disable-next-line no-param-reassign
    slaveVideo.playbackRate = newAdjustedRate;
    return true;
  };

  // set it a bit faster, so that we don't easily fall behind (better too fast than too slow)
  const setStandardPlaybackRate = () => setPlaybackRate(1.05);

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

  const mediaSource = new MediaSource();

  // console.log(mediaSource.readyState); // closed
  objectUrl = URL.createObjectURL(mediaSource);
  // eslint-disable-next-line no-param-reassign
  slaveVideo.src = objectUrl;

  await new Promise((resolve) => mediaSource.addEventListener('sourceopen', resolve, { once: true }));
  // console.log(mediaSource.readyState); // open

  const sourceBuffer = mediaSource.addSourceBuffer(mimeCodec);
  sourceBuffer.timestampOffset = seekTo - getFrameDuration(fps); // subtract 1 frame in order to attempt to avoid this issue: https://github.com/mifi/lossless-cut/issues/2591#issuecomment-3478018458

  signal.addEventListener('abort', () => sourceBuffer.abort());

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

  let firstChunkReceived = false;

  const processChunk = async () => {
    try {
      const chunk = await stream!.readChunk();
      if (chunk == null) {
        console.log('End of stream');
        return;
      }

      if (signal.aborted) return;

      if (!firstChunkReceived) {
        firstChunkReceived = true;
        console.log('First chunk received');
      }

      sourceBuffer.appendBuffer(chunk as BufferSource);
    } catch (err) {
      console.error('processChunk failed', err);
      processChunkTimeout = setTimeout(processChunk, 1000);
    }
  };

  sourceBuffer.addEventListener('error', (err) => console.error('sourceBuffer error, check DevTools ▶ More Tools ▶ Media', err));

  const handleCanPlay = () => {
    console.log('canplay');
    canPlay = true;
    onCanPlay();
  };
  slaveVideo.addEventListener('canplay', handleCanPlay);

  const handleEnded = () => {
    console.log('ended');
  };
  slaveVideo.addEventListener('ended', handleEnded);

  const handleStalled = () => {
    console.log('stalled');
  };
  slaveVideo.addEventListener('stalled', handleStalled);

  const handleWaiting = () => {
    if (slaveVideo.paused || slaveVideo.ended) return; // we don't care if paused
    console.log('waiting');
    onWaiting();
  };

  slaveVideo.addEventListener('waiting', handleWaiting);

  const handlePlaying = () => {
    console.log('playing');
  };
  slaveVideo.addEventListener('playing', handlePlaying);

  signal.addEventListener('abort', () => {
    slaveVideo.removeEventListener('canplay', handleCanPlay);
    slaveVideo.removeEventListener('ended', handleEnded);
    slaveVideo.removeEventListener('stalled', handleStalled);
    slaveVideo.removeEventListener('waiting', handleWaiting);
    slaveVideo.removeEventListener('playing', handlePlaying);
  });

  sourceBuffer.addEventListener('updateend', ({ timeStamp }) => {
    if (signal.aborted) return;

    streamTimestamp = timeStamp; // apparently this timestamp cannot be trusted much

    const bufferThrottleSec = isDev ? 5 : 10; // how many seconds ahead of playback we want to buffer
    const bufferMaxSec = bufferThrottleSec + (isDev ? 5 : 60); // how many seconds we want to buffer in total (ahead of playback and behind)

    bufferEndTime = getBufferEndTime();

    if (bufferEndTime != null) {
      const bufferedDuration = bufferEndTime - lastRemoveTimestamp;

      if (bufferedDuration > bufferMaxSec && !sourceBuffer.updating) {
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

      const bufferAheadSec = bufferEndTime - masterVideo.currentTime;
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
    if (!canPlay) return;

    if (mediaSource.readyState !== 'open') {
      console.warn('mediaSource.readyState was not open, but:', mediaSource.readyState);
      // else we will get: Uncaught DOMException: Failed to execute 'end' on 'TimeRanges': The index provided (0) is greater than or equal to the maximum bound (0).
      return;
    }

    console.log(`bufferStartTime: ${bufferStartTime}, bufferEndTime: ${bufferEndTime}, master time: ${masterVideo.currentTime}, slave time: ${slaveVideo.currentTime} (diff: ${masterVideo.currentTime - slaveVideo.currentTime}), streamTimestamp: ${streamTimestamp}`);
    // console.log(sourceBuffer.buffered.length, sourceBuffer.buffered.start(0), sourceBuffer.buffered.end(0))

    if (sourceBuffer.buffered.length !== 1) {
      // not sure why this would happen or how to handle this
      console.warn('sourceBuffer.buffered.length was', sourceBuffer.buffered.length);
    }
  }, 1000);

  // Synchronize state between the two video elements
  interval2 = setInterval(async () => {
    try {
      const maxSecAfterBufferToWaitFor = 5;
      if (masterVideo.currentTime < bufferStartTime || (bufferEndTime != null && masterVideo.currentTime - bufferEndTime > maxSecAfterBufferToWaitFor)) {
        console.log('Seeked before/after buffered range, resetting playback');
        onResetNeeded();
        return;
      }

      if (masterVideo.paused || masterVideo.ended) {
        const resolution = 1000;
        if (Math.round(slaveVideo.currentTime * resolution) !== Math.round(masterVideo.currentTime * resolution)) {
          // eslint-disable-next-line no-param-reassign
          slaveVideo.currentTime = masterVideo.currentTime;
        }
      } else { // playing
        // make sure the playback keeps up while playing
        // or when seeking while playing
        // https://stackoverflow.com/questions/23301496/how-to-keep-a-live-mediasource-video-stream-in-sync
        const playbackDiff = masterVideo.currentTime - slaveVideo.currentTime;
        if (Math.abs(playbackDiff) > 1) {
          console.log(`Playback ${playbackDiff > 0 ? 'behind' : 'ahead'} master player time by ${playbackDiff}s, jumping to desired time`);
          // eslint-disable-next-line no-param-reassign
          slaveVideo.currentTime = masterVideo.currentTime;
          setStandardPlaybackRate();
        } else if (playbackDiff != null && playbackDiff > 0.3) {
          // eslint-disable-next-line no-param-reassign
          if (setPlaybackRate(1.5)) {
            console.warn(`Playback behind by ${playbackDiff}s, speeding up playback`);
          }
        } else {
          setStandardPlaybackRate();
        }
      }

      if (slaveVideo.volume !== masterVideo.volume) {
        // eslint-disable-next-line no-param-reassign
        slaveVideo.volume = masterVideo.volume;
      }

      const masterStopped = masterVideo.paused || masterVideo.ended;
      const slaveStopped = slaveVideo.paused || slaveVideo.ended;

      if (slaveStopped && !masterStopped) {
        await slaveVideo.play();
      } else if (!slaveStopped && masterStopped) {
        slaveVideo.pause();
      }
    } catch (err) {
      console.error('play/pause failed', err);
    }
  }, 30); // todo requestAnimationFrame?

  // OK, everything initialized and ready to stream!
  processChunk();
}

function MediaSourcePlayer({ rotate, filePath, videoStream, audioStreams, masterVideoRef, mediaSourceQuality }: {
  rotate: number | undefined,
  filePath: string,
  videoStream: FFprobeStream | undefined,
  audioStreams: FFprobeStream[],
  masterVideoRef: RefObject<HTMLVideoElement>,
  mediaSourceQuality: number,
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [showCanvas, setShowCanvas] = useState(false);

  const onVideoError = useCallback<ReactEventHandler<HTMLVideoElement>>((error) => {
    console.error('video error', error);
  }, []);

  const audioStreamIndexes = useMemo(() => audioStreams.map((s) => s.index), [audioStreams]);

  useEffect(() => {
    const video = videoRef.current;
    invariant(video != null);

    const masterVideo = masterVideoRef.current;
    invariant(masterVideo != null);

    const canvas = canvasRef.current;
    invariant(canvas != null);

    let abortController: AbortController;
    let startDebounced: () => void;

    const start = async () => {
      abortController = new AbortController();

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
      setShowCanvas(true);
      setLoading(true);

      const seekTo = masterVideo.currentTime;

      try {
        let size: number | undefined;
        if (videoStream != null) {
          if (mediaSourceQuality === 0) size = 800;
          else if (mediaSourceQuality === 1) size = 420;
        }

        let fps: number | undefined;
        if (mediaSourceQuality === 0) fps = 30;
        else if (mediaSourceQuality === 1) fps = 15;

        await startPlayback({
          signal: abortController.signal,
          path: filePath,
          slaveVideo: video,
          masterVideo,
          videoStreamIndex: videoStream?.index,
          audioStreamIndexes,
          seekTo,
          size,
          fps,
          rotate,
          onCanPlay: () => {
            setLoading(false);
            setShowCanvas(false);
          },
          onResetNeeded: () => {
            abortController.abort();
            startDebounced();
          },
          onWaiting: () => {
            setLoading(true);
          },
        });
      } catch (err) {
        console.error('Preview failed', err);
      }
    };

    startDebounced = debounce(start, 500, { leading: true, trailing: true });

    startDebounced();

    return () => abortController.abort();
    // Important that we also have eventId in the deps, so that we can restart the preview when the eventId changes
  }, [audioStreamIndexes, filePath, masterVideoRef, mediaSourceQuality, rotate, videoStream]);

  const onFocus = useCallback<FocusEventHandler<HTMLVideoElement>>((e) => {
    // prevent video element from stealing focus in fullscreen mode https://github.com/mifi/lossless-cut/issues/543#issuecomment-1868167775
    e.target.blur();
  }, []);

  const videoStyle = useMemo<CSSProperties>(() => ({
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, display: 'block', width: '100%', height: '100%', objectFit: 'contain', transform: rotate ? `rotate(${rotate}deg)` : undefined,
  }), [rotate]);

  return (
    <div style={{ width: '100%', height: '100%', left: 0, right: 0, top: 0, bottom: 0, position: 'absolute', overflow: 'hidden', background: 'black', pointerEvents: 'none' }}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video style={{ ...videoStyle, visibility: showCanvas ? 'hidden' : 'initial' }} ref={videoRef} playsInline onError={onVideoError} tabIndex={-1} onFocusCapture={onFocus} />
      <canvas style={{ ...videoStyle, display: showCanvas ? 'initial' : 'none' }} ref={canvasRef} />

      {loading && (
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <FaVideo className="loading-animation" style={{ padding: '1em', background: 'rgba(0,0,0,0.2)', borderRadius: '50%' }} />
        </div>
      )}
    </div>
  );
}

export default memo(MediaSourcePlayer);
