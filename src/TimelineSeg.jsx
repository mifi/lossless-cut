import React from 'react';
import { motion } from 'framer-motion';

const { formatDuration } = require('./util');


const TimelineSeg = ({
  isCutRangeValid, duration: durationRaw, cutStartTime, cutEndTime, apparentCutStart,
  apparentCutEnd, isActive, segNum, onSegClick, color,
}) => {
  const markerWidth = 4;
  const duration = durationRaw || 1;
  const cutSectionWidth = `calc(${((apparentCutEnd - apparentCutStart) / duration) * 100}% - ${markerWidth * 2}px)`;

  const startTimePos = `${(apparentCutStart / duration) * 100}%`;
  const endTimePos = `${(apparentCutEnd / duration) * 100}%`;
  const markerBorder = isActive ? `2px solid ${color.lighten(0.5).string()}` : undefined;
  const markerBorderRadius = 5;

  const startMarkerStyle = {
    background: color.alpha(0.5).string(),
    width: markerWidth,
    left: startTimePos,
    borderLeft: markerBorder,
    borderTopLeftRadius: markerBorderRadius,
    borderBottomLeftRadius: markerBorderRadius,
  };
  const endMarkerStyle = {
    background: color.alpha(0.5).string(),
    width: markerWidth,
    marginLeft: -markerWidth,
    left: endTimePos,
    borderRight: markerBorder,
    borderTopRightRadius: markerBorderRadius,
    borderBottomRightRadius: markerBorderRadius,
  };
  const cutSectionStyle = {
    background: color.alpha(0.5).string(),
    marginLeft: markerWidth,
    left: startTimePos,
    width: cutSectionWidth,
  };

  const onThisSegClick = () => onSegClick(segNum);

  return (
    // eslint-disable-next-line react/jsx-fragments
    <div>
      {cutStartTime !== undefined && (
        <div style={startMarkerStyle} className="cut-time-marker" role="button" tabIndex="0" onClick={onThisSegClick} />
      )}
      {isCutRangeValid && (cutStartTime !== undefined || cutEndTime !== undefined) && (
        <motion.div
          layoutTransition
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}

          className="cut-section"
          style={cutSectionStyle}
          role="button"
          tabIndex="0"
          onClick={onThisSegClick}
          title={`${formatDuration({ seconds: cutEndTime - cutStartTime })}`}
        />
      )}
      {cutEndTime !== undefined && (
        <div style={endMarkerStyle} className="cut-time-marker" role="button" tabIndex="0" onClick={onThisSegClick} />
      )}
    </div>
  );
};

export default TimelineSeg;
