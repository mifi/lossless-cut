import type { RefAttributes } from 'react';
import * as RadixSwitch from '@radix-ui/react-switch';

import classes from './Switch.module.css';

const Switch = (props: RadixSwitch.SwitchProps & RefAttributes<HTMLButtonElement>) => (
  // eslint-disable-next-line react/jsx-props-no-spreading
  <RadixSwitch.Root className={classes['SwitchRoot']} {...props}>
    <RadixSwitch.Thumb className={classes['SwitchThumb']} />
  </RadixSwitch.Root>
);

export default Switch;
