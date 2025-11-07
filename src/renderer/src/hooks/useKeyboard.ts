import { useCallback, useEffect, useRef, useState } from 'react';

import { KeyBinding, KeyboardAction } from '../../../../types';
import { allModifiers, altModifiers, controlModifiers, metaModifiers, shiftModifiers } from '../util';
import { KeyboardLayoutMap } from '../types';


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

interface StoredAction { action: KeyboardAction, keyup?: boolean }

export default ({ keyBindings, onKeyDown: onKeyDownProp, onKeyUp: onKeyUpProp }: {
  keyBindings: KeyBinding[],
  onKeyDown: ((a: { action: KeyboardAction }) => boolean) | ((a: { action: KeyboardAction }) => void),
  onKeyUp: ((a: { action: KeyboardAction }) => boolean) | ((a: { action: KeyboardAction }) => void),
}) => {
  const [keyboardLayoutMap, setKeyboardLayoutMap] = useState<KeyboardLayoutMap | undefined>();

  // optimization to prevent re-binding all the time:
  const onKeyDownRef = useRef<(a: StoredAction) => void>();
  useEffect(() => {
    onKeyDownRef.current = onKeyDownProp;
  }, [onKeyDownProp]);

  const onKeyUpRef = useRef<(a: StoredAction) => void>();
  useEffect(() => {
    onKeyUpRef.current = onKeyUpProp;
  }, [onKeyUpProp]);

  useEffect(() => {
    const keyBindingsByKeyCode = keyBindings.reduce((acc, kb) => {
      kb.keys.split('+').forEach((key) => {
        if (!acc[key]) acc[key] = [];
        acc[key].push(kb);
      });
      return acc;
    }, {} as Record<string, KeyBinding[]>);

    function onKeyDown(params: StoredAction) {
      if (onKeyDownRef.current == null) return true;
      return onKeyDownRef.current(params);
    }

    function onKeyUp(params: StoredAction) {
      if (onKeyUpRef.current == null) return true;
      return onKeyUpRef.current(params);
    }

    const handleKeyEvent = (e: KeyboardEvent, isKeyUp: boolean) => {
      // console.log(e)

      // Only capture key events when focus is on document body
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

      if (allModifiers.has(e.code)) {
        return; // ignore pure modifier key events
      }

      const ctrl = e.ctrlKey;
      const shift = e.shiftKey;
      const alt = e.altKey;
      const meta = e.metaKey;

      const matchingKeyBindings = (keyBindingsByKeyCode[e.code] ?? []).filter((kb) => {
        const kbKeys = new Set(kb.keys.split('+'));
        if ((controlModifiers.intersection(kbKeys).size > 0) !== ctrl) return false;
        if ((shiftModifiers.intersection(kbKeys).size > 0) !== shift) return false;
        if ((altModifiers.intersection(kbKeys).size > 0) !== alt) return false;
        if ((metaModifiers.intersection(kbKeys).size > 0) !== meta) return false;
        return true;
      });

      if (matchingKeyBindings.length === 0) {
        return;
      }
      const bubble = matchingKeyBindings.every((kb) => (
        isKeyUp ? onKeyUp({ action: kb.action }) : onKeyDown({ action: kb.action })
      ));

      console.log('handled', isKeyUp ? 'keyup' : 'keydown', e.code, { bubble });

      if (!bubble) {
        e.preventDefault();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => handleKeyEvent(e, false);
    const handleKeyUp = (e: KeyboardEvent) => handleKeyEvent(e, true);

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

  return {
    keyboardLayoutMap,
    updateKeyboardLayout,
  };
};
