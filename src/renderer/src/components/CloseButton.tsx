import { FaTimes } from 'react-icons/fa';
import { DetailedHTMLProps, ButtonHTMLAttributes } from 'react';

import styles from './CloseButton.module.css';
import i18n from '../i18n';


export default function CloseButton({ type = 'button', ...props }: DetailedHTMLProps<ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>) {
  return (
    // eslint-disable-next-line react/jsx-props-no-spreading, react/button-has-type
    <button type={type} className={styles['close-button']} title={i18n.t('Close')} aria-label={i18n.t('Close')} {...props}>
      <FaTimes />
    </button>
  );
}
