import { ButtonHTMLAttributes, DetailedHTMLProps, forwardRef } from 'react';

import styles from './Button.module.css';

// eslint-disable-next-line react/display-name
const Button = forwardRef<HTMLButtonElement, DetailedHTMLProps<ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>>(({ type = 'button', ...props }, ref) => (
  // eslint-disable-next-line react/jsx-props-no-spreading, react/button-has-type
  <button ref={ref} className={styles['button']} type={type} {...props} />
));

export default Button;
