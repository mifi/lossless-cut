import { RefObject, useEffect } from 'react';
import type { MenuItem, MenuItemConstructorOptions } from 'electron';

import useNativeMenu from './useNativeMenu';

// https://github.com/transflow/use-electron-context-menu
export default function useContextMenu(
  ref: RefObject<HTMLElement>,
  template: (MenuItemConstructorOptions | MenuItem)[],
) {
  const { openMenu, closeMenu } = useNativeMenu(template);

  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.addEventListener('contextmenu', openMenu);
      return () => el.removeEventListener('contextmenu', openMenu);
    }
    return undefined;
  }, [openMenu, ref]);

  return { closeMenu };
}
