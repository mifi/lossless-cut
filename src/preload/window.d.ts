// What the preload script exposes on `window`. Shared by the preload and renderer projects, so tsc checks both sides
import type { RemoteRpcApi } from '../main/index.ts';

declare global {
  interface Window {
    electron: RemoteRpcApi;
  }
}
