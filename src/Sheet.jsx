import React, { memo } from 'react';
import { IoIosCloseCircleOutline } from 'react-icons/io';
import { motion, AnimatePresence } from 'framer-motion';

const sheetStyle = {
  padding: '1em 2em',
  position: 'fixed',
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
  zIndex: 10,
  overflowY: 'scroll',
};

const Sheet = memo(({ visible, onClosePress, style, children }) => (
  <AnimatePresence>
    {visible && (
      <motion.div
        initial={{ scale: 0, opacity: 0.5 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        style={{ ...sheetStyle, ...style }}
      >
        <IoIosCloseCircleOutline role="button" onClick={onClosePress} size={30} style={{ position: 'fixed', right: 0, top: 0, padding: 20 }} />

        {children}
      </motion.div>
    )}
  </AnimatePresence>
));

export default Sheet;
