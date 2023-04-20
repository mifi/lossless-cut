import { encodeLiveRawStream, getOneRawFrame } from './ffmpeg';

// TODO keep everything in electron land?
const strtok3 = window.require('strtok3');

export default ({ path, width: inWidth, height: inHeight, streamIndex, getCanvas }) => {
  let terminated;
  let aborters = [];
  let commandedTime;
  let playing;

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

  async function command() {
    let process;
    let aborted = false;

    function killProcess() {
      if (process) {
        process.kill();
        process = undefined;
      }
    }

    function abort() {
      aborted = true;
      killProcess();
      aborters = aborters.filter(((aborter) => aborter !== abort));
    }
    aborters.push(abort);

    try {
      if (playing) {
        const { process: processIn, channels, width, height } = encodeLiveRawStream({ path, inWidth, inHeight, streamIndex, seekTo: commandedTime });
        process = processIn;

        // process.stderr.on('data', data => console.log(data.toString('utf-8')));

        const tokenizer = await strtok3.fromStream(process.stdout);
        if (aborted) return;

        const size = width * height * channels;
        const rgbaImage = Buffer.allocUnsafe(size);

        while (!aborted) {
          // eslint-disable-next-line no-await-in-loop
          await tokenizer.readBuffer(rgbaImage, { length: size });
          if (aborted) return;
          drawOnCanvas(rgbaImage, width, height);
        }
      } else {
        const { process: processIn, width, height } = getOneRawFrame({ path, inWidth, inHeight, streamIndex, seekTo: commandedTime, outSize: 1000 });
        process = processIn;
        const { stdout: rgbaImage } = await process;
        if (aborted) return;
        drawOnCanvas(rgbaImage, width, height);
      }
    } catch (err) {
      if (!err.killed) console.warn(err.message);
    } finally {
      killProcess();
    }
  }

  function abortAll() {
    aborters.forEach((aborter) => aborter());
  }

  function pause(seekTo) {
    if (terminated) return;
    playing = false;
    commandedTime = seekTo;

    abortAll();
    command();
  }

  function play(playFrom) {
    if (terminated) return;
    playing = true;
    commandedTime = playFrom;

    abortAll();
    command();
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
