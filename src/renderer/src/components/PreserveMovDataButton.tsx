import { memo } from 'react';

import useUserSettings from '../hooks/useUserSettings';
import Switch from './Switch';


function PreserveMovDataButton() {
  const { preserveMovData, togglePreserveMovData } = useUserSettings();

  return (
    <Switch checked={preserveMovData} onCheckedChange={togglePreserveMovData} />
  );
}

export default memo(PreserveMovDataButton);
