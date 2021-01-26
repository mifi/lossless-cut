import React, { memo, useCallback } from 'react';
import { FaClipboard } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import { motion, useAnimation } from 'framer-motion';

const electron = window.require('electron');
const { clipboard } = electron;

const CopyClipboardButton = memo(({ text, style }) => {
  const { t } = useTranslation();

  const animation = useAnimation();

  const onClick = useCallback(() => {
    clipboard.writeText(text);
    animation.start({
      scale: [1, 2, 1],
      transition: { duration: 0.3 },
    });
  }, [animation, text]);

  return (
    <motion.span animate={animation} style={{ display: 'inline-block', cursor: 'pointer', ...style }}>
      <FaClipboard title={t('Copy to clipboard')} onClick={onClick} />
    </motion.span>

  );
});

export default CopyClipboardButton;
