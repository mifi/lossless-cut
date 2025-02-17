import { memo, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, MotionStyle } from 'framer-motion';
import { FaTrashAlt } from 'react-icons/fa';
import Color from 'color';

import { mySpring } from './animations';
import useUserSettings from './hooks/useUserSettings';
import { useSegColors } from './contexts';
import { FormatTimecode, StateSegment } from './types';


function Marker({
  seg, segNum, color, isActive, selected, onClick, getTimePercent, formatTimecode,
}: {
  seg: StateSegment,
  segNum: number,
  color: Color,
  isActive: boolean,
  selected: boolean,
  onClick: () => void,
  getTimePercent: (a: number) => string,
  formatTimecode: FormatTimecode,
}) {
  const { darkMode } = useUserSettings();

  const pinColor = darkMode ? color.saturate(0.2).lightness(40).string() : color.desaturate(0.2).lightness(50).string();

  const title = [];
  title.push(formatTimecode({ seconds: seg.start, shorten: true }));
  if (seg.name) title.push(seg.name);

  const borderColor = useMemo(() => {
    if (isActive) {
      if (darkMode) return 'rgba(255,255,255,0.5)';
      return 'rgba(0,0,0,0.5)';
    }
    return 'rgba(0,0,0,0)';
  }, [darkMode, isActive]);

  return (
    <motion.div
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: getTimePercent(seg.start),
        width: 2,
        marginLeft: -1,
        overflow: 'visible',
        backgroundColor: 'var(--gray12)',
      }}
      layout
      transition={mySpring}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: selected ? 1 : 0.5, scale: 1 }}
      exit={{ opacity: 0, scale: 0 }}
      title={title.join(' ')}
    >
      <div style={{ borderRadius: '50%', backgroundColor: pinColor, width: 14, height: 14, marginLeft: -7, flexShrink: 0, textAlign: 'center', border: `1px solid ${borderColor}` }}>
        <div
          style={{ fontSize: 10, minWidth: 0, letterSpacing: '-.1em', color: 'white' }}
          role="button"
          onClick={() => onClick()}
        >
          {segNum + 1}
        </div>
      </div>
    </motion.div>
  );
}

function TimelineSeg({
  seg, duration, isActive, segNum, onSegClick, invertCutSegments, formatTimecode, selected,
} : {
  seg: StateSegment,
  duration: number,
  isActive: boolean,
  segNum: number,
  onSegClick: (a: number) => void,
  invertCutSegments: boolean,
  formatTimecode: FormatTimecode,
  selected: boolean,
}) {
  const { darkMode } = useUserSettings();
  const { getSegColor } = useSegColors();

  const segColor = useMemo(() => getSegColor(seg), [getSegColor, seg]);

  const { name } = seg;

  const getTimePercent = (t: number) => `${(t / duration) * 100}%`;

  const vertBorder = useMemo(() => {
    if (!isActive) return '2px solid transparent';
    return `1.5px solid ${darkMode ? segColor.desaturate(0.1).lightness(70).string() : segColor.desaturate(0.2).lightness(40).string()}`;
  }, [darkMode, isActive, segColor]);

  const backgroundColor = useMemo(() => {
    // we use both transparency and lightness, so that segments can be visible when overlapping
    if (invertCutSegments || !selected) return darkMode ? segColor.desaturate(0.3).lightness(30).alpha(0.5).string() : segColor.desaturate(0.3).lightness(70).alpha(0.5).string();
    if (isActive) return darkMode ? segColor.saturate(0.2).lightness(60).alpha(0.7).string() : segColor.saturate(0.2).lightness(40).alpha(0.8).string();
    return darkMode ? segColor.desaturate(0.2).lightness(50).alpha(0.7).string() : segColor.lightness(35).alpha(0.6).string();
  }, [darkMode, invertCutSegments, isActive, segColor, selected]);

  const vertBorderRadius = 5;

  const onThisSegClick = useCallback(() => onSegClick(segNum), [onSegClick, segNum]);

  if (seg.end == null) {
    if (invertCutSegments) return null;

    return (
      <Marker seg={seg} segNum={segNum} color={segColor} selected={selected} isActive={isActive} onClick={onThisSegClick} getTimePercent={getTimePercent} formatTimecode={formatTimecode} />
    );
  }

  const cutSectionWidth = `${((seg.end - seg.start) / duration) * 100}%`;

  const wrapperStyle: MotionStyle = {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: getTimePercent(seg.start),
    width: cutSectionWidth,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    originX: 0,
    boxSizing: 'border-box',
    color: 'white',
    overflow: 'hidden',

    borderLeft: vertBorder,
    borderTopLeftRadius: vertBorderRadius,
    borderBottomLeftRadius: vertBorderRadius,

    borderRight: vertBorder,
    borderTopRightRadius: vertBorderRadius,
    borderBottomRightRadius: vertBorderRadius,
  };

  const title: string[] = [];
  title.push(formatTimecode({ seconds: seg.start, shorten: true }));
  if (seg.end != null) title.push(`- ${formatTimecode({ seconds: seg.end, shorten: true })}`);
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
}

export default memo(TimelineSeg);
