import React, { memo, useMemo, useRef, useCallback } from 'react';
import { FaYinYang, FaSave, FaPlus, FaMinus, FaTag, FaSortNumericDown, FaAngleRight, FaRegCheckCircle, FaRegCircle } from 'react-icons/fa';
import { AiOutlineSplitCells } from 'react-icons/ai';
import { motion } from 'framer-motion';
import { useTranslation, Trans } from 'react-i18next';
import { ReactSortable } from 'react-sortablejs';
import isEqual from 'lodash/isEqual';
import useDebounce from 'react-use/lib/useDebounce';
import scrollIntoView from 'scroll-into-view-if-needed';

import Swal from './swal';
import useContextMenu from './hooks/useContextMenu';
import useUserSettings from './hooks/useUserSettings';
import { saveColor, controlsBackground, primaryTextColor, darkModeTransition } from './colors';
import { useSegColors } from './contexts';
import { mySpring } from './animations';
import { getSegmentTags } from './segments';

const buttonBaseStyle = {
  margin: '0 3px', borderRadius: 3, color: 'white', cursor: 'pointer',
};

const neutralButtonColor = 'var(--gray8)';


const Segment = memo(({ darkMode, seg, index, currentSegIndex, formatTimecode, getFrameCount, updateOrder, invertCutSegments, onClick, onRemovePress, onRemoveSelected, onLabelSelectedSegments, onReorderPress, onLabelPress, selected, onSelectSingleSegment, onToggleSegmentSelected, onDeselectAllSegments, onSelectSegmentsByLabel, onSelectSegmentsByTag, onSelectAllSegments, jumpSegStart, jumpSegEnd, addSegment, onViewSegmentTags, onExtractSegmentFramesAsImages, onInvertSelectedSegments, onDuplicateSegmentClick }) => {
  const { t } = useTranslation();
  const { getSegColor } = useSegColors();

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
      { label: t('Duplicate segment'), click: () => onDuplicateSegmentClick(seg) },

      { type: 'separator' },

      { label: t('Select only this segment'), click: () => onSelectSingleSegment(seg) },
      { label: t('Select all segments'), click: () => onSelectAllSegments() },
      { label: t('Deselect all segments'), click: () => onDeselectAllSegments() },
      { label: t('Select segments by label'), click: () => onSelectSegmentsByLabel(seg) },
      { label: t('Select segments by tag'), click: () => onSelectSegmentsByTag(seg) },
      { label: t('Invert selected segments'), click: () => onInvertSelectedSegments() },

      { type: 'separator' },

      { label: t('Label selected segments'), click: onLabelSelectedSegments },
      { label: t('Remove selected segments'), click: onRemoveSelected },

      { type: 'separator' },

      { label: t('Change segment order'), click: onReorderPress },
      { label: t('Increase segment order'), click: () => updateOrder(1) },
      { label: t('Decrease segment order'), click: () => updateOrder(-1) },

      { type: 'separator' },

      { label: t('Segment tags'), click: () => onViewSegmentTags(index) },
      { label: t('Extract frames as image files'), click: () => onExtractSegmentFramesAsImages([seg.segId]) },
    ];
  }, [invertCutSegments, t, jumpSegStart, jumpSegEnd, addSegment, onLabelPress, onRemovePress, onLabelSelectedSegments, onRemoveSelected, onReorderPress, onDuplicateSegmentClick, seg, onSelectSingleSegment, onSelectAllSegments, onDeselectAllSegments, onSelectSegmentsByLabel, onSelectSegmentsByTag, onInvertSelectedSegments, updateOrder, onViewSegmentTags, index, onExtractSegmentFramesAsImages]);

  useContextMenu(ref, contextMenuTemplate);

  const duration = seg.end - seg.start;
  const durationMs = duration * 1000;

  const isActive = !invertCutSegments && currentSegIndex === index;

  useDebounce(() => {
    if (isActive && ref.current) scrollIntoView(ref.current, { behavior: 'smooth', scrollMode: 'if-needed' });
  }, 300, [isActive]);

  function renderNumber() {
    if (invertCutSegments) return <FaSave style={{ color: saveColor, marginRight: 5, verticalAlign: 'middle' }} size={14} />;

    const segColor = getSegColor(seg);

    const color = segColor.desaturate(0.25).lightness(darkMode ? 35 : 55);
    const borderColor = darkMode ? color.lighten(0.5) : color.darken(0.3);

    return <b style={{ cursor: 'grab', color: 'white', padding: '0 4px', marginRight: 3, marginLeft: -3, background: color.string(), border: `1px solid ${isActive ? borderColor.string() : 'transparent'}`, borderRadius: 10, fontSize: 12 }}>{index + 1}</b>;
  }

  const timeStr = useMemo(() => `${formatTimecode({ seconds: seg.start })} - ${formatTimecode({ seconds: seg.end })}`, [seg.start, seg.end, formatTimecode]);

  function onDoubleClick() {
    if (invertCutSegments) return;
    jumpSegStart();
  }

  const durationMsFormatted = Math.floor(durationMs);
  const frameCount = getFrameCount(duration);

  const CheckIcon = selected ? FaRegCheckCircle : FaRegCircle;

  const onToggleSegmentSelectedClick = useCallback((e) => {
    e.stopPropagation();
    onToggleSegmentSelected(seg);
  }, [onToggleSegmentSelected, seg]);

  const cursor = invertCutSegments ? undefined : 'grab';

  const tags = useMemo(() => getSegmentTags(seg), [seg]);

  return (
    <motion.div
      ref={ref}
      role="button"
      onClick={() => !invertCutSegments && onClick(index)}
      onDoubleClick={onDoubleClick}
      layout
      style={{ originY: 0, margin: '5px 0', background: 'var(--gray2)', border: isActive ? '1px solid var(--gray10)' : '1px solid transparent', padding: 5, borderRadius: 5, position: 'relative' }}
      initial={{ scaleY: 0 }}
      animate={{ scaleY: 1, opacity: !selected && !invertCutSegments ? 0.5 : undefined }}
      exit={{ scaleY: 0 }}
      className="segment-list-entry"
    >
      <div className="segment-handle" style={{ cursor, color: 'var(--gray12)', marginBottom: 3, display: 'flex', alignItems: 'center', height: 16 }}>
        {renderNumber()}
        <span style={{ cursor, fontSize: Math.min(310 / timeStr.length, 14), whiteSpace: 'nowrap' }}>{timeStr}</span>
      </div>

      <div style={{ fontSize: 12 }}>
        {seg.name && <span style={{ color: primaryTextColor, marginRight: '.3em' }}>{seg.name}</span>}
        {Object.entries(tags).map(([name, value]) => (
          <span style={{ fontSize: 11, backgroundColor: 'var(--gray5)', color: 'var(--gray12)', borderRadius: '.4em', padding: '0 .2em', marginRight: '.1em' }} key={name}>{name}:<b>{value}</b></span>
        ))}
      </div>

      <div style={{ fontSize: 13 }}>
        {t('Duration')} {formatTimecode({ seconds: duration, shorten: true })}
      </div>
      <div style={{ fontSize: 12 }}>
        <Trans>{{ durationMsFormatted }} ms, {{ frameCount: frameCount ?? '?' }} frames</Trans>
      </div>

      {!invertCutSegments && (
        <div style={{ position: 'absolute', right: 3, bottom: 3 }}>
          <CheckIcon className="enabled" size={20} color="var(--gray12)" onClick={onToggleSegmentSelectedClick} />
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
  selectedSegments, isSegmentSelected, onSelectSingleSegment, onToggleSegmentSelected, onDeselectAllSegments, onSelectAllSegments, onSelectSegmentsByLabel, onSelectSegmentsByTag, onExtractSegmentFramesAsImages, onLabelSelectedSegments, onInvertSelectedSegments, onDuplicateSegmentClick,
  jumpSegStart, jumpSegEnd, onViewSegmentTags,
}) => {
  const { t } = useTranslation();
  const { getSegColor } = useSegColors();

  const { invertCutSegments, simpleMode, darkMode } = useUserSettings();

  const segments = invertCutSegments ? inverseCutSegments : apparentCutSegments;

  const sortableList = segments.map((seg) => ({ id: seg.segId, seg }));

  const setSortableList = useCallback((newList) => {
    if (isEqual(segments.map((s) => s.segId), newList.map((l) => l.id))) return; // No change
    updateSegOrders(newList.map((list) => list.id));
  }, [segments, updateSegOrders]);

  let header = t('Segments to export:');
  if (segments.length === 0) {
    if (invertCutSegments) {
      header = (
        <Trans>You have enabled the &quot;invert segments&quot; mode <FaYinYang style={{ verticalAlign: 'middle' }} /> which will cut away selected segments instead of keeping them. But there is no space between any segments, or at least two segments are overlapping. This would not produce any output. Either make room between segments or click the Yinyang <FaYinYang style={{ verticalAlign: 'middle', color: primaryTextColor }} /> symbol below to disable this mode. Alternatively you may combine overlapping segments from the menu.</Trans>
      );
    } else {
      header = t('No segments to export.');
    }
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
    const getButtonColor = (seg) => getSegColor(seg).desaturate(0.3).lightness(darkMode ? 45 : 55).string();
    const currentSegColor = getButtonColor(currentCutSeg);
    const segAtCursorColor = getButtonColor(segmentAtCursor);

    const segmentsTotal = selectedSegments.reduce((acc, { start, end }) => (end - start) + acc, 0);

    return (
      <>
        <div style={{ display: 'flex', padding: '5px 0', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(gray6)' }}>
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

        <div style={{ padding: '5px 10px', boxSizing: 'border-box', borderBottom: '1px solid var(gray6)', borderTop: '1px solid var(gray6)', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <div>{t('Segments total:')}</div>
          <div>{formatTimecode({ seconds: segmentsTotal })}</div>
        </div>
      </>
    );
  }

  return (
    <motion.div
      style={{ width, background: controlsBackground, borderLeft: '1px solid var(--gray7)', color: 'var(--gray11)', transition: darkModeTransition, display: 'flex', flexDirection: 'column', overflowY: 'hidden' }}
      initial={{ x: width }}
      animate={{ x: 0 }}
      exit={{ x: width }}
      transition={mySpring}
    >
      <div style={{ fontSize: 14, padding: '0 5px', color: 'var(--gray12)' }} className="no-user-select">
        <FaAngleRight
          title={t('Close sidebar')}
          size={20}
          style={{ verticalAlign: 'middle', color: 'var(--gray11)', cursor: 'pointer', padding: 2 }}
          role="button"
          onClick={toggleSegmentsList}
        />

        {header}
      </div>

      <div style={{ padding: '0 10px', overflowY: 'scroll', flexGrow: 1 }} className="hide-scrollbar">
        <ReactSortable list={sortableList} setList={setSortableList} disabled={!!invertCutSegments} handle=".segment-handle">
          {sortableList.map(({ id, seg }, index) => {
            const selected = !invertCutSegments && isSegmentSelected({ segId: seg.segId });
            return (
              <Segment
                key={id}
                darkMode={darkMode}
                seg={seg}
                index={index}
                selected={selected}
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
                onSelectSegmentsByTag={onSelectSegmentsByTag}
                onExtractSegmentFramesAsImages={onExtractSegmentFramesAsImages}
                onLabelSelectedSegments={onLabelSelectedSegments}
                onInvertSelectedSegments={onInvertSelectedSegments}
                onDuplicateSegmentClick={onDuplicateSegmentClick}
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
