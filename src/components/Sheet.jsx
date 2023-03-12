import React, { memo } from 'react';
import { IoIosCloseCircleOutline } from 'react-icons/io';
import { motion, AnimatePresence } from 'framer-motion';

import styles from './Sheet.module.css';

const Sheet = memo(({ visible, onClosePress, style, children }) => (
  <AnimatePresence>
    {visible && (
      <motion.div
        initial={{ scale: 0, opacity: 0.5 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        style={style}
        className={styles.sheet}
      >
        <IoIosCloseCircleOutline role="button" onClick={onClosePress} size={30} style={{ position: 'fixed', right: 0, top: 0, padding: 20, zIndex: 1, cursor: 'pointer' }} />

        <div style={{ overflowY: 'scroll', height: '100%' }}>
          {children}
        </div>
      </motion.div>
    )}
  </AnimatePresence>
));

export default Sheet;
