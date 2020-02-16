import React from 'react';
import { motion } from 'framer-motion';

const { formatDuration } = require('./util');


const TimelineSeg = ({
  isCutRangeValid, duration, apparentCutStart, apparentCutEnd, isActive, segNum,
  onSegClick, color,
}) => {
  const markerWidth = 4;
  const cutSectionWidth = `${Math.max(((apparentCutEnd - apparentCutStart) / duration) * 100, 1)}%`;

  const startTimePos = `${(apparentCutStart / duration) * 100}%`;
  const markerBorder = isActive ? `2px solid ${color.lighten(0.5).string()}` : undefined;
  const backgroundColor = isActive ? color.lighten(0.5).alpha(0.5).string() : color.alpha(0.5).string();
  const markerBorderRadius = 5;

  const startMarkerStyle = {
    width: markerWidth,
    borderLeft: markerBorder,
    borderTopLeftRadius: markerBorderRadius,
    borderBottomLeftRadius: markerBorderRadius,
  };
  const endMarkerStyle = {
    width: markerWidth,
    borderRight: markerBorder,
    borderTopRightRadius: markerBorderRadius,
    borderBottomRightRadius: markerBorderRadius,
  };

  const wrapperStyle = {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: startTimePos,
    width: cutSectionWidth,
    display: 'flex',
    background: backgroundColor,
    originX: 0,
    borderRadius: markerBorderRadius,
  };

  const onThisSegClick = () => onSegClick(segNum);

  return (
    <motion.div
      style={wrapperStyle}
      layoutTransition={{ type: 'spring', damping: 30, stiffness: 1000 }}
      initial={{ opacity: 0, scaleX: 0 }}
      animate={{ opacity: 1, scaleX: 1 }}
      exit={{ opacity: 0, scaleX: 0 }}
      role="button"
      onClick={onThisSegClick}
    >
      <div style={startMarkerStyle} role="button" tabIndex="0" />

      <div
        style={{ flexGrow: 1, textAlign: 'left', fontSize: 10 }}
        title={apparentCutEnd > apparentCutStart && formatDuration({ seconds: apparentCutEnd - apparentCutStart })}
      >
        {segNum + 1}
      </div>
      {apparentCutEnd > apparentCutStart && (
        <div style={endMarkerStyle} role="button" tabIndex="0" />
      )}
    </motion.div>
  );
};

export default TimelineSeg;
