import { memo, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, MotionStyle } from 'framer-motion';
import { FaTrashAlt } from 'react-icons/fa';
import Color from 'color';

import { mySpring } from './animations';
import useUserSettings from './hooks/useUserSettings';
import { useSegColors } from './contexts';
import { FormatTimecode, StateSegment } from './types';


const markerButtonStyle: React.CSSProperties = { fontSize: 10, minWidth: 0, letterSpacing: '-.1em', color: 'white' };

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

  const title = useMemo(() => {
    const parts = [formatTimecode({ seconds: seg.start, shorten: true })];
    if (seg.name) parts.push(seg.name);
    return parts.join(' ');
  }, [formatTimecode, seg.start, seg.name]);

  const style = useMemo<MotionStyle>(() => ({
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: getTimePercent(seg.start),
    width: 2,
    marginLeft: -1,
    overflow: 'visible',
    backgroundColor: 'var(--gray-12)',
  }), [getTimePercent, seg.start]);

  const borderColor = useMemo(() => {
    if (isActive) {
      if (darkMode) return 'rgba(255,255,255,0.5)';
      return 'rgba(0,0,0,0.5)';
    }
    return 'rgba(0,0,0,0)';
  }, [darkMode, isActive]);

  const segNumStyle = useMemo<React.CSSProperties>(() => ({
    borderRadius: '50%', backgroundColor: pinColor, width: 14, height: 14, marginLeft: -7, flexShrink: 0, textAlign: 'center', border: `1px solid ${borderColor}`,
  }), [pinColor, borderColor]);

  return (
    <motion.div
      style={style}
      layout
      transition={mySpring}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: selected ? 1 : 0.5, scale: 1 }}
      exit={{ opacity: 0, scale: 0 }}
      title={title}
    >
      <div style={segNumStyle}>
        <div
          style={markerButtonStyle}
          role="button"
          onClick={() => onClick()}
        >
          {segNum + 1}
        </div>
      </div>
    </motion.div>
  );
}

function Segment({
  seg, segNum, color, isActive, selected, onClick, getTimePercent, formatTimecode, invertCutSegments,
}: {
  seg: Omit<StateSegment, 'end'> & { end: number },
  segNum: number,
  color: Color,
  isActive: boolean,
  selected: boolean,
  onClick: () => void,
  getTimePercent: (a: number) => string,
  formatTimecode: FormatTimecode,
  invertCutSegments: boolean,
}) {
  const { darkMode } = useUserSettings();
  const { name } = seg;

  const border = useMemo(() => {
    const horizontalBorderWidth = '1px';
    const verticalBorderWidth = '1.5px';

    if (isActive) {
      const horizontalColor = darkMode ? color.desaturate(0.1).lightness(60) : color.desaturate(0.2).lightness(40);
      const verticalColor = darkMode ? color.desaturate(0.1).lightness(90) : color.desaturate(0.2).lightness(10);
      return {
        horizontal: `${horizontalBorderWidth} solid ${horizontalColor.string()}`,
        vertical: `${verticalBorderWidth} solid ${verticalColor.string()}`,
      };
    }

    return {
      horizontal: `${horizontalBorderWidth} solid transparent`,
      vertical: `${verticalBorderWidth} solid transparent`,
    };
  }, [darkMode, isActive, color]);

  const backgroundColor = useMemo(() => {
    // we use both transparency and lightness, so that segments can be visible when overlapping
    if (invertCutSegments || !selected) return darkMode ? color.desaturate(0.3).lightness(30).alpha(0.5).string() : color.desaturate(0.3).lightness(70).alpha(0.5).string();
    if (isActive) return darkMode ? color.saturate(0.2).lightness(60).alpha(0.7).string() : color.saturate(0.2).lightness(40).alpha(0.8).string();
    return darkMode ? color.desaturate(0.2).lightness(50).alpha(0.7).string() : color.lightness(35).alpha(0.6).string();
  }, [darkMode, invertCutSegments, isActive, color, selected]);

  const vertBorderRadius = 5;

  const title = useMemo(() => {
    const parts = [
      formatTimecode({ seconds: seg.start, shorten: true }),
      `- ${formatTimecode({ seconds: seg.end, shorten: true })}`,
    ];
    if (name) parts.push(name);
    return parts.join(' ');
  }, [formatTimecode, name, seg.end, seg.start]);

  const wrapperStyle = useMemo<MotionStyle>(() => {
    const cutSectionWidth = getTimePercent(seg.end - seg.start);
    return {
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

      borderLeft: border.vertical,
      borderTopLeftRadius: vertBorderRadius,
      borderBottomLeftRadius: vertBorderRadius,

      borderRight: border.vertical,
      borderTopRightRadius: vertBorderRadius,
      borderBottomRightRadius: vertBorderRadius,

      borderTop: border.horizontal,
      borderBottom: border.horizontal,
    };
  }, [getTimePercent, seg.end, seg.start, border]);

  return (
    <motion.div
      style={wrapperStyle}
      layout
      transition={mySpring}
      initial={{ opacity: 0, scaleX: 0 }}
      animate={{ opacity: 1, scaleX: 1, backgroundColor }}
      exit={{ opacity: 0, scaleX: 0 }}
      role="button"
      onClick={onClick}
      title={title}
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
              style={{ width: '100%', color: 'var(--gray-12)' }}
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

function SegmentOrMarker({
  seg, fileDurationNonZero, isActive, segNum, onSegClick, invertCutSegments, formatTimecode, selected,
} : {
  seg: StateSegment,
  fileDurationNonZero: number,
  isActive: boolean,
  segNum: number,
  onSegClick: (a: number) => void,
  invertCutSegments: boolean,
  formatTimecode: FormatTimecode,
  selected: boolean,
}) {
  const { getSegColor } = useSegColors();

  const segColor = useMemo(() => getSegColor(seg), [getSegColor, seg]);

  const getTimePercent = (t: number) => `${(t / fileDurationNonZero) * 100}%`;

  const onThisSegClick = useCallback(() => onSegClick(segNum), [onSegClick, segNum]);

  if (seg.end != null) {
    return <Segment seg={seg as Omit<StateSegment, 'end'> & { end: number }} segNum={segNum} color={segColor} selected={selected} isActive={isActive} onClick={onThisSegClick} getTimePercent={getTimePercent} formatTimecode={formatTimecode} invertCutSegments={invertCutSegments} />;
  }

  return (
    <Marker seg={seg} segNum={segNum} color={segColor} selected={selected} isActive={isActive} onClick={onThisSegClick} getTimePercent={getTimePercent} formatTimecode={formatTimecode} />
  );
}

export default memo(SegmentOrMarker);
