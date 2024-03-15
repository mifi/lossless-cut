const logger = require('./logger');
const { createMediaSourceProcess, readOneJpegFrame } = require('./ffmpeg');


function createMediaSourceStream({ path, videoStreamIndex, audioStreamIndex, seekTo, size, fps }) {
  const abortController = new AbortController();
  logger.info('Starting preview process', { videoStreamIndex, audioStreamIndex, seekTo });
  const process = createMediaSourceProcess({ path, videoStreamIndex, audioStreamIndex, seekTo, size, fps });

  // eslint-disable-next-line unicorn/prefer-add-event-listener
  abortController.signal.onabort = () => {
    logger.info('Aborting preview process', { videoStreamIndex, audioStreamIndex, seekTo });
    process.kill('SIGKILL');
  };

  process.stdout.pause();

  async function readChunk() {
    return new Promise((resolve, reject) => {
      let cleanup;

      const onClose = () => {
        cleanup();
        resolve(null);
      };
      const onData = (chunk) => {
        process.stdout.pause();
        cleanup();
        resolve(chunk);
      };
      const onError = (err) => {
        cleanup();
        reject(err);
      };
      cleanup = () => {
        process.stdout.off('data', onData);
        process.stdout.off('error', onError);
        process.stdout.off('close', onClose);
      };

      process.stdout.once('data', onData);
      process.stdout.once('error', onError);
      process.stdout.once('close', onClose);

      process.stdout.resume();
    });
  }

  function abort() {
    abortController.abort();
  }

  let stderr = Buffer.alloc(0);
  process.stderr?.on('data', (chunk) => {
    stderr = Buffer.concat([stderr, chunk]);
  });

  (async () => {
    try {
      await process;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      // @ts-expect-error todo
      if (!(err.killed)) {
        // @ts-expect-error todo
        console.warn(err.message);
        console.warn(stderr.toString('utf8'));
      }
    }
  })();

  return { abort, readChunk };
}

function readOneJpegFrameWrapper({ path, seekTo, videoStreamIndex }) {
  const abortController = new AbortController();
  const process = readOneJpegFrame({ path, seekTo, videoStreamIndex });

  // eslint-disable-next-line unicorn/prefer-add-event-listener
  abortController.signal.onabort = () => process.kill('SIGKILL');

  function abort() {
    abortController.abort();
  }

  const promise = (async () => {
    try {
      const { stdout } = await process;
      return stdout;
    } catch (err) {
      // @ts-expect-error todo
      logger.error('renderOneJpegFrame', err.shortMessage);
      throw new Error('Failed to render JPEG frame');
    }
  })();

  return { promise, abort };
}


module.exports = {
  createMediaSourceStream,
  readOneJpegFrame: readOneJpegFrameWrapper,
};
