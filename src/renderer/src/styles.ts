import type { CSSProperties } from 'react';
import { darkModeTransition } from './colors';


export const videoStyle: CSSProperties = { width: '100%', height: '100%', objectFit: 'contain' };
export const bottomStyle: CSSProperties = { background: 'var(--player-surface)', transition: darkModeTransition, flexShrink: 0 };
