import { CSSProperties } from 'react';
import { FaHandPointUp } from 'react-icons/fa';

import SegmentCutpointButton from './SegmentCutpointButton';
import { mirrorTransform } from '../util';
import { SegmentBase, SegmentColorIndex } from '../types';

// constant side because we are mirroring
const SetCutpointButton = ({ currentCutSeg, side, title, onClick, style }: {
  currentCutSeg: (SegmentBase & SegmentColorIndex) | undefined,
  side: 'start' | 'end',
  title?: string,
  onClick?: () => void,
  style?: CSSProperties,
}) => (
  <SegmentCutpointButton currentCutSeg={currentCutSeg} side="end" Icon={FaHandPointUp} onClick={onClick} title={title} style={{ transform: side === 'start' ? mirrorTransform : undefined, ...style }} />
);

export default SetCutpointButton;
