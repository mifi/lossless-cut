import { CSSProperties, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import styles from './ExportDialog.module.css';
import CloseButton from './CloseButton';

function ExportDialog({
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
  renderButton?: (() => ReactNode | null) | undefined,
  children: ReactNode,
  onClosePress: () => void,
  title: string,
  width: CSSProperties['width'],
}) {
  // https://stackoverflow.com/questions/33454533/cant-scroll-to-top-of-flex-item-that-is-overflowing-container
  return (
    <AnimatePresence>
      {visible && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={styles['sheet']}
            transition={{ duration: 0.3, easings: ['easeOut'] }}
          >
            <div className={styles['box']} style={{ width }}>
              <h1 style={{ textTransform: 'uppercase', fontSize: '1.4em', marginTop: 0, marginBottom: '.5em' }}>{title}</h1>

              <CloseButton type="submit" style={{ top: 0, right: 0 }} onClick={onClosePress} />

              {children}
            </div>
          </motion.div>

          <div style={{ position: 'fixed', right: 0, bottom: 0, display: 'flex', alignItems: 'center', margin: 5 }}>
            <motion.div
              initial={{ opacity: 0, translateX: 50 }}
              animate={{ opacity: 1, translateX: 0 }}
              exit={{ opacity: 0, translateX: 50 }}
              transition={{ duration: 0.4, easings: ['easeOut'] }}
              style={{ display: 'flex', alignItems: 'flex-end', background: 'var(--gray-2)', borderRadius: '.5em', padding: '.3em' }}
            >
              {renderBottom?.()}
            </motion.div>

            <motion.div
              style={{ transformOrigin: 'bottom right' }}
              initial={{ scale: 0.7, opacity: 1 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ duration: 0.4, easings: ['easeOut'] }}
            >
              {renderButton?.()}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

export default ExportDialog;
