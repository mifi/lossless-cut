import type { SelectHTMLAttributes } from 'react';
import { memo } from 'react';

import styles from './Select.module.css';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

function Select(props: SelectProps) {
  return (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <select className={styles['select']} {...props} />
  );
}

export default memo(Select);
