import React from 'react';
import * as RadixSwitch from '@radix-ui/react-switch';

import classes from './Switch.module.css';

const Switch = ({ checked, disabled, onCheckedChange }) => (
  <RadixSwitch.Root disabled={disabled} className={classes.SwitchRoot} checked={checked} onCheckedChange={onCheckedChange}>
    <RadixSwitch.Thumb className={classes.SwitchThumb} />
  </RadixSwitch.Root>
);

export default Switch;
