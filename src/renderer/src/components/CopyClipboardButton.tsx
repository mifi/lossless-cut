import { memo, ReactNode, useCallback } from 'react';
import { FaClipboard } from 'react-icons/fa';
import { MotionStyle, motion, useAnimation } from 'framer-motion';
import i18n from '../i18n';

const electron = window.require('electron');
const { clipboard } = electron;

function CopyClipboardButton({ text, style, children = ({ onClick }) => <FaClipboard title={i18n.t('Copy to clipboard')} onClick={onClick} /> }: {
  text: string,
  style?: MotionStyle,
  children?: (p: { onClick: () => void }) => ReactNode,
}) {
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
      {children({ onClick })}
    </motion.span>
  );
}

export default memo(CopyClipboardButton);
