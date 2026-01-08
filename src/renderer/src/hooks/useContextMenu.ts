import type { RefObject } from 'react';
import { useEffect } from 'react';

import useNativeMenu from './useNativeMenu';
import type { ContextMenuTemplate } from '../types';


// https://github.com/transflow/use-electron-context-menu
export default function useContextMenu(
  ref: RefObject<HTMLElement>,
  template: ContextMenuTemplate,
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
