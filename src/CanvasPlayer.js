import { encodeLiveRawStream, getOneRawFrame } from './ffmpeg';

// TODO keep everything in electron land?
const strtok3 = window.require('strtok3');

export default ({ path, width: inWidth, height: inHeight }) => {
  let canvas;

  let terminated;
  let cancel;
  let commandedTime;
  let playing;

  function drawOnCanvas(rgbaImage, width, height) {
    if (!canvas || rgbaImage.length === 0) return;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    // https://developer.mozilla.org/en-US/docs/Web/API/ImageData/ImageData
    // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/putImageData
    ctx.putImageData(new ImageData(Uint8ClampedArray.from(rgbaImage), width, height), 0, 0);
  }

  async function run() {
    let process;
    let cancelled;

    cancel = () => {
      cancelled = true;
      if (process) process.cancel();
      cancel = undefined;
    };

    if (playing) {
      try {
        const { process: processIn, channels, width, height } = encodeLiveRawStream({ path, inWidth, inHeight, seekTo: commandedTime });
        process = processIn;

        // process.stderr.on('data', data => console.log(data.toString('utf-8')));

        const tokenizer = await strtok3.fromStream(process.stdout);

        const size = width * height * channels;
        const buf = Buffer.allocUnsafe(size);

        while (!cancelled) {
          // eslint-disable-next-line no-await-in-loop
          await tokenizer.readBuffer(buf, { length: size });
          if (!cancelled) drawOnCanvas(buf, width, height);
        }
      } catch (err) {
        if (!err.isCanceled) console.warn(err.message);
      }
    } else {
      try {
        const { process: processIn, width, height } = getOneRawFrame({ path, inWidth, inHeight, seekTo: commandedTime });
        process = processIn;
        const { stdout: rgbaImage } = await process;

        if (!cancelled) drawOnCanvas(rgbaImage, width, height);
      } catch (err) {
        if (!err.isCanceled) console.warn(err.message);
      }
    }
  }

  function command() {
    if (cancel) cancel();
    run();
  }

  function pause(seekTo) {
    if (terminated) return;
    if (!playing && commandedTime === seekTo) return;
    playing = false;
    commandedTime = seekTo;
    command();
  }

  function play(playFrom) {
    if (terminated) return;
    if (playing && commandedTime === playFrom) return;
    playing = true;
    commandedTime = playFrom;
    command();
  }

  function setCanvas(c) {
    canvas = c;
  }

  function dispose() {
    terminated = true;
    if (cancel) cancel();
  }

  return {
    play,
    pause,
    setCanvas,
    dispose,
  };
};
