import type { HTMLAttributes } from 'react';
import { useMemo } from 'react';

import { useAppContext } from '../contexts';
import { getMetaKeyName } from '../util';


export default function Kbd({ code, ...props }: { code: string } & HTMLAttributes<HTMLElement>) {
  const { keyboardLayoutMap } = useAppContext();

  const keyName = useMemo(() => {
    const map: Record<string, string> = {
      Escape: 'Esc',
      Digit1: '1',
      Digit2: '2',
      Digit3: '3',
      Digit4: '4',
      Digit5: '5',
      Digit6: '6',
      Digit7: '7',
      Digit8: '8',
      Digit9: '9',
      Digit0: '0',
      KeyQ: 'Q',
      KeyW: 'W',
      KeyE: 'E',
      KeyR: 'R',
      KeyT: 'T',
      KeyY: 'Y',
      KeyU: 'U',
      KeyI: 'I',
      KeyO: 'O',
      KeyP: 'P',
      KeyA: 'A',
      KeyS: 'S',
      KeyD: 'D',
      KeyF: 'F',
      KeyG: 'G',
      KeyH: 'H',
      KeyJ: 'J',
      KeyK: 'K',
      KeyL: 'L',
      KeyZ: 'Z',
      KeyX: 'X',
      KeyC: 'C',
      KeyV: 'V',
      KeyB: 'B',
      KeyN: 'N',
      KeyM: 'M',
      Minus: '-',
      Equal: '=',
      BracketLeft: '[',
      BracketRight: ']',
      Semicolon: ';',
      Quote: '\'',
      Backquote: '`',
      Backslash: '\\',
      Comma: ',',
      Period: '.',
      Slash: '/',
      F1: 'F1',
      F2: 'F2',
      F3: 'F3',
      F4: 'F4',
      F5: 'F5',
      F6: 'F6',
      F7: 'F7',
      F8: 'F8',
      F9: 'F9',
      F10: 'F10',
      F11: 'F11',
      F12: 'F12',
      F13: 'F13',
      F14: 'F14',
      F15: 'F15',
      F16: 'F16',
      F17: 'F17',
      F18: 'F18',
      F19: 'F19',
      F20: 'F20',
      F21: 'F21',
      F22: 'F22',
      F23: 'F23',
      F24: 'F24',
      NumpadParenLeft: '(',
      NumpadParenRight: ')',
      PageUp: 'PgUp',
      PageDown: 'PgDn',
      ArrowUp: '↑',
      ArrowLeft: '←',
      ArrowRight: '→',
      ArrowDown: '↓',

      ControlLeft: 'Ctrl',
      ControlRight: 'Ctrl',
      ShiftLeft: 'Shift',
      ShiftRight: 'Shift',
      AltLeft: 'Alt',
      AltRight: 'Alt',
      MetaLeft: getMetaKeyName(),
      MetaRight: getMetaKeyName(),
    };

    if (keyboardLayoutMap == null) {
      return undefined;
    }

    return keyboardLayoutMap.get(code) ?? map[code] ?? code;
  }, [code, keyboardLayoutMap]);

  if (keyName == null) { // not yet loaded keyboard map
    return null;
  }

  return (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <kbd {...props}>{keyName}</kbd>
  );
}
