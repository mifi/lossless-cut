import type { ReactNode } from 'react';
import { memo, useEffect, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { LuCheck, LuChevronRight } from 'react-icons/lu';

import * as DropdownMenu from './DropdownMenu';
import styles from './DropdownMenu.module.css';
import { isMac } from '../util';
import mainApi from '../mainApi';
import type { EditContextMenuRequest } from '../../../main/contextMenu';


const { ipcRenderer } = window.require('electron');


// A menu drawn inside the app instead of a native (OS) menu, so it matches the rest of the UI.
export interface MenuNode {
  label?: string | undefined,
  type?: 'normal' | 'separator' | 'submenu' | 'checkbox' | 'radio' | undefined,
  enabled?: boolean | undefined,
  visible?: boolean | undefined,
  checked?: boolean | undefined,
  accelerator?: string | undefined,
  onSelect?: (() => void) | undefined,
  submenu?: MenuNode[] | undefined,
}

export function formatAccelerator(accelerator: string) {
  return accelerator.split('+').map((key) => {
    if (/^(CommandOrControl|CmdOrCtrl)$/i.test(key)) return isMac ? '⌘' : 'Ctrl';
    if (/^(Command|Cmd)$/i.test(key)) return '⌘';
    if (/^(Option|Alt)$/i.test(key)) return isMac ? '⌥' : 'Alt';
    return key;
  }).join(isMac ? '' : '+');
}

export function MenuItems({ nodes }: { nodes: MenuNode[] }): ReactNode {
  return nodes.filter((node) => node.visible !== false).map((node, i) => {
    const key = `${i}-${node.label}`;

    if (node.type === 'separator') return <DropdownMenu.Separator key={key} />;

    if (node.submenu != null && node.submenu.length > 0) {
      return (
        <DropdownMenu.Sub key={key}>
          <DropdownMenu.SubTrigger className={styles['DropdownMenuItem']} disabled={node.enabled === false}>
            <span className={styles['indicator']} />
            {node.label}
            <LuChevronRight className={styles['rightSlot']} />
          </DropdownMenu.SubTrigger>
          <DropdownMenu.Portal>
            <DropdownMenu.SubContent className={styles['DropdownMenuContent']} sideOffset={4} collisionPadding={10}>
              <MenuItems nodes={node.submenu} />
            </DropdownMenu.SubContent>
          </DropdownMenu.Portal>
        </DropdownMenu.Sub>
      );
    }

    const isCheckable = node.type === 'checkbox' || node.type === 'radio';
    return (
      <DropdownMenu.Item key={key} disabled={node.enabled === false} onSelect={() => node.onSelect?.()}>
        <span className={styles['indicator']}>{isCheckable && node.checked && <LuCheck />}</span>
        {node.label}
        {node.accelerator && <span className={styles['rightSlot']}>{formatAccelerator(node.accelerator)}</span>}
      </DropdownMenu.Item>
    );
  });
}


// Context menus: one shared menu, opened at the mouse position

interface ContextMenuState { nodes: MenuNode[], x: number, y: number, id: number }

let contextMenuState: ContextMenuState | undefined;
let contextMenuId = 0;
const listeners = new Set<() => void>();

function setContextMenuState(state: ContextMenuState | undefined) {
  contextMenuState = state;
  listeners.forEach((listener) => listener());
}

export function openContextMenu(nodes: MenuNode[], x: number, y: number) {
  contextMenuId += 1;
  setContextMenuState({ nodes, x, y, id: contextMenuId });
}

export function closeContextMenu() {
  setContextMenuState(undefined);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

// eslint-disable-next-line react/display-name
export const ContextMenuHost = memo(() => {
  const { t } = useTranslation();
  const state = useSyncExternalStore(subscribe, () => contextMenuState);

  // cut/copy/paste menu for text fields and selected text, requested by the main process
  useEffect(() => {
    const onEditContextMenu = (_e: unknown, { x, y, isEditable, hasSelection }: EditContextMenuRequest) => {
      // the menu takes focus, so give it back to the text field before running the command
      const target = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
      const command = (name: Parameters<typeof mainApi.editCommand>[0]) => () => {
        target?.focus();
        mainApi.editCommand(name);
      };
      const nodes: MenuNode[] = isEditable ? [
        { label: t('Undo'), onSelect: command('undo') },
        { label: t('Redo'), onSelect: command('redo') },
        { type: 'separator' },
        { label: t('Cut'), enabled: hasSelection, onSelect: command('cut') },
        { label: t('Copy'), enabled: hasSelection, onSelect: command('copy') },
        { label: t('Paste'), onSelect: command('paste') },
        { type: 'separator' },
        { label: t('Select All'), onSelect: command('selectAll') },
      ] : [
        { label: t('Copy'), onSelect: command('copy') },
        { type: 'separator' },
        { label: t('Select All'), onSelect: command('selectAll') },
      ];
      openContextMenu(nodes, x, y);
    };
    ipcRenderer.on('editContextMenu', onEditContextMenu);
    return () => { ipcRenderer.off('editContextMenu', onEditContextMenu); };
  }, [t]);

  if (state == null) return null;

  return (
    // keyed, so that a new menu (e.g. right-clicking while one is open) opens fresh at the new position
    <DropdownMenu.Root key={state.id} open onOpenChange={(v) => { if (!v) closeContextMenu(); }} modal={false}>
      <DropdownMenu.Trigger asChild>
        <span style={{ position: 'fixed', left: state.x, top: state.y, width: 0, height: 0, pointerEvents: 'none' }} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" side="bottom" sideOffset={2} collisionPadding={10} onCloseAutoFocus={(e) => e.preventDefault()}>
          <MenuItems nodes={state.nodes} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
});
