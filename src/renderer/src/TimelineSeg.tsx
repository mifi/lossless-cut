import { memo, useCallback, useMemo } from 'react';
import { LuSave, LuTrash2 } from 'react-icons/lu';
import type { MotionStyle } from 'motion/react';
import { motion, AnimatePresence } from 'motion/react';
import type { ColorInstance } from 'color';

import useUserSettings from './hooks/useUserSettings';
import { useSegColors } from './contexts';
import type { FormatTimecode, StateSegment } from './types';


const markerButtonStyle: React.CSSProperties = { fontSize: 10, minWidth: 0, letterSpacing: '-.1em', color: 'white' };

function Marker({
  seg, segNum, color, isActive, selected, onClick, getTimePercent, formatTimecode,
}: {
  seg: StateSegment,
  segNum: number,
  color: ColorInstance,
  isActive: boolean,
  selected: boolean,
  onClick: () => void,
  getTimePercent: (a: number) => string,
  formatTimecode: FormatTimecode,
}) {
  const { darkMode, prefersReducedMotion, springAnimation } = useUserSettings();

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
      layout={!prefersReducedMotion}
      transition={springAnimation}
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
  color: ColorInstance,
  isActive: boolean,
  selected: boolean,
  onClick: () => void,
  getTimePercent: (a: number) => string,
  formatTimecode: FormatTimecode,
  invertCutSegments: boolean,
}) {
  const { darkMode, prefersReducedMotion, springAnimation } = useUserSettings();
  const { name } = seg;

  const border = useMemo(() => {
    if (isActive) {
      const activeColor = darkMode ? 'rgba(255, 255, 255, .9)' : color.darken(0.55).string();
      return {
        horizontal: `2px solid ${activeColor}`,
        vertical: `2px solid ${activeColor}`,
      };
    }

    const edgeColor = (invertCutSegments || !selected) ? color.alpha(0.35).string() : color.alpha(darkMode ? 0.75 : 0.9).string();
    return {
      horizontal: `1px solid ${edgeColor}`,
      vertical: `1px solid ${edgeColor}`,
    };
  }, [darkMode, isActive, color, invertCutSegments, selected]);

  const backgroundColor = useMemo(() => {
    // tinted fill with a clear edge, still see-through so that overlapping segments are visible
    if (invertCutSegments || !selected) return color.desaturate(0.4).alpha(darkMode ? 0.12 : 0.15).string();
    if (isActive) return color.alpha(darkMode ? 0.55 : 0.6).string();
    return color.alpha(darkMode ? 0.4 : 0.45).string();
  }, [darkMode, invertCutSegments, isActive, color, selected]);

  const vertBorderRadius = 8;

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
      top: 3,
      bottom: 3,
      left: getTimePercent(seg.start),
      width: cutSectionWidth,
      paddingLeft: 4,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      originX: 0,
      boxSizing: 'border-box',
      color: darkMode ? 'white' : color.darken(0.7).string(),
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
  }, [getTimePercent, seg.end, seg.start, border, darkMode, color]);

  return (
    <motion.div
      style={wrapperStyle}
      layout={!prefersReducedMotion}
      transition={springAnimation}
      initial={{ opacity: 0, scaleX: 0 }}
      animate={{ opacity: 1, scaleX: 1, backgroundColor }}
      exit={{ opacity: 0, scaleX: 0 }}
      role="button"
      onClick={onClick}
      title={title}
    >
      <div style={{ alignSelf: 'flex-start', flexShrink: 0, fontSize: 10, fontWeight: 700, minWidth: 0, marginTop: 1 }}>{segNum + 1}</div>

      <AnimatePresence>
        {invertCutSegments && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            style={{ flexShrink: 1 }}
          >
            <LuTrash2 style={{ display: 'block', width: '100%', minWidth: '.4em', color: 'currentColor', marginRight: '.1em' }} />
          </motion.div>
        )}
        {!invertCutSegments && !seg.name && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            style={{ flexShrink: 1 }}
          >
            <LuSave style={{ display: 'block', width: '100%', minWidth: '.4em', color: 'currentColor', marginRight: '.1em' }} />
          </motion.div>
        )}
      </AnimatePresence>

      {name && <div style={{ flexBasis: 4, flexShrink: 1 }} />}

      {name && <div style={{ flexShrink: 1, fontSize: 11, fontWeight: 600, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{name}</div>}

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
