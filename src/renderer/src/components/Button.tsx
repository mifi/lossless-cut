import { ButtonHTMLAttributes, memo } from 'react';

import styles from './Button.module.css';

function Button({ type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    // eslint-disable-next-line react/jsx-props-no-spreading, react/button-has-type
    <button className={styles['button']} type={type} {...props} />
  );
}

export default memo(Button);
