import React from 'react';
import { FaHandPointUp } from 'react-icons/fa';

import SegmentCutpointButton from './SegmentCutpointButton';
import { mirrorTransform } from '../util';

// constant side because we are mirroring
const SetCutpointButton = ({ currentCutSeg, side, title, onClick, style }) => (
  <SegmentCutpointButton currentCutSeg={currentCutSeg} side="end" Icon={FaHandPointUp} onClick={onClick} title={title} style={{ transform: side === 'start' ? mirrorTransform : undefined, ...style }} />
);

export default SetCutpointButton;
