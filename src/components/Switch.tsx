import { CSSProperties } from 'react';
import * as RadixSwitch from '@radix-ui/react-switch';

import classes from './Switch.module.css';

const Switch = ({ checked, disabled, onCheckedChange, title, style }: {
  checked: boolean, disabled?: boolean, onCheckedChange: (v: boolean) => void, title?: string, style?: CSSProperties,
}) => (
  <RadixSwitch.Root disabled={disabled} className={classes.SwitchRoot} checked={checked} onCheckedChange={onCheckedChange} style={style} title={title}>
    <RadixSwitch.Thumb className={classes.SwitchThumb} />
  </RadixSwitch.Root>
);

export default Switch;
