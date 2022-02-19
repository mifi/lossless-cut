import { useCallback, useMemo } from 'react';

// TODO pull out?
const { remote } = window.require('electron');
const { Menu } = remote;

// https://github.com/transflow/use-electron-context-menu
// https://www.electronjs.org/docs/latest/api/menu-item
export default function useNativeMenu(
  template,
  options = {},
) {
  const menu = useMemo(() => Menu.buildFromTemplate(template), [template]);

  const { x, y, onContext, onClose } = options;

  const openMenu = useCallback((e) => {
    menu.popup({
      window: remote.getCurrentWindow(),
      x,
      y,
      callback: onClose,
    });

    if (onContext) onContext(e);
  }, [menu, onClose, onContext, x, y]);

  const closeMenu = useCallback(() => menu.closePopup(), [menu]);

  return { openMenu, closeMenu };
}
