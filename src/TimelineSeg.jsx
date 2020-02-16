import React from 'react';
import { motion } from 'framer-motion';

const { formatDuration } = require('./util');


const TimelineSeg = ({
  isCutRangeValid, duration: durationRaw, cutStartTime, cutEndTime, apparentCutStart,
  apparentCutEnd, isActive, segNum, onSegClick, color,
}) => {
  const duration = durationRaw || 1;
  const cutSectionWidth = `${((apparentCutEnd - apparentCutStart) / duration) * 100}%`;
  const markerWidth = 4;

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

  const onThisSegClick = () => onSegClick(segNum);

  return (
    <motion.div
      style={{ position: 'absolute', top: 0, bottom: 0, left: startTimePos, width: cutSectionWidth, display: 'flex', background: backgroundColor, originX: 0 }}
      layoutTransition={{ type: 'spring', damping: 30, stiffness: 1000 }}
      initial={{ opacity: 0, scaleX: 0 }}
      animate={{ opacity: 1, scaleX: 1 }}
      exit={{ opacity: 0, scaleX: 0 }}
      onClick={onThisSegClick}
    >
      {cutStartTime !== undefined && (
        <div style={startMarkerStyle} role="button" tabIndex="0" />
      )}
      {isCutRangeValid && (cutStartTime !== undefined || cutEndTime !== undefined) && (
        <div
          role="button"
          tabIndex="0"
          style={{ flexGrow: 1 }}
          title={`${formatDuration({ seconds: cutEndTime - cutStartTime })}`}
        />
      )}
      {cutEndTime !== undefined && (
        <div style={endMarkerStyle} role="button" tabIndex="0" />
      )}
    </motion.div>
  );
};

export default TimelineSeg;
