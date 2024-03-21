import { CSSProperties, ReactNode, memo } from 'react';
import { IoIosCloseCircleOutline } from 'react-icons/io';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import styles from './Sheet.module.css';

const Sheet = memo(({ visible, onClosePress, children, maxWidth = 800, style }: {
  visible: boolean, onClosePress: () => void, children: ReactNode, maxWidth?: number, style?: CSSProperties
}) => {
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

            <IoIosCloseCircleOutline role="button" onClick={onClosePress} title={t('Close')} size={30} style={{ position: 'absolute', padding: '1em', right: 0, top: 0, cursor: 'pointer' }} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export default Sheet;
