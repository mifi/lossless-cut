import type { ReactNode } from 'react';
import { memo, useCallback } from 'react';
import type { MotionStyle } from 'motion/react';
import { motion, useAnimation } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { LuClipboard } from 'react-icons/lu';
import mainApi from '../mainApi';

function CopyClipboardButton({ text, style, children }: {
  text: string,
  style?: MotionStyle,
  children?: (p: { onClick: () => void }) => ReactNode,
}) {
  const { t } = useTranslation();

  const animation = useAnimation();

  const onClick = useCallback(() => {
    mainApi.writeClipboardText(text);
    animation.start({
      scale: [1, 1.5, 1],
      transition: { duration: 0.2 },
    });
  }, [animation, text]);

  return (
    <motion.span animate={animation} style={{ display: 'inline-block', cursor: 'pointer', ...style }}>
      {children != null ? children({ onClick }) : <LuClipboard title={t('Copy to clipboard')} onClick={onClick} />}
    </motion.span>
  );
}

export default memo(CopyClipboardButton);
