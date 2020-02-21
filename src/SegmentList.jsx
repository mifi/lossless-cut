import React, { memo, Fragment } from 'react';
import prettyMs from 'pretty-ms';
import { FaSave, FaPlus, FaMinus, FaTag } from 'react-icons/fa';
import { motion } from 'framer-motion';
import Swal from 'sweetalert2';

import { saveColor } from './colors';

const SegmentList = memo(({
  formatTimecode, cutSegments, getFrameCount, getSegColors, onSegClick,
  currentSegIndex, invertCutSegments,
  updateCurrentSegOrder, addCutSegment, removeCutSegment,
  setCurrentSegmentName, currentCutSeg,
}) => {
  if (!cutSegments && invertCutSegments) {
    return <div style={{ padding: '0 10px' }}>Make sure you have no overlapping segments.</div>;
  }

  if (!cutSegments || cutSegments.length === 0) {
    return <div style={{ padding: '0 10px' }}>No segments to export.</div>;
  }

  const {
    segActiveBgColor: currentSegActiveBgColor,
    segBorderColor: currentSegBorderColor,
  } = getSegColors(currentCutSeg);

  async function onLabelSegmentPress() {
    const { value } = await Swal.fire({
      showCancelButton: true,
      title: 'Label current segment',
      inputValue: currentCutSeg.name,
      input: 'text',
    });

    if (value != null) setCurrentSegmentName(value);
  }

  async function onReorderSegsPress() {
    if (cutSegments.length < 2) return;
    const { value } = await Swal.fire({
      title: `Change order of segment ${currentSegIndex + 1}`,
      text: `Please enter a number from 1 to ${cutSegments.length} to be the new order for the current segment`,
      input: 'text',
      inputValue: currentSegIndex + 1,
      showCancelButton: true,
      inputValidator: (v) => {
        const parsed = parseInt(v, 10);
        return Number.isNaN(parsed) || parsed > cutSegments.length || parsed < 1 ? 'Invalid number entered' : undefined;
      },
    });

    if (value) {
      const newOrder = parseInt(value, 10);
      updateCurrentSegOrder(newOrder - 1);
    }
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
              <div style={{ fontSize: 12, color: 'white' }}>{seg.name}</div>
              <div style={{ fontSize: 13 }}>
                Duration {prettyMs(durationMs)}
              </div>
              <div style={{ fontSize: 12 }}>
                ({Math.floor(durationMs)} ms, {getFrameCount(duration)} frames)
              </div>
            </motion.div>
          );
        })}
      </div>

      <div style={{ display: 'flex', padding: '5px 0', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid grey' }}>
        <FaPlus
          size={30}
          style={{ margin: '0 5px', color: 'white', cursor: 'pointer' }}
          role="button"
          title="Add segment"
          onClick={addCutSegment}
        />

        <FaMinus
          size={30}
          style={{ margin: '0 5px', background: cutSegments.length < 2 ? undefined : currentSegActiveBgColor, borderRadius: 3, color: 'white', cursor: 'pointer' }}
          role="button"
          title={`Delete current segment ${currentSegIndex + 1}`}
          onClick={removeCutSegment}
        />

        <div
          style={{ background: currentSegActiveBgColor, border: `2px solid ${currentSegBorderColor}`, borderRadius: 5, color: 'white', fontSize: 23, textAlign: 'center', fontWeight: 'bold', boxSizing: 'border-box', height: 30, width: 30, margin: '0 5px', cursor: 'pointer' }}
          role="button"
          title="Change segment order"
          onClick={onReorderSegsPress}
        >
          {currentSegIndex + 1}
        </div>

        <FaTag
          size={20}
          title="Label segment"
          role="button"
          style={{ padding: 4, margin: '0 5px', background: currentSegActiveBgColor, borderRadius: 3, color: 'white', cursor: 'pointer' }}
          onClick={onLabelSegmentPress}
        />
      </div>

      <div style={{ padding: 10, boxSizing: 'border-box', borderBottom: '1px solid grey', display: 'flex', justifyContent: 'space-between' }}>
        <div>Total time:</div>
        <div>{formatTimecode(cutSegments.reduce((acc, { start, end }) => (end - start) + acc, 0))}</div>
      </div>
    </Fragment>
  );
});

export default SegmentList;
