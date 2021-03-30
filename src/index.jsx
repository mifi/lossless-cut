import React, { Suspense } from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import ErrorBoundary from './ErrorBoundary';
import './i18n';

import './fonts.css';
import './main.css';


console.log('Version', window.util.getAppVersion());

window.init.preload().then(() => {
  ReactDOM.render(<ErrorBoundary><Suspense fallback={<div />}><App /></Suspense></ErrorBoundary>, document.getElementById('root'));
}).catch(console.error);
