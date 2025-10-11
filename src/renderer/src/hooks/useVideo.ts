import { ReactEventHandler, useCallback, useMemo, useRef, useState } from 'react';
import { ChromiumHTMLVideoElement, PlaybackMode } from '../types';
import { showPlaybackFailedMessage } from '../swal';

export default ({ filePath }: { filePath: string | undefined }) => {
  const [commandedTime, setCommandedTimeRaw] = useState(0);
  const [compatPlayerEventId, setCompatPlayerEventId] = useState(0);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [outputPlaybackRate, setOutputPlaybackRateState] = useState(1);
  const [playerTime, setPlayerTime] = useState<number>();
  const playbackModeRef = useRef<PlaybackMode>();

  const videoRef = useRef<ChromiumHTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  const setPlaybackRate = useCallback((rate: number) => {
    if (videoRef.current) videoRef.current.playbackRate = rate;
    setPlaybackRateState(rate);
  }, []);

  const setOutputPlaybackRate = useCallback((rate: number) => {
    setOutputPlaybackRateState(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
  }, []);

  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);

  // https://kitchen.vibbio.com/blog/optimizing-html5-video-scrubbing/
  const seekingRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const seekToRef = useRef<number>();

  const smoothSeek = useCallback((seekTo: number) => {
    if (seekingRef.current) {
      seekToRef.current = seekTo;
    } else {
      videoRef.current!.currentTime = seekTo;
      // safety precaution:
      seekingRef.current = setTimeout(() => {
        seekingRef.current = undefined;
      }, 1000);
    }
  }, []);

  const onSeeked = useCallback<ReactEventHandler<HTMLVideoElement>>(() => {
    if (seekToRef.current != null) {
      videoRef.current!.currentTime = seekToRef.current;
      seekToRef.current = undefined;
    } else {
      clearTimeout(seekingRef.current);
      seekingRef.current = undefined;
    }
  }, []);

  const commandedTimeRef = useRef(commandedTime);

  const setCommandedTime = useCallback((t: number) => {
    commandedTimeRef.current = t;
    setCommandedTimeRaw(t);
  }, []);

  const seekAbs = useCallback((val: number | undefined) => {
    const video = videoRef.current;
    if (video == null || val == null || Number.isNaN(val)) return;
    let outVal = val;
    if (outVal < 0) outVal = 0;
    if (outVal > video.duration) outVal = video.duration;

    smoothSeek(outVal);
    setCommandedTime(outVal);
    if (video.currentTime === val) setCompatPlayerEventId((id) => id + 1); // To make sure that we can seek even to the same commanded time that we are already add (e.g. loop current segment)
  }, [setCommandedTime, smoothSeek]);

  // Relevant time is the player's playback position if we're currently playing - if not, it's the user's commanded time.
  const relevantTime = useMemo(() => (playing ? playerTime : commandedTime) || 0, [commandedTime, playerTime, playing]);
  // The reason why we also have a getter is because it can be used when we need to get the time, but don't want to re-render for every time update (which can be heavy!)
  const getRelevantTime = useCallback(() => (playingRef.current ? videoRef.current!.currentTime : commandedTimeRef.current) || 0, []);

  const seekRel = useCallback((val: number) => {
    seekAbs(getRelevantTime() + val);
  }, [getRelevantTime, seekAbs]);

  const onPlayingChange = useCallback((val: boolean) => {
    playingRef.current = val;
    setPlaying(val);
    if (!val && videoRef.current) {
      setCommandedTime(videoRef.current.currentTime);
    }
  }, [setCommandedTime]);

  const onStopPlaying = useCallback(() => {
    onPlayingChange(false);
  }, [onPlayingChange]);

  const onVideoAbort = useCallback(() => {
    setPlaying(false); // we want to preserve current time https://github.com/mifi/lossless-cut/issues/1674#issuecomment-1658937716
    playbackModeRef.current = undefined;
  }, []);

  const onStartPlaying = useCallback(() => onPlayingChange(true), [onPlayingChange]);

  const pause = useCallback(() => {
    if (!filePath || !playingRef.current) return;
    videoRef.current?.pause();
  }, [filePath, playingRef, videoRef]);

  const play = useCallback((resetPlaybackRate?: boolean) => {
    if (!filePath || playingRef.current) return;

    const video = videoRef.current;

    // This was added to re-sync time if file gets reloaded #1674 - but I had to remove this because it broke loop-selected-segments https://github.com/mifi/lossless-cut/discussions/1785#discussioncomment-7852134
    // if (Math.abs(commandedTimeRef.current - video.currentTime) > 1) video.currentTime = commandedTimeRef.current;

    if (resetPlaybackRate) setPlaybackRate(outputPlaybackRate);
    video?.play().catch((err) => {
      if (err instanceof Error && err.name === 'AbortError' && 'code' in err && err.code === 20) { // Probably "DOMException: The play() request was interrupted by a call to pause()."
        console.error(err);
      } else {
        showPlaybackFailedMessage();
      }
    });
  }, [filePath, outputPlaybackRate, playingRef, setPlaybackRate, videoRef]);


  return {
    videoRef,
    videoContainerRef,
    playbackRate,
    setPlaybackRate,
    outputPlaybackRate,
    setOutputPlaybackRate,
    commandedTime,
    setCommandedTime,
    commandedTimeRef,
    playing,
    setPlaying,
    playingRef,
    onStopPlaying,
    onStartPlaying,
    onSeeked,
    seekAbs,
    seekRel,
    play,
    pause,
    relevantTime,
    getRelevantTime,
    onVideoAbort,
    compatPlayerEventId,
    setCompatPlayerEventId,
    setOutputPlaybackRateState,
    playbackModeRef,
    playerTime,
    setPlayerTime,
  };
};
