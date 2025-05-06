import { CSSProperties, ReactNode, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import styles from './Sheet.module.css';
import CloseButton from './CloseButton';


function Sheet({ visible, onClosePress, children, maxWidth = 800, style }: {
  visible: boolean,
  onClosePress: () => void,
  children: ReactNode,
  maxWidth?: number | string,
  style?: CSSProperties,
}) {
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

            <CloseButton style={{ top: 0, right: 0 }} onClick={onClosePress} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default memo(Sheet);
