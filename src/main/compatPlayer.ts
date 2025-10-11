import assert from 'node:assert';
import { ExecaError } from 'execa';

import logger from './logger.js';
import { createMediaSourceProcess, readOneJpegFrame as readOneJpegFrameRaw } from './ffmpeg.js';


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
  assert(stdout != null);

  stdout.pause();

  const readChunk = async () => new Promise<Buffer | null>((resolve, reject) => {
    let cleanup: () => void;

    const onClose = () => {
      cleanup();
      resolve(null);
    };
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

      logger.warn((err as Error).message);
      logger.warn(stderr.toString('utf8'));
    }
  })();

  return { abort, readChunk };
}

export function readOneJpegFrame(params: Parameters<typeof readOneJpegFrameRaw>[0]) {
  const abortController = new AbortController();
  const process = readOneJpegFrameRaw(params);

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
