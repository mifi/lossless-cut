import React, { memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTrashAlt } from 'react-icons/fa';

import { mySpring } from './animations';
import useUserSettings from './hooks/useUserSettings';


const TimelineSeg = memo(({
  duration, cutStart, cutEnd, isActive, segNum, name,
  onSegClick, invertCutSegments, segColor, formatTimecode, selected,
}) => {
  const { darkMode } = useUserSettings();

  const cutSectionWidth = `${((cutEnd - cutStart) / duration) * 100}%`;

  const startTimePos = `${(cutStart / duration) * 100}%`;

  const markerBorder = useMemo(() => {
    if (!isActive) return '2px solid transparent';
    return `2px solid ${(darkMode ? segColor.desaturate(0.6).lightness(70) : segColor.desaturate(0.9).lightness(20)).string()}`;
  }, [darkMode, isActive, segColor]);

  const backgroundColor = useMemo(() => {
    if (invertCutSegments || !selected) return darkMode ? segColor.desaturate(0.9).lightness(25).string() : segColor.desaturate(0.9).lightness(80).string();
    if (isActive) return darkMode ? segColor.desaturate(0.7).lightness(50).string() : segColor.desaturate(0.7).lightness(40).string();
    return darkMode ? segColor.desaturate(0.7).lightness(40).string() : segColor.desaturate(0.9).lightness(55).string();
  }, [darkMode, invertCutSegments, isActive, segColor, selected]);
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
    color: 'white',

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
      layout
      transition={mySpring}
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
              style={{ width: '100%', color: 'var(--gray12)' }}
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
