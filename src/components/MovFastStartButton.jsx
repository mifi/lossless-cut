import React, { memo } from 'react';

import { withBlur } from '../util';
import useUserSettings from '../hooks/useUserSettings';
import Switch from './Switch';


const MovFastStartButton = memo(() => {
  const { movFastStart, toggleMovFastStart } = useUserSettings();

  return (
    <Switch checked={movFastStart} onCheckedChange={withBlur(toggleMovFastStart)} />
  );
});

export default MovFastStartButton;
