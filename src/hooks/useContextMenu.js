import { useCallback, useEffect, useMemo } from 'react';

// https://github.com/transflow/use-electron-context-menu

// TODO pull out?
const { buildMenuFromTemplate } = window.util;

export default function useContextMenu(
  ref,
  template,
  options = {},
) {
  const menu = useMemo(() => buildMenuFromTemplate(template), [template]);

  const { x, y, onContext, onClose } = options;

  useEffect(() => {
    function handleContext(e) {
      menu.popup({
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
