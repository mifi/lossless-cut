import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuCopy, LuMenu, LuMinus, LuSquare, LuX } from 'react-icons/lu';

import mainApi from '../mainApi';
import * as DropdownMenu from './DropdownMenu';
import type { MenuNode } from './InAppMenu';
import { MenuItems } from './InAppMenu';
import type { SerializedMenuItem } from '../../../main/index';
import styles from './WindowControls.module.css';


const remote = window.require('@electron/remote');
const { ipcRenderer } = window.require('electron');

// When true, the window has no native frame, so we draw the menu button and window controls ourselves
export const { customTitleBar } = remote.require('./index.js');

// The app menu, drawn inside the app because the custom title bar has no native menu bar.
// The items come from the real application menu in the main process, and clicking one runs it there.
// eslint-disable-next-line react/display-name
export const AppMenuButton = memo(() => {
  const { t } = useTranslation();
  const [menu, setMenu] = useState<SerializedMenuItem[]>([]);

  const refresh = useCallback(() => { mainApi.getAppMenu().then(setMenu); }, []);
  useEffect(refresh, [refresh]);

  const nodes = useMemo(() => {
    const toNodes = (items: SerializedMenuItem[], parentPath: number[]): MenuNode[] => items.map((item, i) => ({
      label: item.label,
      type: item.type === 'separator' || item.type === 'checkbox' || item.type === 'radio' ? item.type : undefined,
      enabled: item.enabled,
      visible: item.visible,
      checked: item.checked,
      accelerator: item.accelerator,
      onSelect: () => mainApi.clickAppMenuItem([...parentPath, i]),
      submenu: item.submenu != null ? toNodes(item.submenu, [...parentPath, i]) : undefined,
    }));
    return toNodes(menu, []);
  }, [menu]);

  return (
    // menus can change (e.g. checkboxes, a new version available), so fetch them again when opening
    <DropdownMenu.Root modal={false} onOpenChange={(open) => { if (open) refresh(); }}>
      <DropdownMenu.Trigger asChild>
        <button type="button" className={`llc-icon-button ${styles['menuButton']}`} title={t('Menu')}>
          <LuMenu size={17} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" sideOffset={8} collisionPadding={10} onCloseAutoFocus={(e) => e.preventDefault()}>
          <MenuItems nodes={nodes} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
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
