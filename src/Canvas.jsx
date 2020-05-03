
import React, { memo, useEffect, useRef, useMemo, useState } from 'react';
import useDebounce from 'react-use/lib/useDebounce';

import CanvasPlayer from './CanvasPlayer';

const Canvas = memo(({ rotate, filePath, width, height, playerTime, streamIndex, commandedTime, playing }) => {
  const canvasRef = useRef();

  const canvasPlayer = useMemo(() => CanvasPlayer({ path: filePath, width, height, streamIndex }),
    [filePath, width, height, streamIndex]);

  useEffect(() => {
    canvasPlayer.setCanvas(canvasRef.current);

    return () => {
      canvasPlayer.setCanvas();
      canvasPlayer.dispose();
    };
  }, [canvasPlayer]);

  const [debouncedPlayerTime, setDebouncedPlayerTime] = useState(0);
  const [debouncedCommandedTime, setDebouncedCommandedTime] = useState(0);

  const [, cancelPlayerTimeDebounce] = useDebounce(() => {
    setDebouncedPlayerTime(playerTime);
  }, 100, [playerTime]);

  const [, cancelCommandedTimeDebounce] = useDebounce(() => {
    setDebouncedCommandedTime(commandedTime);
  }, 300, [commandedTime]);

  useEffect(() => () => {
    cancelPlayerTimeDebounce();
    cancelCommandedTimeDebounce();
  }, [cancelPlayerTimeDebounce, cancelCommandedTimeDebounce]);

  useEffect(() => {
    if (playing) canvasPlayer.play(debouncedCommandedTime);
    else canvasPlayer.pause(debouncedPlayerTime);
  }, [canvasPlayer, debouncedCommandedTime, debouncedPlayerTime, playing]);

  const canvasStyle = useMemo(() => ({ display: 'block', width: '100%', height: '100%', objectFit: 'contain', transform: rotate ? `rotate(${rotate}deg)` : undefined }), [rotate]);

  return (
    <div style={{ width: '100%', height: '100%', left: 0, right: 0, top: 0, bottom: 0, position: 'absolute', overflow: 'hidden', background: 'black' }}>
      <canvas ref={canvasRef} style={canvasStyle} />
    </div>
  );
});

export default Canvas;
