import React, { memo, useMemo, useRef, useCallback } from 'react';
import { FaYinYang, FaSave, FaPlus, FaMinus, FaTag, FaSortNumericDown, FaAngleRight, FaRegCheckCircle, FaRegCircle } from 'react-icons/fa';
import { AiOutlineSplitCells } from 'react-icons/ai';
import { motion } from 'framer-motion';
import Swal from 'sweetalert2';
import { useTranslation, Trans } from 'react-i18next';
import { ReactSortable } from 'react-sortablejs';
import isEqual from 'lodash/isEqual';
import useDebounce from 'react-use/lib/useDebounce';
import scrollIntoView from 'scroll-into-view-if-needed';

import useContextMenu from './hooks/useContextMenu';
import useUserSettings from './hooks/useUserSettings';
import { saveColor, controlsBackground, primaryTextColor } from './colors';
import { getSegColor } from './util/colors';

const buttonBaseStyle = {
  margin: '0 3px', borderRadius: 3, color: 'white', cursor: 'pointer',
};

const neutralButtonColor = 'rgba(255, 255, 255, 0.2)';


const Segment = memo(({ seg, index, currentSegIndex, formatTimecode, getFrameCount, updateOrder, invertCutSegments, onClick, onRemovePress, onRemoveSelected, onLabelSelectedSegments, onReorderPress, onLabelPress, enabled, onSelectSingleSegment, onToggleSegmentSelected, onDeselectAllSegments, onSelectSegmentsByLabel, onSelectAllSegments, jumpSegStart, jumpSegEnd, addSegment, onViewSegmentTags, onExtractSegmentFramesAsImages }) => {
  const { t } = useTranslation();

  const ref = useRef();

  const contextMenuTemplate = useMemo(() => {
    if (invertCutSegments) return [];
    return [
      { label: t('Jump to start time'), click: jumpSegStart },
      { label: t('Jump to end time'), click: jumpSegEnd },

      { type: 'separator' },

      { label: t('Add segment'), click: addSegment },
      { label: t('Label segment'), click: onLabelPress },
      { label: t('Remove segment'), click: onRemovePress },

      { type: 'separator' },

      { label: t('Select only this segment'), click: () => onSelectSingleSegment(seg) },
      { label: t('Select all segments'), click: () => onSelectAllSegments() },
      { label: t('Deselect all segments'), click: () => onDeselectAllSegments() },
      { label: t('Select segments by label'), click: () => onSelectSegmentsByLabel(seg) },

      { type: 'separator' },

      { label: t('Label selected segments'), click: onLabelSelectedSegments },
      { label: t('Remove selected segments'), click: onRemoveSelected },

      { type: 'separator' },

      { label: t('Change segment order'), click: onReorderPress },
      { label: t('Increase segment order'), click: () => updateOrder(1) },
      { label: t('Decrease segment order'), click: () => updateOrder(-1) },

      { type: 'separator' },

      { label: t('Segment tags'), click: () => onViewSegmentTags(index) },
      { label: t('Extract all frames as images'), click: () => onExtractSegmentFramesAsImages(index) },
    ];
  }, [invertCutSegments, t, jumpSegStart, jumpSegEnd, addSegment, onLabelPress, onRemovePress, onReorderPress, onRemoveSelected, onLabelSelectedSegments, updateOrder, onSelectSingleSegment, seg, onSelectAllSegments, onDeselectAllSegments, onSelectSegmentsByLabel, onViewSegmentTags, index, onExtractSegmentFramesAsImages]);

  useContextMenu(ref, contextMenuTemplate);

  const duration = seg.end - seg.start;
  const durationMs = duration * 1000;

  const isActive = !invertCutSegments && currentSegIndex === index;

  useDebounce(() => {
    if (isActive && ref.current) scrollIntoView(ref.current, { behavior: 'smooth', scrollMode: 'if-needed' });
  }, 300, [isActive]);

  function renderNumber() {
    if (invertCutSegments) return <FaSave style={{ cursor: 'grab', color: saveColor, marginRight: 5, verticalAlign: 'middle' }} size={14} />;

    const segColor = getSegColor(seg);

    return <b style={{ cursor: 'grab', color: 'white', padding: '0 4px', marginRight: 3, marginLeft: -3, background: segColor.alpha(0.5).string(), border: `1px solid ${isActive ? segColor.lighten(0.3).string() : 'transparent'}`, borderRadius: 10, fontSize: 12 }}>{index + 1}</b>;
  }

  const timeStr = useMemo(() => `${formatTimecode({ seconds: seg.start })} - ${formatTimecode({ seconds: seg.end })}`, [seg.start, seg.end, formatTimecode]);

  function onDoubleClick() {
    if (invertCutSegments) return;
    if (!enabled) {
      onToggleSegmentSelected(seg);
      return;
    }
    jumpSegStart();
  }

  const durationMsFormatted = Math.floor(durationMs);
  const frameCount = getFrameCount(duration);

  const CheckIcon = enabled ? FaRegCheckCircle : FaRegCircle;

  const onToggleSegmentSelectedClick = useCallback((e) => {
    e.stopPropagation();
    onToggleSegmentSelected(seg);
  }, [onToggleSegmentSelected, seg]);

  return (
    <motion.div
      ref={ref}
      role="button"
      onClick={() => !invertCutSegments && onClick(index)}
      onDoubleClick={onDoubleClick}
      positionTransition
      style={{ originY: 0, margin: '5px 0', background: 'rgba(0,0,0,0.1)', border: `1px solid rgba(255,255,255,${isActive ? 1 : 0.3})`, padding: 5, borderRadius: 5, position: 'relative', opacity: !enabled && !invertCutSegments ? 0.5 : undefined }}
      initial={{ scaleY: 0 }}
      animate={{ scaleY: 1 }}
      exit={{ scaleY: 0 }}
      className="segment-list-entry"
    >
      <div className="segment-handle" style={{ cursor: 'grab', color: 'white', marginBottom: 3, display: 'flex', alignItems: 'center', height: 16 }}>
        {renderNumber()}
        <span style={{ cursor: 'grab', fontSize: Math.min(310 / timeStr.length, 14), whiteSpace: 'nowrap' }}>{timeStr}</span>
      </div>

      <div style={{ fontSize: 12, color: 'white' }}>{seg.name}</div>
      <div style={{ fontSize: 13 }}>
        {t('Duration')} {formatTimecode({ seconds: duration, shorten: true })}
      </div>
      <div style={{ fontSize: 12 }}>
        <Trans>{{ durationMsFormatted }} ms, {{ frameCount }} frames</Trans>
      </div>

      {!invertCutSegments && (
        <div style={{ position: 'absolute', right: 3, bottom: 3 }}>
          <CheckIcon className="enabled" size={20} color="white" onClick={onToggleSegmentSelectedClick} />
        </div>
      )}
    </motion.div>
  );
});

const SegmentList = memo(({
  width, formatTimecode, apparentCutSegments, inverseCutSegments, getFrameCount, onSegClick,
  currentSegIndex,
  updateSegOrder, updateSegOrders, addSegment, removeCutSegment, onRemoveSelected,
  onLabelSegment, currentCutSeg, segmentAtCursor, toggleSegmentsList, splitCurrentSegment,
  selectedSegments, selectedSegmentsRaw, onSelectSingleSegment, onToggleSegmentSelected, onDeselectAllSegments, onSelectAllSegments, onSelectSegmentsByLabel, onExtractSegmentFramesAsImages, onLabelSelectedSegments,
  jumpSegStart, jumpSegEnd, onViewSegmentTags,
}) => {
  const { t } = useTranslation();

  const { invertCutSegments, simpleMode } = useUserSettings();

  const segments = invertCutSegments ? inverseCutSegments : apparentCutSegments;

  const sortableList = segments.map((seg) => ({ id: seg.segId, seg }));

  const setSortableList = useCallback((newList) => {
    if (isEqual(segments.map((s) => s.segId), newList.map((l) => l.id))) return; // No change
    updateSegOrders(newList.map((list) => list.id));
  }, [segments, updateSegOrders]);

  let header = t('Segments to export:');
  if (segments.length === 0) {
    if (invertCutSegments) header = <Trans>You have enabled the &quot;invert segments&quot; mode <FaYinYang style={{ verticalAlign: 'middle' }} /> which will cut away selected segments instead of keeping them. But there is no space between any segments, or at least two segments are overlapping. This would not produce any output. Either make room between segments or click the Yinyang <FaYinYang style={{ verticalAlign: 'middle', color: primaryTextColor }} /> symbol below to disable this mode.</Trans>;
    else header = t('No segments to export.');
  }

  async function onReorderSegs(index) {
    if (apparentCutSegments.length < 2) return;
    const { value } = await Swal.fire({
      title: `${t('Change order of segment')} ${index + 1}`,
      text: `Please enter a number from 1 to ${apparentCutSegments.length} to be the new order for the current segment`,
      input: 'text',
      inputValue: index + 1,
      showCancelButton: true,
      inputValidator: (v) => {
        const parsed = parseInt(v, 10);
        return Number.isNaN(parsed) || parsed > apparentCutSegments.length || parsed < 1 ? t('Invalid number entered') : undefined;
      },
    });

    if (value) {
      const newOrder = parseInt(value, 10);
      updateSegOrder(index, newOrder - 1);
    }
  }

  function renderFooter() {
    const currentSegColor = getSegColor(currentCutSeg).alpha(0.5).string();
    const segAtCursorColor = getSegColor(segmentAtCursor).alpha(0.5).string();

    const segmentsTotal = selectedSegments.reduce((acc, { start, end }) => (end - start) + acc, 0);

    return (
      <>
        <div style={{ display: 'flex', padding: '5px 0', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid grey' }}>
          <FaPlus
            size={24}
            style={{ ...buttonBaseStyle, background: neutralButtonColor }}
            role="button"
            title={t('Add segment')}
            onClick={addSegment}
          />

          <FaMinus
            size={24}
            style={{ ...buttonBaseStyle, background: apparentCutSegments.length >= 2 ? currentSegColor : neutralButtonColor }}
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
                style={{ ...buttonBaseStyle, padding: 4, background: currentSegColor }}
                onClick={() => onReorderSegs(currentSegIndex)}
              />

              <FaTag
                size={16}
                title={t('Label segment')}
                role="button"
                style={{ ...buttonBaseStyle, padding: 4, background: currentSegColor }}
                onClick={() => onLabelSegment(currentSegIndex)}
              />
            </>
          )}

          <AiOutlineSplitCells
            size={22}
            title={t('Split segment at cursor')}
            role="button"
            style={{ ...buttonBaseStyle, padding: 1, background: segmentAtCursor ? segAtCursorColor : neutralButtonColor }}
            onClick={splitCurrentSegment}
          />
        </div>

        <div style={{ padding: '5px 10px', boxSizing: 'border-box', borderBottom: '1px solid grey', borderTop: '1px solid grey', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <div>{t('Segments total:')}</div>
          <div>{formatTimecode({ seconds: segmentsTotal })}</div>
        </div>
      </>
    );
  }

  return (
    <motion.div
      style={{ width, background: controlsBackground, color: 'rgba(255,255,255,0.7)', display: 'flex', flexDirection: 'column', overflowY: 'hidden' }}
      initial={{ x: width }}
      animate={{ x: 0 }}
      exit={{ x: width }}
    >
      <div style={{ fontSize: 14, padding: '0 5px', display: 'flex', alignItems: 'center' }} className="no-user-select">
        <FaAngleRight
          title={t('Close sidebar')}
          size={20}
          style={{ verticalAlign: 'middle', color: 'white', cursor: 'pointer', padding: 2 }}
          role="button"
          onClick={toggleSegmentsList}
        />

        {header}
      </div>
      <div style={{ padding: '0 10px', overflowY: 'scroll', flexGrow: 1 }} className="hide-scrollbar">
        <ReactSortable list={sortableList} setList={setSortableList} sort={!invertCutSegments} handle=".segment-handle">
          {sortableList.map(({ id, seg }, index) => {
            const enabled = !invertCutSegments && selectedSegmentsRaw.includes(seg);
            return (
              <Segment
                key={id}
                seg={seg}
                index={index}
                enabled={enabled}
                onClick={onSegClick}
                addSegment={addSegment}
                onRemoveSelected={onRemoveSelected}
                onRemovePress={() => removeCutSegment(index)}
                onReorderPress={() => onReorderSegs(index)}
                onLabelPress={() => onLabelSegment(index)}
                jumpSegStart={() => jumpSegStart(index)}
                jumpSegEnd={() => jumpSegEnd(index)}
                updateOrder={(dir) => updateSegOrder(index, index + dir)}
                getFrameCount={getFrameCount}
                formatTimecode={formatTimecode}
                currentSegIndex={currentSegIndex}
                invertCutSegments={invertCutSegments}
                onSelectSingleSegment={onSelectSingleSegment}
                onToggleSegmentSelected={onToggleSegmentSelected}
                onDeselectAllSegments={onDeselectAllSegments}
                onSelectAllSegments={onSelectAllSegments}
                onViewSegmentTags={onViewSegmentTags}
                onSelectSegmentsByLabel={onSelectSegmentsByLabel}
                onExtractSegmentFramesAsImages={onExtractSegmentFramesAsImages}
                onLabelSelectedSegments={onLabelSelectedSegments}
              />
            );
          })}
        </ReactSortable>
      </div>

      {segments.length > 0 && renderFooter()}
    </motion.div>
  );
});

export default SegmentList;
