import { memo } from 'react';

import { withBlur } from '../util';
import useUserSettings from '../hooks/useUserSettings';
import Switch from './Switch';


function PreserveMovDataButton() {
  const { preserveMovData, togglePreserveMovData } = useUserSettings();

  return (
    <Switch checked={preserveMovData} onCheckedChange={withBlur(togglePreserveMovData)} />
  );
}

export default memo(PreserveMovDataButton);
