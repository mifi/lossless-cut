import { SelectHTMLAttributes, memo } from 'react';

import styles from './Select.module.css';

const Select = memo((props: SelectHTMLAttributes<HTMLSelectElement>) => (
  // eslint-disable-next-line react/jsx-props-no-spreading
  <select className={styles['select']} {...props} />
));

export default Select;
