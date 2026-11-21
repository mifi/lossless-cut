import type { HTMLAttributes } from 'react';
import { useMemo } from 'react';

import { useAppContext } from '../contexts';
import { getKeyDisplayName } from '../util';


export default function Kbd({ code, ...props }: { code: string } & HTMLAttributes<HTMLElement>) {
  const { keyboardLayoutMap } = useAppContext();

  const keyName = useMemo(() => getKeyDisplayName(code, keyboardLayoutMap), [code, keyboardLayoutMap]);

  if (keyName == null) {
    return null;
  }

  return (
    <kbd {...props}>{keyName}</kbd>
  );
}
