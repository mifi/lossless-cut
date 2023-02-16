import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'framer-motion';

import 'sweetalert2/dist/sweetalert2.css';

import App from './App';
import ErrorBoundary from './ErrorBoundary';
import './i18n';

import './fonts.css';
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
