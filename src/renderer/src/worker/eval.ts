import invariant from 'tiny-invariant';

// https://github.com/vitejs/vite/issues/11823#issuecomment-1407277242
// https://github.com/mifi/lossless-cut/issues/2059
import Worker from './evalWorker?worker';


export interface RequestMessageData {
  code: string,
  id: number,
  context: string // json
}

export type ResponseMessageData = { id: number } & ({
  error: string,
} | {
  data: unknown,
})

// https://v3.vitejs.dev/guide/features.html#web-workers
// todo terminate() and recreate in case of error?
const worker = new Worker();
worker.addEventListener('error', (err) => {
  console.error('evalWorker error', err);
});

let lastRequestId = 0;

export default async function safeishEval(code: string, context: Record<string, unknown>) {
  return new Promise((resolve, reject) => {
    lastRequestId += 1;
    const id = lastRequestId;

    // console.log({ lastRequestId, code, context })

    function cleanup() {
      // eslint-disable-next-line no-use-before-define
      worker.removeEventListener('message', onMessage);
      // eslint-disable-next-line no-use-before-define
      worker.removeEventListener('messageerror', onMessageerror);
      // eslint-disable-next-line no-use-before-define
      worker.removeEventListener('error', onError);
    }

    function onMessage(response: { data: ResponseMessageData }) {
      // console.log('message', { responseId, error, data })

      if (response.data.id === id) {
        cleanup();
        if ('error' in response.data) {
          reject(new Error(response.data.error));
        } else {
          invariant('data' in response.data);
          resolve(response.data.data);
        }
      }
    }

    function onMessageerror() {
      cleanup();
      reject(new Error('safeishEval messageerror'));
    }

    function onError(err: ErrorEvent) {
      cleanup();
      reject(new Error(`safeishEval error: ${err.message}`));
    }

    worker.addEventListener('message', onMessage);
    worker.addEventListener('messageerror', onMessageerror);
    worker.addEventListener('error', onError);

    worker.postMessage({ id, code, context: JSON.stringify(context) } satisfies RequestMessageData);
  });
}
