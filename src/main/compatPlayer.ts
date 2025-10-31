import { ExecaError } from 'execa';

import logger from './logger.js';
import { createMediaSourceProcess } from './ffmpeg.js';


// eslint-disable-next-line import/prefer-default-export
export function createMediaSourceStream(params: Parameters<typeof createMediaSourceProcess>[0]) {
  const abortController = new AbortController();
  const { videoStreamIndex, audioStreamIndexes, seekTo } = params;
  logger.info('Starting preview process', { videoStreamIndex, audioStreamIndexes, seekTo });
  const process = createMediaSourceProcess(params);

  // eslint-disable-next-line unicorn/prefer-add-event-listener
  abortController.signal.onabort = () => {
    logger.info('Aborting preview process', { videoStreamIndex, audioStreamIndexes, seekTo });
    process.kill('SIGKILL');
  };

  const { stdout } = process;

  stdout.pause();

  const readChunk = async () => new Promise<Buffer | null>((resolve, reject) => {
    let cleanup: () => void;

    const onClose = () => {
      cleanup();
      resolve(null);
    };

    // poor man's backpressure handling: we only read one chunk at a time
    const onData = (chunk: Buffer) => {
      stdout.pause();
      cleanup();
      resolve(chunk);
    };
    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };
    cleanup = () => {
      stdout.off('data', onData);
      stdout.off('error', onError);
      stdout.off('close', onClose);
    };

    stdout.once('data', onData);
    stdout.once('error', onError);
    stdout.once('close', onClose);

    stdout.resume();
  });

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
      if (err instanceof ExecaError && err.isTerminated) {
        return;
      }

      logger.warn(err instanceof Error ? err.message : String(err));
      logger.warn(stderr.toString('utf8'));
    }
  })();

  return { abort, readChunk };
}
