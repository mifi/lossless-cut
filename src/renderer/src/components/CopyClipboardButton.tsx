import type { ReactNode } from 'react';
import { memo, useCallback } from 'react';
import { FaClipboard } from 'react-icons/fa';
import type { MotionStyle } from 'motion/react';
import { motion, useAnimation } from 'motion/react';
import { useTranslation } from 'react-i18next';

const electron = window.require('electron');
const { clipboard } = electron;

function CopyClipboardButton({ text, style, children }: {
  text: string,
  style?: MotionStyle,
  children?: (p: { onClick: () => void }) => ReactNode,
}) {
  const { t } = useTranslation();

  const animation = useAnimation();

  const onClick = useCallback(() => {
    clipboard.writeText(text);
    animation.start({
      scale: [1, 1.5, 1],
      transition: { duration: 0.2 },
    });
  }, [animation, text]);

  return (
    <motion.span animate={animation} style={{ display: 'inline-block', cursor: 'pointer', ...style }}>
      {children != null ? children({ onClick }) : <FaClipboard title={t('Copy to clipboard')} onClick={onClick} />}
    </motion.span>
  );
}

export default memo(CopyClipboardButton);
