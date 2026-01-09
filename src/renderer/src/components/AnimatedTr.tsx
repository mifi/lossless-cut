import type { HTMLMotionProps } from 'motion/react';
import { motion } from 'motion/react';

export default function AnimatedTr(props: HTMLMotionProps<'tr'>) {
  return (
    <motion.tr
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...props}
      transition={{ duration: 0.5, ease: 'easeIn' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    />
  );
}
