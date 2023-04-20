import React, { useMemo } from 'react';

import { useSegColors } from '../contexts';
import useUserSettings from '../hooks/useUserSettings';

const SegmentCutpointButton = ({ currentCutSeg, side, Icon, onClick, title, style }) => {
  const { darkMode } = useUserSettings();
  const { getSegColor } = useSegColors();
  const segColor = useMemo(() => getSegColor(currentCutSeg), [currentCutSeg, getSegColor]);

  const start = side === 'start';
  const border = `3px solid ${segColor.desaturate(0.6).lightness(darkMode ? 45 : 35).string()}`;
  const backgroundColor = segColor.desaturate(0.6).lightness(darkMode ? 35 : 55).string();

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
