import { useCallback, useEffect, useMemo } from 'react';

// TODO pull out?
const { remote } = window.require('electron');
const { Menu } = remote;

// https://github.com/transflow/use-electron-context-menu

export default function useContextMenu(
  ref,
  template,
  options = {},
) {
  const menu = useMemo(() => Menu.buildFromTemplate(template), [template]);

  const { x, y, onContext, onClose } = options;

  useEffect(() => {
    function handleContext(e) {
      menu.popup({
        window: remote.getCurrentWindow(),
        x,
        y,
        callback: onClose,
      });

      if (onContext) onContext(e);
    }

    const el = ref.current;
    if (el) {
      el.addEventListener('contextmenu', handleContext);
    }
    return () => el.removeEventListener('contextmenu', handleContext);
  }, [menu, onClose, onContext, ref, x, y]);

  const closeMenu = useCallback(() => menu.closePopup(), [menu]);

  return { closeMenu };
}
