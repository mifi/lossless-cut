import React from 'react';

import { getSegColor } from '../util/colors';

const SegmentCutpointButton = ({ currentCutSeg, side, Icon, onClick, title, style }) => {
  const segColor = getSegColor(currentCutSeg);

  const start = side === 'start';
  const border = `4px solid ${segColor.lighten(0.1).string()}`;
  const backgroundColor = segColor.alpha(0.5).string();

  return (
    <Icon
      size={13}
      title={title}
      role="button"
      style={{ flexShrink: 0, color: 'white', padding: start ? '4px 4px 4px 2px' : '4px 2px 4px 4px', borderLeft: start && border, borderRight: !start && border, background: backgroundColor, borderRadius: 6, ...style }}
      onClick={onClick}
    />
  );
};

export default SegmentCutpointButton;
