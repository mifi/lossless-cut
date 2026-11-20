import { pathToFileURL } from 'node:url';

// eslint-disable-next-line import-js/no-extraneous-dependencies
import { clipboard, ClipboardItem } from 'electron';

// Write file paths to the clipboard as files, so they can be pasted into a file manager or another app.
export async function copyFilesToClipboard(filePaths: string[]) {
  if (filePaths.length === 0) return;

  // Electron maps text/uri-list to the platform's native file-reference format (CF_HDROP on Windows, file URLs on macOS/Linux).
  const uriList = filePaths.map((filePath) => pathToFileURL(filePath).toString()).join('\r\n');
  await clipboard.write([new ClipboardItem({ 'text/uri-list': uriList })]);
}
