import { ExecaError } from 'execa';

import logger from './logger.js';
import { createMediaSourceProcess } from './ffmpeg.js';


// eslint-disable-next-line import/prefer-default-export
export function createMediaSourceStream(params: Parameters<typeof createMediaSourceProcess>[0]) {
  const abortController = new AbortController();

  const abort = () => abortController.abort();

  async function attemptCreateProcess({ forceColorspace }: { forceColorspace?: boolean } = {}) {
    const { videoStreamIndex, audioStreamIndexes, seekTo } = params;

    logger.info('Starting preview process', { videoStreamIndex, audioStreamIndexes, seekTo });
    const process = createMediaSourceProcess({ ...params, forceColorspace });

    // eslint-disable-next-line unicorn/prefer-add-event-listener
    abortController.signal.onabort = () => {
      logger.info('Aborting preview process', { videoStreamIndex, audioStreamIndexes, seekTo });
      process.kill('SIGKILL');
    };

    const { stdout } = process;

    logger.info('Waiting for first chunk');

    let timeout: NodeJS.Timeout | undefined;
    let firstChunk: Buffer | undefined;

    try {
      await Promise.race([
        new Promise<void>((resolve, reject) => {
          stdout.once('data', (chunk) => {
            stdout.pause();
            firstChunk = chunk;
            resolve();
          });
          timeout = setTimeout(() => {
            reject(new Error('Timeout waiting for media source process to start outputting data'));
          }, 10000);
        }),
        process,
      ]);
    } catch (err) {
      process.kill('SIGKILL');
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    logger.info('First chunk received');

    const readChunk = async () => new Promise<Buffer | null>((resolve, reject) => {
      if (firstChunk) {
        logger.info('Client read first chunk');
        resolve(firstChunk);
        firstChunk = undefined;
        return;
      }

      // eslint-disable-next-line no-shadow
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

    return readChunk;
  }

  return {
    abort,
    promise: (async () => {
      try {
        return await attemptCreateProcess();
      } catch (err) {
        if (abortController.signal.aborted) {
          return undefined;
        }
        if (err instanceof ExecaError && /^\[swscaler[^\]]+\]\s+Unsupported input/gm.test((err as ExecaError<{ buffer: { stdout: false, stderr: true }, encoding: 'utf8' }>).stderr)) {
          logger.warn('Media source process failed due to unsupported colorspace, retrying with forced colorspace conversion');

          try {
            return await attemptCreateProcess({ forceColorspace: true });
          } catch (err2) {
            if (abortController.signal.aborted) {
              return undefined;
            }
            logger.warn('Media source process error', err2 instanceof Error ? err2.message : err2);
            return undefined;
          }
        }

        logger.warn('Media source process error', err instanceof Error ? err.message : err);
        return undefined;
      }
    })(),
  };
}
