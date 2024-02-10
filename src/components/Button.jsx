import React, { memo } from 'react';

import styles from './Button.module.css';

const Button = memo(({ type = 'button', ...props }) => (
  // eslint-disable-next-line react/jsx-props-no-spreading, react/button-has-type
  <button className={styles.button} type={type} {...props} />
));

export default Button;
