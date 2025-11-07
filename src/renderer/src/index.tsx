import { Suspense, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { enableMapSet } from 'immer';
import * as Electron from 'electron';
import Remote from '@electron/remote';
import type path from 'node:path';
import type fsPromises from 'node:fs/promises';
import type fsExtraRaw from 'fs-extra';
import type mimeTypes from 'mime-types';
import type i18nextFsBackend from 'i18next-fs-backend';
import type cueParser from 'cue-parser';

import '@fontsource/open-sans/300.css';
import '@fontsource/open-sans/300-italic.css';
import '@fontsource/open-sans/400.css';
import '@fontsource/open-sans/400-italic.css';
import '@fontsource/open-sans/500.css';
import '@fontsource/open-sans/500-italic.css';
import '@fontsource/open-sans/600.css';
import '@fontsource/open-sans/600-italic.css';
import '@fontsource/open-sans/700.css';
import '@fontsource/open-sans/700-italic.css';
import '@fontsource/open-sans/800.css';
import '@fontsource/open-sans/800-italic.css';

import type * as main from '../../main/index';

import App from './App';
import ErrorBoundary from './ErrorBoundary';
import './i18n';

import './main.css';
import './swal2.scss';
import { KeyboardLayoutMap } from './types';


// something wrong with the tyep
type FsExtra = typeof fsExtraRaw & { exists: (p: string) => Promise<boolean> };

type TypedRemote = Omit<typeof Remote, 'require'> & {
  require: <T extends string>(module: T) => (
    T extends './index.js' ? typeof main :
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any
  );
}

declare global {
  interface Window {
    require: <T extends string>(module: T) => (
      T extends '@electron/remote' ? TypedRemote :
      T extends 'electron' ? typeof Electron :
      T extends 'path' ? typeof path :
      T extends 'node:path' ? typeof path :
      T extends 'fs/promises' ? typeof fsPromises :
      T extends 'node:fs/promises' ? typeof fsPromises :
      T extends 'fs-extra' ? FsExtra :
      T extends 'mime-types' ? typeof mimeTypes :
      T extends 'i18next-fs-backend' ? typeof i18nextFsBackend :
      T extends 'cue-parser' ? typeof cueParser :
      never
    );
  }
  interface Navigator {
    keyboard: {
      getLayoutMap(): Promise<KeyboardLayoutMap>;
    }
  }
}


enableMapSet();

const { app } = window.require('@electron/remote');

console.log('Version', app.getVersion());


const container = document.getElementById('root')!;
const root = createRoot(container);
root.render(
  <StrictMode>
    <ErrorBoundary>
      <Suspense fallback={<div />}>
        <App />
      </Suspense>
    </ErrorBoundary>
  </StrictMode>,
);
