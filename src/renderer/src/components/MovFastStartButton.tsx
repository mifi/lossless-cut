import { memo } from 'react';

import useUserSettings from '../hooks/useUserSettings';
import Switch from './Switch';


function MovFastStartButton() {
  const { movFastStart, toggleMovFastStart } = useUserSettings();

  return (
    <Switch checked={movFastStart} onCheckedChange={toggleMovFastStart} />
  );
}

export default memo(MovFastStartButton);
