import React, { memo, useMemo, useRef } from 'react';
import prettyMs from 'pretty-ms';
import { FaSave, FaPlus, FaMinus, FaTag, FaSortNumericDown, FaAngleRight, FaCheck, FaTimes } from 'react-icons/fa';
import { AiOutlineSplitCells } from 'react-icons/ai';
import { motion } from 'framer-motion';
import Swal from 'sweetalert2';
import { useTranslation } from 'react-i18next';
import { ReactSortable } from 'react-sortablejs';
import isEqual from 'lodash/isEqual';
import useDebounce from 'react-use/lib/useDebounce';
import scrollIntoView from 'scroll-into-view-if-needed';

import useContextMenu from './hooks/useContextMenu';
import { saveColor } from './colors';
import { getSegColors } from './util/colors';

const buttonBaseStyle = {
  margin: '0 3px', borderRadius: 3, color: 'white', cursor: 'pointer',
};

const neutralButtonColor = 'rgba(255, 255, 255, 0.2)';


const Segment = memo(({ seg, index, currentSegIndex, formatTimecode, getFrameCount, updateOrder, invertCutSegments, onClick, onRemovePress, onReorderPress, onLabelPress, enabled, onExportSingleSegmentClick, onExportSegmentEnabledToggle, onExportSegmentDisableAll, onExportSegmentEnableAll, jumpSegStart, jumpSegEnd, addCutSegment }) => {
  const { t } = useTranslation();

  const ref = useRef();

  useContextMenu(ref, invertCutSegments ? [] : [
    { label: t('Jump to cut start'), click: jumpSegStart },
    { label: t('Jump to cut end'), click: jumpSegEnd },

    { type: 'separator' },

    { label: t('Add segment'), click: addCutSegment },
    { label: t('Label segment'), click: onLabelPress },
    { label: t('Remove segment'), click: onRemovePress },

    { type: 'separator' },

    { label: t('Change segment order'), click: onReorderPress },
    { label: t('Increase segment order'), click: () => updateOrder(1) },
    { label: t('Decrease segment order'), click: () => updateOrder(-1) },

    { type: 'separator' },

    { label: t('Include ONLY this segment in export'), click: () => onExportSingleSegmentClick(seg) },
    { label: enabled ? t('Exclude this segment from export') : t('Include this segment in export'), click: () => onExportSegmentEnabledToggle(seg) },
    { label: t('Include all segments in export'), click: () => onExportSegmentEnableAll(seg) },
    { label: t('Exclude all segments from export'), click: () => onExportSegmentDisableAll(seg) },
  ]);

  const duration = seg.end - seg.start;
  const durationMs = duration * 1000;

  const isActive = !invertCutSegments && currentSegIndex === index;

  useDebounce(() => {
    if (isActive && ref.current) scrollIntoView(ref.current, { behavior: 'smooth', scrollMode: 'if-needed' });
  }, 300, [isActive]);

  function renderNumber() {
    if (invertCutSegments) return <FaSave style={{ color: saveColor, marginRight: 5, verticalAlign: 'middle' }} size={14} />;

    const { segBgColor, segBorderColor } = getSegColors(seg);

    return <b style={{ color: 'white', padding: '0 4px', marginRight: 3, background: segBgColor, border: `1px solid ${isActive ? segBorderColor : 'transparent'}`, borderRadius: 10, fontSize: 12 }}>{index + 1}</b>;
  }

  const timeStr = useMemo(() => `${formatTimecode(seg.start)} - ${formatTimecode(seg.end)}`, [seg.start, seg.end, formatTimecode]);

  function onDoubleClick() {
    if (invertCutSegments) return;
    if (!enabled) {
      onExportSegmentEnabledToggle(seg);
      return;
    }
    jumpSegStart();
  }

  return (
    <motion.div
      ref={ref}
      role="button"
      onClick={() => !invertCutSegments && onClick(index)}
      onDoubleClick={onDoubleClick}
      positionTransition
      style={{ originY: 0, margin: '5px 0', border: `1px solid rgba(255,255,255,${isActive ? 1 : 0.3})`, padding: 5, borderRadius: 5, position: 'relative', opacity: !enabled && !invertCutSegments ? 0.5 : undefined }}
      initial={{ scaleY: 0 }}
      animate={{ scaleY: 1 }}
      exit={{ scaleY: 0 }}
    >
      <div style={{ color: 'white', marginBottom: 3, display: 'flex', alignItems: 'center', height: 16 }}>
        {renderNumber()}
        <span style={{ fontSize: 310 / timeStr.length, whiteSpace: 'nowrap' }}>{timeStr}</span>
      </div>
      <div style={{ fontSize: 12, color: 'white' }}>{seg.name}</div>
      <div style={{ fontSize: 13 }}>
        {t('Duration')} {prettyMs(durationMs)}
      </div>
      <div style={{ fontSize: 12 }}>
        ({Math.floor(durationMs)} ms, {getFrameCount(duration)} frames)
      </div>

      {!enabled && !invertCutSegments && (
        <div style={{ position: 'absolute', pointerEvents: 'none', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <FaTimes style={{ fontSize: 100, color: 'rgba(255,0,0,0.8)' }} />
        </div>
      )}
    </motion.div>
  );
});

const SegmentList = memo(({
  formatTimecode, cutSegments, outSegments, getFrameCount, onSegClick,
  currentSegIndex, invertCutSegments,
  updateSegOrder, updateSegOrders, addCutSegment, removeCutSegment,
  onLabelSegmentPress, currentCutSeg, segmentAtCursor, toggleSideBar, splitCurrentSegment,
  enabledOutSegments, enabledOutSegmentsRaw, onExportSingleSegmentClick, onExportSegmentEnabledToggle, onExportSegmentDisableAll, onExportSegmentEnableAll,
  jumpSegStart, jumpSegEnd, simpleMode,
}) => {
  const { t } = useTranslation();

  const sortableList = outSegments.map((seg) => ({ id: seg.segId, seg }));

  function setSortableList(newList) {
    if (isEqual(outSegments.map((s) => s.segId), newList.map((l) => l.id))) return; // No change
    updateSegOrders(newList.map((list) => list.id));
  }

  let headerText = t('Segments to export:');
  if (outSegments.length === 0) {
    if (invertCutSegments) headerText = t('Make sure you have no overlapping segments.');
    else headerText = t('No segments to export.');
  }

  async function onReorderSegsPress(index) {
    if (cutSegments.length < 2) return;
    const { value } = await Swal.fire({
      title: `${t('Change order of segment')} ${index + 1}`,
      text: `Please enter a number from 1 to ${cutSegments.length} to be the new order for the current segment`,
      input: 'text',
      inputValue: index + 1,
      showCancelButton: true,
      inputValidator: (v) => {
        const parsed = parseInt(v, 10);
        return Number.isNaN(parsed) || parsed > cutSegments.length || parsed < 1 ? t('Invalid number entered') : undefined;
      },
    });

    if (value) {
      const newOrder = parseInt(value, 10);
      updateSegOrder(index, newOrder - 1);
    }
  }

  function renderFooter() {
    const { segActiveBgColor: currentSegActiveBgColor } = getSegColors(currentCutSeg);
    const { segActiveBgColor: segmentAtCursorActiveBgColor } = getSegColors(segmentAtCursor);

    function renderExportEnabledCheckBox() {
      const segmentExportEnabled = currentCutSeg && enabledOutSegmentsRaw.some((s) => s.segId === currentCutSeg.segId);
      const Icon = segmentExportEnabled ? FaCheck : FaTimes;

      return <Icon size={24} title={segmentExportEnabled ? t('Include this segment in export') : t('Exclude this segment from export')} style={{ ...buttonBaseStyle, backgroundColor: currentSegActiveBgColor }} role="button" onClick={() => onExportSegmentEnabledToggle(currentCutSeg)} />;
    }

    return (
      <>
        <div style={{ display: 'flex', padding: '5px 0', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid grey' }}>
          <FaPlus
            size={24}
            style={{ ...buttonBaseStyle, background: neutralButtonColor }}
            role="button"
            title={t('Add segment')}
            onClick={addCutSegment}
          />

          <FaMinus
            size={24}
            style={{ ...buttonBaseStyle, background: cutSegments.length >= 2 ? currentSegActiveBgColor : neutralButtonColor }}
            role="button"
            title={`${t('Remove segment')} ${currentSegIndex + 1}`}
            onClick={() => removeCutSegment(currentSegIndex)}
          />

          {!invertCutSegments && !simpleMode && (
            <>
              <FaSortNumericDown
                size={16}
                title={t('Change segment order')}
                role="button"
                style={{ ...buttonBaseStyle, padding: 4, background: currentSegActiveBgColor }}
                onClick={() => onReorderSegsPress(currentSegIndex)}
              />

              <FaTag
                size={16}
                title={t('Label segment')}
                role="button"
                style={{ ...buttonBaseStyle, padding: 4, background: currentSegActiveBgColor }}
                onClick={() => onLabelSegmentPress(currentSegIndex)}
              />

              {renderExportEnabledCheckBox()}
            </>
          )}

          <AiOutlineSplitCells
            size={16}
            title={t('Split segment at cursor')}
            role="button"
            style={{ ...buttonBaseStyle, padding: 4, background: segmentAtCursor ? segmentAtCursorActiveBgColor : neutralButtonColor }}
            onClick={splitCurrentSegment}
          />
        </div>

        <div style={{ padding: '5px 10px', boxSizing: 'border-box', borderBottom: '1px solid grey', borderTop: '1px solid grey', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <div>{t('Segments total:')}</div>
          <div>{formatTimecode(enabledOutSegments.reduce((acc, { start, end }) => (end - start) + acc, 0))}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{ padding: '0 10px', overflowY: 'scroll', flexGrow: 1 }} className="hide-scrollbar">
        <div style={{ fontSize: 14, marginBottom: 10 }}>
          <FaAngleRight
            title={t('Close sidebar')}
            size={18}
            style={{ verticalAlign: 'middle', color: 'white' }}
            role="button"
            onClick={toggleSideBar}
          />

          {headerText}
        </div>

        <ReactSortable list={sortableList} setList={setSortableList} sort={!invertCutSegments}>
          {sortableList.map(({ id, seg }, index) => {
            const enabled = !invertCutSegments && enabledOutSegmentsRaw.includes(seg);
            return (
              <Segment
                key={id}
                seg={seg}
                index={index}
                enabled={enabled}
                onClick={onSegClick}
                addCutSegment={addCutSegment}
                onRemovePress={() => removeCutSegment(index)}
                onReorderPress={() => onReorderSegsPress(index)}
                onLabelPress={() => onLabelSegmentPress(index)}
                jumpSegStart={() => jumpSegStart(index)}
                jumpSegEnd={() => jumpSegEnd(index)}
                updateOrder={(dir) => updateSegOrder(index, index + dir)}
                getFrameCount={getFrameCount}
                formatTimecode={formatTimecode}
                currentSegIndex={currentSegIndex}
                invertCutSegments={invertCutSegments}
                onExportSingleSegmentClick={onExportSingleSegmentClick}
                onExportSegmentEnabledToggle={onExportSegmentEnabledToggle}
                onExportSegmentDisableAll={onExportSegmentDisableAll}
                onExportSegmentEnableAll={onExportSegmentEnableAll}
              />
            );
          })}
        </ReactSortable>
      </div>

      {outSegments.length > 0 && renderFooter()}
    </>
  );
});

export default SegmentList;
