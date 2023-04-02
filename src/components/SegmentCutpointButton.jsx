import React from 'react';

import { getSegColor } from '../util/colors';
import useUserSettings from '../hooks/useUserSettings';

const SegmentCutpointButton = ({ currentCutSeg, side, Icon, onClick, title, style }) => {
  const { darkMode } = useUserSettings();
  const segColor = getSegColor(currentCutSeg);

  const start = side === 'start';
  const border = `3px solid ${segColor.desaturate(0.9).lightness(darkMode ? 45 : 35).string()}`;
  const backgroundColor = segColor.desaturate(0.9).lightness(darkMode ? 35 : 55).string();

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
