import { FaTimes } from 'react-icons/fa';
import type { DetailedHTMLProps, ButtonHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './CloseButton.module.css';


export default function CloseButton({ type = 'button', ...props }: DetailedHTMLProps<ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>) {
  const { t } = useTranslation();

  return (
    // eslint-disable-next-line react/jsx-props-no-spreading, react/button-has-type
    <button type={type} className={styles['close-button']} title={t('Close')} aria-label={t('Close')} {...props}>
      <FaTimes />
    </button>
  );
}
