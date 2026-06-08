import { useCallback, useMemo } from 'react';

import { useAppContext } from '../contexts';
import useUserSettings from './useUserSettings';
import { formatKeybinding } from '../util';
import type { KeyboardAction } from '../../../common/types';


export default function useActionTitle() {
  const { keyboardLayoutMap } = useAppContext();
  const { keyBindings } = useUserSettings();

  const keyBindingByAction = useMemo(
    () => Object.fromEntries(keyBindings.map((binding) => [binding.action, binding])),
    [keyBindings],
  );

  const actionTitle = useCallback((title: string, action: KeyboardAction): string => {
    const binding = keyBindingByAction[action];
    if (binding == null) return title;
    const formatted = formatKeybinding(binding.keys, keyboardLayoutMap);
    if (formatted == null) return title;
    return `${title} (${formatted})`;
  }, [keyBindingByAction, keyboardLayoutMap]);

  return actionTitle;
}
