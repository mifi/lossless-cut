import { CSSProperties, ReactNode, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FaTimes } from 'react-icons/fa';

import styles from './Sheet.module.css';


function Sheet({ visible, onClosePress, children, maxWidth = 800, style }: {
  visible: boolean,
  onClosePress: () => void,
  children: ReactNode,
  maxWidth?: number | string,
  style?: CSSProperties,
}) {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ scale: 0, opacity: 0.5 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          className={styles['sheet']}
        >
          <div style={{ margin: 'auto', maxWidth, height: '100%', position: 'relative' }}>
            <div style={{ overflowY: 'scroll', height: '100%', ...style }}>
              {children}
            </div>

            <FaTimes role="button" className={styles['close']} onClick={onClosePress} title={t('Close')} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default memo(Sheet);
