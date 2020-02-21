import React, { memo, Fragment } from 'react';
import prettyMs from 'pretty-ms';
import { FaSave } from 'react-icons/fa';
import { motion } from 'framer-motion';

import { saveColor, timelineBackground } from './colors';

const SegmentList = memo(({
  formatTimecode, cutSegments, getFrameCount, getSegColors, onSegClick,
  currentSegIndex, invertCutSegments,
}) => {
  if (!cutSegments && invertCutSegments) {
    return <div style={{ padding: '0 10px' }}>Make sure you have no overlapping segments.</div>;
  }

  if (!cutSegments || cutSegments.length === 0) {
    return <div style={{ padding: '0 10px' }}>No segments to export.</div>;
  }

  return (
    <Fragment>
      <div style={{ padding: '0 10px', overflowY: 'scroll', flexGrow: 1 }}>
        <div style={{ fontSize: 14, marginBottom: 10 }}>Segments to export:</div>

        {cutSegments.map((seg, index) => {
          const duration = seg.end - seg.start;
          const durationMs = duration * 1000;

          const isActive = !invertCutSegments && currentSegIndex === index;
          const uuid = seg.uuid || `${seg.start}`;

          function renderNumber() {
            if (invertCutSegments) return <FaSave style={{ color: saveColor, marginRight: 5, verticalAlign: 'middle' }} size={14} />;

            const {
              segBgColor, segBorderColor,
            } = getSegColors(seg);

            return <b style={{ color: 'white', padding: '0 3px', marginRight: 5, background: segBgColor, border: `1px solid ${isActive ? segBorderColor : 'transparent'}`, borderRadius: 10, fontSize: 12 }}>{index + 1}</b>;
          }

          return (
            <motion.div
              role="button"
              onClick={() => !invertCutSegments && onSegClick(index)}
              key={uuid}
              positionTransition
              style={{ originY: 0, margin: '5px 0', border: `1px solid rgba(255,255,255,${isActive ? 1 : 0.3})`, padding: 5, borderRadius: 5 }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              exit={{ scaleY: 0 }}
            >
              <div style={{ fontSize: 13, whiteSpace: 'nowrap', color: 'white', marginBottom: 3 }}>
                {renderNumber()}
                <span>{formatTimecode(seg.start)} - {formatTimecode(seg.end)}</span>
              </div>
              <div style={{ fontSize: 13 }}>
                Duration {prettyMs(durationMs)}
              </div>
              <div style={{ fontSize: 12 }}>
                ({Math.floor(durationMs)} ms, {getFrameCount(duration)} frames)
              </div>
              <div style={{ fontSize: 12, color: 'white' }}>{seg.name}</div>
            </motion.div>
          );
        })}
      </div>

      <div style={{ padding: 10, boxSizing: 'border-box', background: timelineBackground, borderBottom: '1px solid grey', display: 'flex', justifyContent: 'space-between' }}>
        <div>Total time:</div>
        <div>{formatTimecode(cutSegments.reduce((acc, { start, end }) => (end - start) + acc, 0))}</div>
      </div>
    </Fragment>
  );
});

export default SegmentList;
