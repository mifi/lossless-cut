import type { RemoteRpcApi } from '../main/index.ts';

// eslint-disable-next-line import/no-extraneous-dependencies, @typescript-eslint/no-var-requires
const { ipcRenderer } = require('electron');

const apiProxy = new Proxy(
  {} as RemoteRpcApi,
  {
    get(_target, method: keyof RemoteRpcApi) {
      return (...args: unknown[]) => (
        ipcRenderer.invoke('__electron_rpc__', method, args)
      );
    },
  },
);

// todo use contextBridge instead once we get rid of @electron/remote
// @ts-expect-error untyped
window.electron = apiProxy;
// contextBridge.exposeInMainWorld('electron', apiProxy);
