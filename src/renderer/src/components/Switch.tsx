import type { RefAttributes } from 'react';
import * as RadixSwitch from '@radix-ui/react-switch';

import classes from './Switch.module.css';

const Switch = (props: RadixSwitch.SwitchProps & RefAttributes<HTMLButtonElement>) => (
  <RadixSwitch.Root className={classes['SwitchRoot']} {...props}>
    <RadixSwitch.Thumb className={classes['SwitchThumb']} />
  </RadixSwitch.Root>
);

export default Switch;
