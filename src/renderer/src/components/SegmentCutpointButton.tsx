import type { CSSProperties } from 'react';
import { useMemo } from 'react';
import type { FaStepForward } from 'react-icons/fa';

import { useSegColors } from '../contexts';
import useUserSettings from '../hooks/useUserSettings';
import type { SegmentColorIndex } from '../types';
import { PlayerIconButton } from './PlayerChrome';

const SegmentCutpointButton = ({ currentCutSeg, side, Icon, onClick, title, style }: {
  currentCutSeg: SegmentColorIndex | undefined,
  side: 'start' | 'end',
  Icon: typeof FaStepForward,
  onClick?: (() => void) | undefined,
  title?: string | undefined,
  style?: CSSProperties | undefined,
}) => {
  const { darkMode } = useUserSettings();
  const { getSegColor } = useSegColors();
  const segColor = useMemo(() => getSegColor(currentCutSeg), [currentCutSeg, getSegColor]);

  const start = side === 'start';
  const borderColor = segColor.desaturate(0.45).lightness(darkMode ? 55 : 40).string();
  const backgroundColor = segColor.desaturate(0.45).lightness(darkMode ? 34 : 58).string();
  const topColor = segColor.desaturate(0.3).lightness(darkMode ? 45 : 68).string();

  return (
    <PlayerIconButton
      title={title as string}
      aria-label={title}
      style={{
        flexShrink: 0,
        color: 'white',
        minWidth: '2.45rem',
        height: '2.45rem',
        padding: start ? '0 0.75rem 0 0.6rem' : '0 0.6rem 0 0.75rem',
        borderColor,
        background: `linear-gradient(180deg, ${topColor}, ${backgroundColor})`,
        ...style,
      }}
      onClick={onClick}
    >
      <Icon size={13} />
    </PlayerIconButton>
  );
};

export default SegmentCutpointButton;
