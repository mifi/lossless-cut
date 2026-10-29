import type { SelectHTMLAttributes } from 'react';
import { memo } from 'react';

import styles from './Select.module.css';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

function Select(props: SelectProps) {
  return (
    <select className={styles['select']} {...props} />
  );
}

export default memo(Select);
