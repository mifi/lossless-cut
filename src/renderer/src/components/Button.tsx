import type { ButtonHTMLAttributes, DetailedHTMLProps } from 'react';
import { forwardRef } from 'react';

import styles from './Button.module.css';

export type ButtonProps = DetailedHTMLProps<ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>;

// eslint-disable-next-line react/display-name
const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ type = 'button', className, ...props }, ref) => (
  // eslint-disable-next-line react/jsx-props-no-spreading, react/button-has-type
  <button ref={ref} className={[...(className ? [className] : []), styles['button']].join(' ')} type={type} {...props} />
));

export default Button;

// eslint-disable-next-line react/display-name
export const DialogButton = forwardRef<HTMLButtonElement, { primary?: boolean } & ButtonProps>(({ primary, ...props }, ref) => (
  // eslint-disable-next-line react/jsx-props-no-spreading
  <Button ref={ref} style={{ padding: '.55em 1.8em', borderRadius: 'var(--llc-radius-pill)', ...(primary && { color: 'white', fontWeight: 600, background: 'var(--llc-accent-gradient)', borderColor: 'transparent', boxShadow: 'var(--llc-accent-glow)' }) }} {...props} />
));
