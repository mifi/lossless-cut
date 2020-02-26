import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { FaTrashAlt, FaSave } from 'react-icons/fa';

import { mySpring } from './animations';
import { saveColor } from './colors';

const InverseCutSegment = memo(({ start, end, duration, invertCutSegments }) => (
  <motion.div
    style={{
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: `${(start / duration) * 100}%`,
      width: `${((end - start) / duration) * 100}%`,
      display: 'flex',
      alignItems: 'center',
      pointerEvents: 'none',
    }}
    layoutTransition={mySpring}
  >
    <div style={{ flexGrow: 1, borderBottom: '1px dashed rgba(255, 255, 255, 0.3)', marginLeft: 5, marginRight: 5 }} />
    {invertCutSegments ? (
      <FaSave style={{ color: saveColor }} size={16} />
    ) : (
      <FaTrashAlt style={{ color: 'rgba(255, 255, 255, 0.3)' }} size={16} />
    )}
    <div style={{ flexGrow: 1, borderBottom: '1px dashed rgba(255, 255, 255, 0.3)', marginLeft: 5, marginRight: 5 }} />
  </motion.div>
));

export default InverseCutSegment;
