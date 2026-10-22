import type { MouseEventHandler } from 'react';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuCopy, LuMenu, LuMinus, LuSquare, LuX } from 'react-icons/lu';

import mainApi from '../mainApi';
import styles from './WindowControls.module.css';


const remote = window.require('@electron/remote');
const { ipcRenderer } = window.require('electron');

// When true, the window has no native frame, so we draw the menu button and window controls ourselves
export const { customTitleBar } = remote.require('./index.js');

// eslint-disable-next-line react/display-name
export const AppMenuButton = memo(() => {
  const { t } = useTranslation();

  const onClick = useCallback<MouseEventHandler<HTMLButtonElement>>((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mainApi.popupAppMenu(rect.left, rect.bottom + 6);
  }, []);

  return (
    <button type="button" className={`llc-icon-button ${styles['menuButton']}`} title={t('Menu')} onClick={onClick}>
      <LuMenu size={17} />
    </button>
  );
});

function WindowControls() {
  const { t } = useTranslation();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    mainApi.isWindowMaximized().then(setMaximized);
    const onChange = (_e: unknown, value: boolean) => setMaximized(value);
    ipcRenderer.on('windowMaximizedChange', onChange);
    return () => { ipcRenderer.off('windowMaximizedChange', onChange); };
  }, []);

  const MaximizeIcon = maximized ? LuCopy : LuSquare;

  return (
    <div className={styles['controls']}>
      <button type="button" className={styles['control']} title={t('Minimize')} onClick={() => mainApi.minimizeWindow()}>
        <LuMinus size={14} />
      </button>
      <button type="button" className={styles['control']} title={maximized ? t('Restore') : t('Maximize')} onClick={() => mainApi.toggleMaximizeWindow()}>
        <MaximizeIcon size={11} style={maximized ? { transform: 'scaleX(-1)' } : undefined} />
      </button>
      <button type="button" className={[styles['control'], styles['close']].join(' ')} title={t('Close')} onClick={() => mainApi.closeWindow()}>
        <LuX size={14} />
      </button>
    </div>
  );
}

export default memo(WindowControls);
