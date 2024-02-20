import { useEffect, useRef } from 'react';

// mousetrap seems to be the only lib properly handling layouts that require shift to be pressed to get a particular key #520
// Also document.addEventListener needs custom handling of modifier keys or C will be triggered by CTRL+C, etc
import Mousetrap from 'mousetrap';

const keyupActions = new Set(['seekBackwards', 'seekForwards']);

export default ({ keyBindings, onKeyPress: onKeyPressProp }) => {
  const onKeyPressRef = useRef();

  // optimization to prevent re-binding all the time:
  useEffect(() => {
    onKeyPressRef.current = onKeyPressProp;
  }, [onKeyPressProp]);

  useEffect(() => {
    const mousetrap = new Mousetrap();

    function onKeyPress(...args) {
      if (onKeyPressRef.current) return onKeyPressRef.current(...args);
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
