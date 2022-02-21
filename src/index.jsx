import React, { Suspense } from 'react';
import ReactDOM from 'react-dom';

import App from './App';
import ErrorBoundary from './ErrorBoundary';
import './i18n';

import './fonts.css';
import './main.css';


const electron = window.require('electron');

console.log('Version', electron.remote.app.getVersion());


ReactDOM.render(
  (
    <ErrorBoundary>
      <Suspense fallback={<div />}>
        <App />
      </Suspense>
    </ErrorBoundary>
  ), document.getElementById('root'),
);
