import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTrashAlt } from 'react-icons/fa';

import { mySpring } from './animations';

const { formatDuration } = require('./util');


const TimelineSeg = ({
  duration, cutStart, cutEnd, isActive, segNum,
  onSegClick, color, invertCutSegments,
}) => {
  const cutSectionWidth = `${((cutEnd - cutStart) / duration) * 100}%`;

  const strongColor = color.lighten(0.5).string();
  const strongBgColor = color.lighten(0.5).alpha(0.5).string();
  const startTimePos = `${(cutStart / duration) * 100}%`;
  const markerBorder = `2px solid ${isActive ? strongColor : 'transparent'}`;
  const backgroundColor = isActive ? strongBgColor : color.alpha(0.5).string();
  const markerBorderRadius = 5;

  const wrapperStyle = {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: startTimePos,
    width: cutSectionWidth,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: backgroundColor,
    originX: 0,
    boxSizing: 'border-box',

    borderLeft: markerBorder,
    borderTopLeftRadius: markerBorderRadius,
    borderBottomLeftRadius: markerBorderRadius,

    borderRight: markerBorder,
    borderTopRightRadius: markerBorderRadius,
    borderBottomRightRadius: markerBorderRadius,
  };

  const onThisSegClick = () => onSegClick(segNum);

  return (
    <motion.div
      style={wrapperStyle}
      layoutTransition={mySpring}
      initial={{ opacity: 0, scaleX: 0 }}
      animate={{ opacity: 1, scaleX: 1 }}
      exit={{ opacity: 0, scaleX: 0 }}
      role="button"
      onClick={onThisSegClick}
      title={cutEnd > cutStart ? formatDuration({ seconds: cutEnd - cutStart }) : undefined}
    >
      <div style={{ alignSelf: 'flex-start', flexShrink: 1, fontSize: 10, minWidth: 0, overflow: 'hidden' }}>{segNum + 1}</div>

      <AnimatePresence>
        {invertCutSegments && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            style={{ width: 16, height: 16, flexShrink: 1 }}
          >
            <FaTrashAlt
              style={{ width: '100%', color: strongColor }}
              size={16}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ flexGrow: 1 }} />
    </motion.div>
  );
};

export default TimelineSeg;
