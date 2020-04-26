
import React, { memo, useEffect, useRef, useMemo } from 'react';

import CanvasPlayer from './CanvasPlayer';

const Canvas = memo(({ rotate, filePath, width, height, playerTime, commandedTime, playing }) => {
  const canvasRef = useRef();

  const canvasPlayer = useMemo(() => CanvasPlayer({ path: filePath, width, height }),
    [filePath, width, height]);

  useEffect(() => {
    canvasPlayer.setCanvas(canvasRef.current);

    return () => {
      canvasPlayer.setCanvas();
      if (canvasPlayer) canvasPlayer.dispose();
    };
  }, [canvasPlayer]);

  useEffect(() => {
    if (playing) canvasPlayer.play(commandedTime);
    else canvasPlayer.pause(playerTime);
  }, [canvasPlayer, commandedTime, playerTime, playing]);

  return (
    <div style={{ width: '100%', height: '100%', left: 0, right: 0, top: 0, bottom: 0, position: 'absolute', overflow: 'hidden', background: 'black' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain', transform: `rotate(${rotate}deg)` }} />
    </div>
  );
});

export default Canvas;
