const remote = window.require('@electron/remote');

const { command, abortAll } = remote.require('./canvasPlayer');

export default ({ path, width: inWidth, height: inHeight, streamIndex, getCanvas }) => {
  let terminated;

  function drawOnCanvas(rgbaImage, width, height) {
    const canvas = getCanvas();
    if (!canvas || rgbaImage.length === 0) return;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    // https://developer.mozilla.org/en-US/docs/Web/API/ImageData/ImageData
    // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/putImageData
    ctx.putImageData(new ImageData(Uint8ClampedArray.from(rgbaImage), width, height), 0, 0);
  }

  function pause(seekTo) {
    if (terminated) return;
    abortAll();
    command({ path, inWidth, inHeight, streamIndex, seekTo, onFrame: drawOnCanvas, playing: false });
  }

  function play(playFrom) {
    if (terminated) return;
    abortAll();
    command({ path, inWidth, inHeight, streamIndex, seekTo: playFrom, onFrame: drawOnCanvas, playing: true });
  }

  function terminate() {
    if (terminated) return;
    terminated = true;
    abortAll();
  }

  return {
    play,
    pause,
    terminate,
  };
};
