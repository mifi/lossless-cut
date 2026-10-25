import type { BrowserWindow } from 'electron';

export interface EditContextMenuRequest { x: number, y: number, isEditable: boolean, hasSelection: boolean }

// The cut/copy/paste menu for text fields and selected text is drawn by the renderer (InAppMenu), to match the rest of the UI.
// https://github.com/electron/electron/issues/4068#issuecomment-274159726
export default (window: BrowserWindow) => {
  window.webContents.on('context-menu', (_e, props) => {
    const { selectionText, isEditable, x, y } = props;
    const hasSelection = selectionText != null && selectionText.trim() !== '';
    if (isEditable || hasSelection) {
      window.webContents.send('editContextMenu', { x, y, isEditable, hasSelection } satisfies EditContextMenuRequest);
    }
  });
};
