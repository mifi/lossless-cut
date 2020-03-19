import React, { Suspense } from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import './i18n';
import './main.css';


const electron = window.require('electron');

console.log('Version', electron.remote.app.getVersion());

ReactDOM.render(<Suspense fallback={<div />}><App /></Suspense>, document.getElementById('root'));
