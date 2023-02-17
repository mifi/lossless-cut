import React, { memo, useEffect, useRef, useMemo } from 'react';
import { useDebounce } from 'use-debounce';

import CanvasPlayer from './CanvasPlayer';

const Canvas = memo(({ rotate, filePath, width, height, playerTime, streamIndex, commandedTime, playing, eventId }) => {
  const canvasRef = useRef();

  const canvasPlayer = useMemo(() => CanvasPlayer({ path: filePath, width, height, streamIndex, getCanvas: () => canvasRef.current }), [filePath, width, height, streamIndex]);

  useEffect(() => () => {
    canvasPlayer.terminate();
  }, [canvasPlayer]);

  const state = useMemo(() => {
    if (playing) {
      return { startTime: commandedTime, playing, eventId };
    }
    return { startTime: playerTime, playing, eventId };
  }, [commandedTime, eventId, playerTime, playing]);

  const [debouncedState, { cancel }] = useDebounce(state, 200, {
    equalityFn: (a, b) => a.startTime === b.startTime && a.playing === b.playing && a.eventId === b.eventId,
  });

  /* useEffect(() => {
    console.log('state', state);
  }, [state]); */

  useEffect(() => () => {
    cancel();
  }, [cancel]);

  useEffect(() => {
    // console.log('debouncedState', debouncedState);

    if (debouncedState.startTime == null) return;

    if (debouncedState.playing) {
      canvasPlayer.play(debouncedState.startTime);
    } else {
      canvasPlayer.pause(debouncedState.startTime);
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
