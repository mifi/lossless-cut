import type { MenuItemConstructorOptions, MenuItem } from 'electron';
import { useCallback } from 'react';

import type { MenuNode } from '../components/InAppMenu';
import { closeContextMenu, openContextMenu } from '../components/InAppMenu';


function toMenuNodes(template: (MenuItemConstructorOptions | MenuItem)[]): MenuNode[] {
  return template.map((item) => ({
    label: item.label,
    type: item.type === 'separator' || item.type === 'checkbox' || item.type === 'radio' ? item.type : undefined,
    enabled: item.enabled,
    visible: item.visible,
    checked: item.checked,
    accelerator: item.accelerator != null ? String(item.accelerator) : undefined,
    // our templates only use click(), without its arguments
    // @ts-expect-error menu item click handlers expect electron arguments
    onSelect: item.click != null ? () => item.click() : undefined,
    submenu: Array.isArray(item.submenu) ? toMenuNodes(item.submenu) : undefined,
  }));
}

// Context menus are drawn inside the app (see InAppMenu), so they match the rest of the UI.
// The template uses electron's menu item format, as it used to be shown as a native menu.
export default function useNativeMenu(
  template: (MenuItemConstructorOptions | MenuItem)[],
  options: { x?: number, y?: number, onContext?: (e: MouseEvent) => void } = {},
) {
  const { x, y, onContext } = options;

  const openMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
    openContextMenu(toMenuNodes(template), x ?? e.clientX, y ?? e.clientY);

    if (onContext) onContext(e);
  }, [onContext, template, x, y]);

  const closeMenu = useCallback(() => closeContextMenu(), []);

  return { openMenu, closeMenu };
}
