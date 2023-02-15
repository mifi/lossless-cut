import React, { memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTrashAlt } from 'react-icons/fa';

import { mySpring } from './animations';


const TimelineSeg = memo(({
  duration, cutStart, cutEnd, isActive, segNum, name,
  onSegClick, invertCutSegments, segColor, formatTimecode,
}) => {
  const cutSectionWidth = `${((cutEnd - cutStart) / duration) * 100}%`;

  const startTimePos = `${(cutStart / duration) * 100}%`;

  const markerBorder = useMemo(() => `2px solid ${isActive ? segColor.lighten(0.2).string() : 'transparent'}`, [isActive, segColor]);

  const backgroundColor = useMemo(() => {
    if (invertCutSegments) return segColor.alpha(0.4).string();
    if (isActive) return segColor.alpha(0.7).string();
    return segColor.alpha(0.6).string();
  }, [invertCutSegments, isActive, segColor]);
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

  const title = [];
  if (cutEnd > cutStart) title.push(`${formatTimecode({ seconds: cutEnd - cutStart, shorten: true })}`);
  if (name) title.push(name);

  return (
    <motion.div
      style={wrapperStyle}
      layoutTransition={mySpring}
      initial={{ opacity: 0, scaleX: 0 }}
      animate={{ opacity: 1, scaleX: 1, backgroundColor }}
      exit={{ opacity: 0, scaleX: 0 }}
      role="button"
      onClick={onThisSegClick}
      title={title.join(' ')}
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
              style={{ width: '100%', color: 'rgba(255,255,255,0.8)' }}
              size={16}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {name && <div style={{ flexBasis: 4, flexShrink: 1 }} />}

      {name && <div style={{ flexShrink: 1, fontSize: 11, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap' }}>{name}</div>}

      <div style={{ flexGrow: 1 }} />
    </motion.div>
  );
});

export default TimelineSeg;
