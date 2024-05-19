const workerUrl = new URL('evalWorker.js', import.meta.url);

// https://v3.vitejs.dev/guide/features.html#web-workers
// todo terminate() and recreate in case of error?
const worker = new Worker(workerUrl);

let lastRequestId = 0;

export default async function safeishEval(code: string, context: unknown) {
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

    function onMessage({ data: { id: responseId, error, data } }) {
      // console.log('message', { responseId, error, data })

      if (responseId === id) {
        cleanup();
        if (error) reject(new Error(error));
        else resolve(data);
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

    worker.postMessage({ id, code, context: JSON.stringify(context) });
  });
}
