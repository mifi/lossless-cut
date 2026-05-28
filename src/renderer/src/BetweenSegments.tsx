import { memo } from 'react';
import { motion } from 'motion/react';
import { FaTrashAlt, FaSave } from 'react-icons/fa';

import { saveColor } from './colors';
import useUserSettings from './hooks/useUserSettings';


function BetweenSegments({ start, end, fileDurationNonZero, invertCutSegments }: {
  start: number,
  end: number,
  fileDurationNonZero: number,
  invertCutSegments: boolean,
}) {
  const left = `${(start / fileDurationNonZero) * 100}%`;

  const { effectiveExportMode, prefersReducedMotion, springAnimation } = useUserSettings();

  return (
    <motion.div
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        pointerEvents: 'none',
        opacity: 0.9,
      }}
      initial={{
        left,
        width: '0%',
      }}
      animate={{
        left,
        width: `${((end - start) / fileDurationNonZero) * 100}%`,
      }}
      layout={!prefersReducedMotion}
      transition={springAnimation}
    >
      <div style={{ flexGrow: 1, borderBottom: '1px dashed var(--player-text-muted)', marginLeft: 6, marginRight: 6 }} />
      {/* https://github.com/mifi/lossless-cut/issues/2157 */}
      {effectiveExportMode !== 'segments_to_chapters' && (
        <>
          {invertCutSegments ? (
            <FaSave style={{ color: saveColor, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.12))' }} />
          ) : (
            <FaTrashAlt style={{ color: 'var(--player-text-muted)', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.12))' }} />
          )}
          <div style={{ flexGrow: 1, borderBottom: '1px dashed var(--player-text-muted)', marginLeft: 6, marginRight: 6 }} />
        </>
      )}
    </motion.div>
  );
}

export default memo(BetweenSegments);
