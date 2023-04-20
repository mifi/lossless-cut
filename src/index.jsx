import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'framer-motion';

import 'sweetalert2/dist/sweetalert2.css';

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

import App from './App';
import ErrorBoundary from './ErrorBoundary';
import './i18n';

import './main.css';


const { app } = window.require('@electron/remote');

console.log('Version', app.getVersion());


const container = document.getElementById('root');
const root = createRoot(container);
root.render(
  <ErrorBoundary>
    <Suspense fallback={<div />}>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </Suspense>
  </ErrorBoundary>,
);
