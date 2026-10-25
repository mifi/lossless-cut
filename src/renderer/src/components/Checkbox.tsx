import { useId } from 'react';
import type { CheckboxProps } from '@radix-ui/react-checkbox';
import { Root, Indicator } from '@radix-ui/react-checkbox';
import { LuCheck } from 'react-icons/lu';

import classes from './Checkbox.module.css';


export default function Checkbox({ label, disabled, style, ...props }: CheckboxProps & { label?: string | undefined }) {
  const id = useId();
  return (
    <div style={{ display: 'flex', alignItems: 'center', ...style }}>
      {/* eslint-disable-next-line react/jsx-props-no-spreading */}
      <Root className={classes['CheckboxRoot']} disabled={disabled} {...props} id={id}>
        <Indicator className={classes['CheckboxIndicator']}>
          <LuCheck strokeWidth={3.5} style={{ fontSize: '.72em' }} />
        </Indicator>
      </Root>

      {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
      <label className={classes['Label']} htmlFor={id} style={{ opacity: disabled ? 0.5 : undefined }}>
        {label}
      </label>
    </div>
  );
}
