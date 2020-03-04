import React from 'react';
import ReactDOM from 'react-dom';
import './main.css';
import App from './App';

const electron = window.require('electron');


console.log('Version', electron.remote.app.getVersion());

ReactDOM.render(<App />, document.getElementById('root'));
