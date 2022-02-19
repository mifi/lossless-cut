import { useEffect } from 'react';

import useNativeMenu from './useNativeMenu';

// https://github.com/transflow/use-electron-context-menu
export default function useContextMenu(
  ref,
  template,
  options = {},
) {
  const { openMenu, closeMenu } = useNativeMenu(template, options);

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
