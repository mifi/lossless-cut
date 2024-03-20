import { memo, useMemo } from 'react';
import { motion, AnimatePresence, MotionStyle } from 'framer-motion';
import { FaTrashAlt } from 'react-icons/fa';

import { mySpring } from './animations';
import useUserSettings from './hooks/useUserSettings';
import { useSegColors } from './contexts';
import { ApparentCutSegment, FormatTimecode } from './types';


const TimelineSeg = memo(({
  seg, duration, isActive, segNum, onSegClick, invertCutSegments, formatTimecode, selected,
} : {
  seg: ApparentCutSegment, duration: number, isActive: boolean, segNum: number, onSegClick: (a: number) => void, invertCutSegments: boolean, formatTimecode: FormatTimecode, selected: boolean,
}) => {
  const { darkMode } = useUserSettings();
  const { getSegColor } = useSegColors();

  const segColor = useMemo(() => getSegColor(seg), [getSegColor, seg]);

  const { name, start: cutStart, end: cutEnd } = seg;

  const cutSectionWidth = `${((cutEnd - cutStart) / duration) * 100}%`;

  const startTimePos = `${(cutStart / duration) * 100}%`;

  const markerBorder = useMemo(() => {
    if (!isActive) return '2px solid transparent';
    return `1.5px solid ${darkMode ? segColor.desaturate(0.1).lightness(70).string() : segColor.desaturate(0.2).lightness(40).string()}`;
  }, [darkMode, isActive, segColor]);

  const backgroundColor = useMemo(() => {
    // we use both transparency and lightness, so that segments can be visible when overlapping
    if (invertCutSegments || !selected) return darkMode ? segColor.desaturate(0.3).lightness(30).alpha(0.5).string() : segColor.desaturate(0.3).lightness(70).alpha(0.5).string();
    if (isActive) return darkMode ? segColor.saturate(0.2).lightness(60).alpha(0.7).string() : segColor.saturate(0.2).lightness(40).alpha(0.8).string();
    return darkMode ? segColor.desaturate(0.2).lightness(50).alpha(0.7).string() : segColor.lightness(35).alpha(0.6).string();
  }, [darkMode, invertCutSegments, isActive, segColor, selected]);
  const markerBorderRadius = 5;

  const wrapperStyle: MotionStyle = {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: startTimePos,
    width: cutSectionWidth,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    originX: 0,
    boxSizing: 'border-box',
    color: 'white',
    overflow: 'hidden',

    borderLeft: markerBorder,
    borderTopLeftRadius: markerBorderRadius,
    borderBottomLeftRadius: markerBorderRadius,

    borderRight: markerBorder,
    borderTopRightRadius: markerBorderRadius,
    borderBottomRightRadius: markerBorderRadius,
  };

  const onThisSegClick = () => onSegClick(segNum);

  const title: string[] = [];
  if (cutEnd > cutStart) title.push(`${formatTimecode({ seconds: cutEnd - cutStart, shorten: true })}`);
  if (name) title.push(name);

  return (
    <motion.div
      style={wrapperStyle}
      layout
      transition={mySpring}
      initial={{ opacity: 0, scaleX: 0 }}
      animate={{ opacity: 1, scaleX: 1, backgroundColor }}
      exit={{ opacity: 0, scaleX: 0 }}
      role="button"
      onClick={onThisSegClick}
      title={title.join(' ')}
    >
      <div style={{ alignSelf: 'flex-start', flexShrink: 0, fontSize: 10, minWidth: 0, letterSpacing: '-.1em' }}>{segNum + 1}</div>

      <AnimatePresence>
        {invertCutSegments && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            style={{ width: 16, height: 16, flexShrink: 1 }}
          >
            <FaTrashAlt
              style={{ width: '100%', color: 'var(--gray12)' }}
              size={16}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {name && <div style={{ flexBasis: 4, flexShrink: 1 }} />}

      {name && <div style={{ flexShrink: 1, fontSize: 11, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap' }}>{name}</div>}

      <div style={{ flexGrow: 1 }} />
    </motion.div>
  );
});

export default TimelineSeg;
