import type { Menu as MenuType, MenuItemConstructorOptions, MenuItem } from 'electron';
import { useCallback, useMemo } from 'react';

// TODO pull out?
const remote = window.require('@electron/remote');
// eslint-disable-next-line prefer-destructuring
const Menu: typeof MenuType = remote.Menu;

// https://github.com/transflow/use-electron-context-menu
// https://www.electronjs.org/docs/latest/api/menu-item
export default function useNativeMenu(
  template: (MenuItemConstructorOptions | MenuItem)[],
  options: { x?: number, y?: number, onContext?: (e: MouseEvent) => void, onClose?: () => void } = {},
) {
  const menu = useMemo(() => Menu.buildFromTemplate(template), [template]);

  const { x, y, onContext, onClose } = options;

  const openMenu = useCallback((e: MouseEvent) => {
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
