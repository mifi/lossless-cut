import { memo } from 'react';
import { motion } from 'framer-motion';
import { FaTrashAlt, FaSave } from 'react-icons/fa';

import { mySpring } from './animations';
import { saveColor } from './colors';

const BetweenSegments = memo(({ start, end, duration, invertCutSegments }: { start: number, end: number, duration: number, invertCutSegments: boolean }) => {
  const left = `${(start / duration) * 100}%`;

  return (
    <motion.div
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        pointerEvents: 'none',
      }}
      initial={{
        left,
        width: '0%',
      }}
      animate={{
        left,
        width: `${((end - start) / duration) * 100}%`,
      }}
      layout
      transition={mySpring}
    >
      <div style={{ flexGrow: 1, borderBottom: '1px dashed var(--gray10)', marginLeft: 5, marginRight: 5 }} />
      {invertCutSegments ? (
        <FaSave style={{ color: saveColor }} size={16} />
      ) : (
        <FaTrashAlt style={{ color: 'var(--gray10)' }} size={16} />
      )}
      <div style={{ flexGrow: 1, borderBottom: '1px dashed var(--gray10)', marginLeft: 5, marginRight: 5 }} />
    </motion.div>
  );
});

export default BetweenSegments;
