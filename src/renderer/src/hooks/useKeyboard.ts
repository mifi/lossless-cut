import { useCallback, useEffect, useRef, useState } from 'react';

import { KeyBinding, KeyboardAction } from '../../../../types';
import { allModifiers, altModifiers, controlModifiers, metaModifiers, shiftModifiers } from '../util';
import { KeyboardLayoutMap } from '../types';
import isDev from '../isDev';


/* Keyboard testing points (when making large changes):
- ctrl/cmd + c/v should work in inputs
- Keyboard actions should not trigger when focus is inside a dialog, or when focusing inputs, switches etc.
- Clicking on the video are or some empty portions of the app should focus the document body again (to allow keyboard shortcuts to work)
- Test different keyboard layout: chinese, french. should work because the key code is the same.
- Reset LosslessCut settings (delete config.json file to get the default keyboard layout)
- Go to timecode (`g` shortcut): shouldn't insert the letter `g` into input box. This also applies to all the detect* actions
- Seek (autorepeat) and acceleration factor should reset after keyup
- Bind keyboard action dialog should not close when its key binding (shift+slash) is triggered

See also https://github.com/mifi/lossless-cut/issues/2515
*/

interface KeyEventParams { e: KeyboardEvent, action: KeyboardAction | undefined }

export default ({ keyBindings, keyUpActions, getKeyboardAction, closeExportConfirm, exportConfirmOpen, concatSheetOpen, setConcatSheetOpen }: {
  keyBindings: KeyBinding[],
  keyUpActions: Record<string, () => void>,
  getKeyboardAction: (action: KeyboardAction) => (() => boolean) | (() => void),
  exportConfirmOpen: boolean,
  closeExportConfirm: () => void,
  concatSheetOpen: boolean,
  setConcatSheetOpen: (open: boolean) => void,
}) => {
  const [keyboardLayoutMap, setKeyboardLayoutMap] = useState<KeyboardLayoutMap | undefined>();

  const altActionRef = useRef<boolean>(false);

  const onKeyUp2 = useCallback(({ action }: KeyEventParams) => {
    const fn = action && keyUpActions[action];
    fn?.();
  }, [keyUpActions]);

  const onKeyDown2 = useCallback(({ e, action }: KeyEventParams) => {
    // Allow escape to close dialogs, no matter what's focused
    // todo remove once we use Dialog component (already supports escape button)
    const isEscape = e.code === 'Escape';
    if (exportConfirmOpen) {
      if (isEscape) {
        closeExportConfirm();
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (action !== 'export') {
        return; // stop here, don't allow other key actions than export while dialog is open
      }
    }
    if (concatSheetOpen) {
      if (isEscape) {
        setConcatSheetOpen(false);
        e.preventDefault();
        e.stopPropagation();
      }
      return; // don't allow any other key actions while dialog is open
    }

    // From now on, only handle key events when focus is on document body
    // because we don't allow focus to anything else
    // except for inputs, buttons, dialogs etc, which we want allowed to handle keys normally.
    if (e.target !== document.body) {
      return;
    }
    // Alternatively, this is how mousetrap does it:
    // ignore when focus is inside inputs / textareas / selects / contentEditable,
    // including elements inside shadow DOM. use composedPath() when available.
    /* const path = (typeof e.composedPath === 'function' ? e.composedPath() : [e.target]) as EventTarget[];
    const isEditableInPath = path.some((node) => {
      if (!(node instanceof Element)) return false;
      const tag = node.tagName;
      return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || (node as HTMLElement).isContentEditable;
    });
    if (isEditableInPath) return;
    */

    // run main actions
    const matchingFn = action && getKeyboardAction(action);
    if (matchingFn != null) {
      matchingFn();
      e.preventDefault();
      e.stopPropagation();

      if (e.altKey) {
        altActionRef.current = true;
      }
    }

    if (isDev) console.log('key event', e.code, action, { defaultPrevented: e.defaultPrevented });
  }, [closeExportConfirm, concatSheetOpen, exportConfirmOpen, getKeyboardAction, setConcatSheetOpen]);


  // optimization to prevent re-binding all the time:
  const onKeyDownRef = useRef<(a: KeyEventParams) => void>();
  useEffect(() => {
    onKeyDownRef.current = onKeyDown2;
  }, [onKeyDown2]);

  const onKeyUpRef = useRef<(a: KeyEventParams) => void>();
  useEffect(() => {
    onKeyUpRef.current = onKeyUp2;
  }, [onKeyUp2]);

  useEffect(() => {
    const keyBindingsByKeyCode = keyBindings.reduce((acc, kb) => {
      kb.keys.split('+').forEach((key) => {
        if (!acc[key]) acc[key] = [];
        acc[key].push(kb);
      });
      return acc;
    }, {} as Record<string, KeyBinding[]>);

    function onKeyDown(params: KeyEventParams) {
      if (onKeyDownRef.current == null) return true;
      return onKeyDownRef.current(params);
    }

    function onKeyUp(params: KeyEventParams) {
      if (onKeyUpRef.current == null) return true;
      return onKeyUpRef.current(params);
    }

    const handleKeyEvent = (e: KeyboardEvent, ev: 'keydown' | 'keyup') => {
      // console.log(e)

      // If alt has been pressed and the `keydown` resulted in a keyboard action being triggered, prevent alt from triggering the menu popup.
      // Note: This has not been tested, and I assume that it can be prevented on `keyup`.
      // https://github.com/mifi/lossless-cut/issues/2180
      if (ev === 'keyup' && altActionRef.current && (e.code === 'AltLeft' || e.code === 'AltRight')) {
        console.log('Preventing alt menu popup');
        e.preventDefault();
        altActionRef.current = false;
      }

      if (allModifiers.has(e.code)) {
        return; // ignore pure modifier key events
      }

      const ctrl = e.ctrlKey;
      const shift = e.shiftKey;
      const alt = e.altKey;
      const meta = e.metaKey;

      // only use first one, if multiple matches (shouldn't happen anyway)
      const matchingKeyBinding = (keyBindingsByKeyCode[e.code] ?? []).find((kb) => {
        const kbKeys = new Set(kb.keys.split('+'));
        if ((controlModifiers.intersection(kbKeys).size > 0) !== ctrl) return false;
        if ((shiftModifiers.intersection(kbKeys).size > 0) !== shift) return false;
        if ((altModifiers.intersection(kbKeys).size > 0) !== alt) return false;
        if ((metaModifiers.intersection(kbKeys).size > 0) !== meta) return false;
        return true;
      });

      if (ev === 'keyup') onKeyUp({ e, action: matchingKeyBinding?.action });
      else onKeyDown({ e, action: matchingKeyBinding?.action });
    };

    const handleKeyDown = (e: KeyboardEvent) => handleKeyEvent(e, 'keydown');
    const handleKeyUp = (e: KeyboardEvent) => handleKeyEvent(e, 'keyup');

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [keyBindings]);

  const updateKeyboardLayout = useCallback(async () => {
    setKeyboardLayoutMap(await navigator.keyboard.getLayoutMap());
  }, [setKeyboardLayoutMap]);

  useEffect(() => {
    updateKeyboardLayout();

    window.addEventListener('focus', updateKeyboardLayout);
    return () => window.removeEventListener('focus', updateKeyboardLayout);
  }, [updateKeyboardLayout]);

  return {
    keyboardLayoutMap,
    updateKeyboardLayout,
  };
};
