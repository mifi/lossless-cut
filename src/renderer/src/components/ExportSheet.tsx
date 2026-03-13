import type { CSSProperties, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';

import styles from './ExportSheet.module.css';
import CloseButton from './CloseButton';

// TODO use Dialog component instead, but we need to first remove usage of sweetalert2 inside export confirm because they don't play well together
function ExportSheet({
  visible,
  children,
  renderBottom,
  renderButton,
  onClosePress,
  title,
  width,
} : {
  visible: boolean,
  renderBottom?: (() => ReactNode | null) | undefined,
  renderButton: (() => ReactNode | null),
  children: ReactNode,
  onClosePress: () => void,
  title: string,
  width: CSSProperties['width'],
}) {
  // https://stackoverflow.com/questions/33454533/cant-scroll-to-top-of-flex-item-that-is-overflowing-container
  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            key="0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={styles['sheet']}
            onClick={(e) => {
              if (e.target === e.currentTarget) onClosePress();
            }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Keep export sheet motion snappy so opening from the bottom action bar feels immediate. */}
            <motion.div
              className={styles['box']}
              style={{ width }}
              initial={{ opacity: 0, y: 10, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.99 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <h1 className={styles['title']}>{title}</h1>

              <CloseButton type="submit" style={{ top: 0, right: 0 }} onClick={onClosePress} />

              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {visible && (
          <div key="0" className={styles['footerDock']}>
            {renderBottom != null && (
              <motion.div
                initial={{ opacity: 0, translateX: 20, translateY: 4 }}
                animate={{ opacity: 1, translateX: 0, translateY: 0 }}
                exit={{ opacity: 0, translateX: 14, translateY: 2 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                className={styles['footerPanel']}
              >
                {renderBottom?.()}
              </motion.div>
            )}

            {/* Animate the primary export action separately so it stays visually anchored in the corner. */}
            <motion.div
              style={{ transformOrigin: 'bottom right' }}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            >
              {renderButton()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

export default ExportSheet;
