import type { CSSProperties } from 'react';
import { darkModeTransition } from './colors';


export const videoStyle: CSSProperties = { width: '100%', height: '100%' };
export const bottomStyle: CSSProperties = { transition: darkModeTransition, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '.5em', padding: '.5em .6em .6em' };
