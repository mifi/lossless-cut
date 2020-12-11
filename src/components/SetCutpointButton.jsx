import React from 'react';

import { getSegColors } from '../util';

const SetCutpointButton = ({ currentCutSeg, side, Icon, onClick, title, style }) => {
  const {
    segActiveBgColor: currentSegActiveBgColor,
    segBorderColor: currentSegBorderColor,
  } = getSegColors(currentCutSeg);

  const start = side === 'start';
  const border = `4px solid ${currentSegBorderColor}`;

  return (
    <Icon
      size={13}
      title={title}
      role="button"
      style={{ color: 'white', padding: start ? '4px 4px 4px 2px' : '4px 2px 4px 4px', borderLeft: start && border, borderRight: !start && border, background: currentSegActiveBgColor, borderRadius: 6, ...style }}
      onClick={onClick}
    />
  );
};

export default SetCutpointButton;
