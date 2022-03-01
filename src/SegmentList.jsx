import React, { memo, useMemo, useRef, useCallback } from 'react';
import { FaSave, FaPlus, FaMinus, FaTag, FaSortNumericDown, FaAngleRight, FaCheck, FaTimes } from 'react-icons/fa';
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
import { saveColor } from './colors';
import { getSegColor } from './util/colors';

const buttonBaseStyle = {
  margin: '0 3px', borderRadius: 3, color: 'white', cursor: 'pointer',
};

const neutralButtonColor = 'rgba(255, 255, 255, 0.2)';


const Segment = memo(({ seg, index, currentSegIndex, formatTimecode, getFrameCount, updateOrder, invertCutSegments, onClick, onRemovePress, onReorderPress, onLabelPress, enabled, onExportSingleSegmentClick, onExportSegmentEnabledToggle, onExportSegmentDisableAll, onExportSegmentEnableAll, jumpSegStart, jumpSegEnd, addCutSegment, onViewSegmentTagsPress }) => {
  const { t } = useTranslation();

  const ref = useRef();

  const contextMenuTemplate = useMemo(() => {
    if (invertCutSegments) return [];
    return [
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

      { type: 'separator' },

      { label: t('Segment tags'), click: () => onViewSegmentTagsPress(index) },
    ];
  }, [addCutSegment, enabled, index, invertCutSegments, jumpSegEnd, jumpSegStart, onExportSegmentDisableAll, onExportSegmentEnableAll, onExportSegmentEnabledToggle, onExportSingleSegmentClick, onLabelPress, onRemovePress, onReorderPress, onViewSegmentTagsPress, seg, t, updateOrder]);

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

    return <b style={{ color: 'white', padding: '0 4px', marginRight: 3, marginLeft: -3, background: segColor.alpha(0.5).string(), border: `1px solid ${isActive ? segColor.lighten(0.3).string() : 'transparent'}`, borderRadius: 10, fontSize: 12 }}>{index + 1}</b>;
  }

  const timeStr = useMemo(() => `${formatTimecode({ seconds: seg.start })} - ${formatTimecode({ seconds: seg.end })}`, [seg.start, seg.end, formatTimecode]);

  function onDoubleClick() {
    if (invertCutSegments) return;
    if (!enabled) {
      onExportSegmentEnabledToggle(seg);
      return;
    }
    jumpSegStart();
  }

  const durationMsFormatted = Math.floor(durationMs);
  const frameCount = getFrameCount(duration);

  return (
    <motion.div
      ref={ref}
      role="button"
      onClick={() => !invertCutSegments && onClick(index)}
      onDoubleClick={onDoubleClick}
      positionTransition
      style={{ cursor: 'grab', originY: 0, margin: '5px 0', background: 'rgba(0,0,0,0.1)', border: `1px solid rgba(255,255,255,${isActive ? 1 : 0.3})`, padding: 5, borderRadius: 5, position: 'relative', opacity: !enabled && !invertCutSegments ? 0.5 : undefined }}
      initial={{ scaleY: 0 }}
      animate={{ scaleY: 1 }}
      exit={{ scaleY: 0 }}
    >
      <div style={{ color: 'white', marginBottom: 3, display: 'flex', alignItems: 'center', height: 16 }}>
        {renderNumber()}
        <span style={{ fontSize: Math.min(310 / timeStr.length, 14), whiteSpace: 'nowrap' }}>{timeStr}</span>
      </div>
      <div style={{ fontSize: 12, color: 'white' }}>{seg.name}</div>
      <div style={{ fontSize: 13 }}>
        {t('Duration')} {formatTimecode({ seconds: duration, shorten: true })}
      </div>
      <div style={{ fontSize: 12 }}>
        <Trans>{{ durationMsFormatted }} ms, {{ frameCount }} frames</Trans>
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
  formatTimecode, apparentCutSegments, inverseCutSegments, getFrameCount, onSegClick,
  currentSegIndex,
  updateSegOrder, updateSegOrders, addCutSegment, removeCutSegment,
  onLabelSegmentPress, currentCutSeg, segmentAtCursor, toggleSegmentsList, splitCurrentSegment,
  enabledSegments, enabledSegmentsRaw, onExportSingleSegmentClick, onExportSegmentEnabledToggle, onExportSegmentDisableAll, onExportSegmentEnableAll,
  jumpSegStart, jumpSegEnd, onViewSegmentTagsPress,
}) => {
  const { t } = useTranslation();

  const { invertCutSegments, simpleMode } = useUserSettings();

  const segments = invertCutSegments ? inverseCutSegments : apparentCutSegments;

  const sortableList = segments.map((seg) => ({ id: seg.segId, seg }));

  const setSortableList = useCallback((newList) => {
    if (isEqual(segments.map((s) => s.segId), newList.map((l) => l.id))) return; // No change
    updateSegOrders(newList.map((list) => list.id));
  }, [segments, updateSegOrders]);

  let headerText = t('Segments to export:');
  if (segments.length === 0) {
    if (invertCutSegments) headerText = t('Make sure you have no overlapping segments.');
    else headerText = t('No segments to export.');
  }

  async function onReorderSegsPress(index) {
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

    function renderExportEnabledCheckBox() {
      const segmentExportEnabled = currentCutSeg && enabledSegmentsRaw.some((s) => s.segId === currentCutSeg.segId);
      const Icon = segmentExportEnabled ? FaCheck : FaTimes;

      return <Icon size={24} title={segmentExportEnabled ? t('Include this segment in export') : t('Exclude this segment from export')} style={{ ...buttonBaseStyle, backgroundColor: currentSegColor }} role="button" onClick={() => onExportSegmentEnabledToggle(currentCutSeg)} />;
    }

    const segmentsTotal = enabledSegments.reduce((acc, { start, end }) => (end - start) + acc, 0);

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
                onClick={() => onReorderSegsPress(currentSegIndex)}
              />

              <FaTag
                size={16}
                title={t('Label segment')}
                role="button"
                style={{ ...buttonBaseStyle, padding: 4, background: currentSegColor }}
                onClick={() => onLabelSegmentPress(currentSegIndex)}
              />

              {renderExportEnabledCheckBox()}
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
    <>
      <div style={{ padding: '0 10px', overflowY: 'scroll', flexGrow: 1 }} className="hide-scrollbar">
        <div style={{ fontSize: 14, marginBottom: 10 }}>
          <FaAngleRight
            title={t('Close sidebar')}
            size={18}
            style={{ verticalAlign: 'middle', color: 'white', cursor: 'pointer' }}
            role="button"
            onClick={toggleSegmentsList}
          />

          {headerText}
        </div>

        <ReactSortable list={sortableList} setList={setSortableList} sort={!invertCutSegments}>
          {sortableList.map(({ id, seg }, index) => {
            const enabled = !invertCutSegments && enabledSegmentsRaw.includes(seg);
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
                onViewSegmentTagsPress={onViewSegmentTagsPress}
              />
            );
          })}
        </ReactSortable>
      </div>

      {segments.length > 0 && renderFooter()}
    </>
  );
});

export default SegmentList;
