import { useEffect, useRef } from 'react';

// mousetrap seems to be the only lib properly handling layouts that require shift to be pressed to get a particular key #520
// Also document.addEventListener needs custom handling of modifier keys or C will be triggered by CTRL+C, etc
import Mousetrap from 'mousetrap';

import { KeyBinding, KeyboardAction } from '../../../../types';


// for all dialog actions (e.g. detectSceneChanges) we must use keyup, or we risk having the button press inserted into the dialog's input element right after the dialog opens
// todo use keyup for most events?
const keyupActions = new Set<KeyboardAction>(['seekBackwards', 'seekForwards', 'detectBlackScenes', 'detectSilentScenes', 'detectSceneChanges']);

interface StoredAction { action: KeyboardAction, keyup?: boolean }

export default ({ keyBindings, onKeyPress: onKeyPressProp }: {
  keyBindings: KeyBinding[],
  onKeyPress: ((a: { action: KeyboardAction, keyup?: boolean | undefined }) => boolean) | ((a: { action: KeyboardAction, keyup?: boolean | undefined }) => void),
}) => {
  const onKeyPressRef = useRef<(a: StoredAction) => void>();

  // optimization to prevent re-binding all the time:
  useEffect(() => {
    onKeyPressRef.current = onKeyPressProp;
  }, [onKeyPressProp]);

  useEffect(() => {
    const mousetrap = new Mousetrap();

    function onKeyPress(params: StoredAction) {
      if (onKeyPressRef.current) return onKeyPressRef.current(params);
      return true;
    }

    keyBindings.forEach(({ action, keys }) => {
      mousetrap.bind(keys, () => onKeyPress({ action }));

      if (keyupActions.has(action)) {
        mousetrap.bind(keys, () => onKeyPress({ action, keyup: true }), 'keyup');
      }
    });

    return () => mousetrap.reset();
  }, [keyBindings]);
};
