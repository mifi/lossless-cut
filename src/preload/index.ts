import type { RemoteRpcApi } from '../main/index.ts';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ipcRenderer } = require('electron') as typeof import('electron');

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
// @ts-expect-error we don't need to type this
// eslint-disable-next-line unicorn-js/no-global-object-property-assignment -- TODO fix (new rule in @mifi/lint-config)
window.electron = apiProxy;
// contextBridge.exposeInMainWorld('electron', apiProxy);
