const strtok3 = require('strtok3');

const { getOneRawFrame, encodeLiveRawStream } = require('./ffmpeg');


let aborters = [];

async function command({ path, inWidth, inHeight, streamIndex, seekTo: commandedTime, onRawFrame, onJpegFrame, playing }) {
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
        // eslint-disable-next-line no-await-in-loop
        await onRawFrame(rgbaImage, width, height);
      }
    } else {
      const { process: processIn, width, height } = getOneRawFrame({ path, inWidth, inHeight, streamIndex, seekTo: commandedTime, outSize: 1000 });
      process = processIn;
      const { stdout: jpegImage } = await process;
      if (aborted) return;
      onJpegFrame(jpegImage, width, height);
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

module.exports = {
  command,
  abortAll,
};
