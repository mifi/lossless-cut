import { SelectHTMLAttributes, memo } from 'react';

import styles from './Select.module.css';


function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <select className={styles['select']} {...props} />
  );
}

export default memo(Select);
