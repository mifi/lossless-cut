import React, { memo, useEffect, useRef, useMemo } from 'react';
import { useDebounce } from 'use-debounce';

import CanvasPlayer from './CanvasPlayer';

const Canvas = memo(({ rotate, filePath, width, height, playerTime, streamIndex, commandedTime, playing }) => {
  const canvasRef = useRef();

  const canvasPlayer = useMemo(() => CanvasPlayer({ path: filePath, width, height, streamIndex, getCanvas: () => canvasRef.current }), [filePath, width, height, streamIndex]);

  useEffect(() => () => {
    canvasPlayer.terminate();
  }, [canvasPlayer]);

  const state = useMemo(() => {
    if (playing) {
      return { time: commandedTime, playing };
    }
    return { time: playerTime, playing };
  }, [commandedTime, playerTime, playing]);

  const [debouncedState, { cancel }] = useDebounce(state, 300, { leading: true, equalityFn: ({ time: time1, playing: playing1 }, { time: time2, playing: playing2 }) => time1 === time2 && playing1 === playing2 });

  /* useEffect(() => {
    console.log('state', state);
  }, [state]); */

  useEffect(() => () => {
    cancel();
  }, [cancel]);

  useEffect(() => {
    // console.log('debouncedState', debouncedState);

    if (debouncedState.time == null) return;

    if (debouncedState.playing) {
      canvasPlayer.play(debouncedState.time);
    } else {
      canvasPlayer.pause(debouncedState.time);
    }
  }, [debouncedState, canvasPlayer]);

  const canvasStyle = useMemo(() => ({ display: 'block', width: '100%', height: '100%', objectFit: 'contain', transform: rotate ? `rotate(${rotate}deg)` : undefined }), [rotate]);

  return (
    <div style={{ width: '100%', height: '100%', left: 0, right: 0, top: 0, bottom: 0, position: 'absolute', overflow: 'hidden', background: 'black' }}>
      <canvas ref={canvasRef} style={canvasStyle} />
    </div>
  );
});

export default Canvas;
