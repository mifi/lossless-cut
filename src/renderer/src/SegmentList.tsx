import { memo, useMemo, useRef, useCallback, useState, SetStateAction, Dispatch, ReactNode, MouseEventHandler } from 'react';
import { FaYinYang, FaSave, FaPlus, FaMinus, FaTag, FaSortNumericDown, FaAngleRight, FaRegCheckCircle, FaRegCircle } from 'react-icons/fa';
import { AiOutlineSplitCells } from 'react-icons/ai';
import { MotionStyle, motion } from 'framer-motion';
import { useTranslation, Trans } from 'react-i18next';
import { ReactSortable } from 'react-sortablejs';
import isEqual from 'lodash/isEqual';
import useDebounce from 'react-use/lib/useDebounce';
import scrollIntoView from 'scroll-into-view-if-needed';
import { Dialog } from 'evergreen-ui';

import Swal from './swal';
import useContextMenu from './hooks/useContextMenu';
import useUserSettings from './hooks/useUserSettings';
import { saveColor, controlsBackground, primaryTextColor, darkModeTransition } from './colors';
import { useSegColors } from './contexts';
import { mySpring } from './animations';
import { getSegmentTags } from './segments';
import TagEditor from './components/TagEditor';
import { ApparentCutSegment, ContextMenuTemplate, FormatTimecode, GetFrameCount, InverseCutSegment, SegmentTags, StateSegment } from './types';
import { UseSegments } from './hooks/useSegments';

const buttonBaseStyle = {
  margin: '0 3px', borderRadius: 3, color: 'white', cursor: 'pointer',
};

const neutralButtonColor = 'var(--gray8)';

// eslint-disable-next-line react/display-name
const Segment = memo(({
  seg,
  index,
  currentSegIndex,
  formatTimecode,
  getFrameCount,
  updateSegOrder,
  onClick,
  onRemovePress,
  onRemoveSelected,
  onLabelSelectedSegments,
  onReorderPress,
  onLabelPress,
  selected,
  onSelectSingleSegment,
  onToggleSegmentSelected,
  onDeselectAllSegments,
  onSelectSegmentsByLabel,
  onSelectSegmentsByExpr,
  onSelectAllSegments,
  onMutateSegmentsByExpr,
  jumpSegStart,
  jumpSegEnd,
  addSegment,
  onEditSegmentTags,
  onExtractSegmentFramesAsImages,
  onInvertSelectedSegments,
  onDuplicateSegmentClick,
}: {
  seg: ApparentCutSegment | InverseCutSegment,
  index: number,
  currentSegIndex: number,
  formatTimecode: FormatTimecode,
  getFrameCount: GetFrameCount,
  updateSegOrder: UseSegments['updateSegOrder'],
  onClick: (i: number) => void,
  onRemovePress: UseSegments['removeCutSegment'],
  onRemoveSelected: UseSegments['removeSelectedSegments'],
  onLabelSelectedSegments: UseSegments['onLabelSelectedSegments'],
  onReorderPress: (i: number) => Promise<void>,
  onLabelPress: UseSegments['onLabelSegment'],
  selected: boolean,
  onSelectSingleSegment: UseSegments['selectOnlySegment'],
  onToggleSegmentSelected: UseSegments['toggleSegmentSelected'],
  onDeselectAllSegments: UseSegments['deselectAllSegments'],
  onSelectSegmentsByLabel: UseSegments['onSelectSegmentsByLabel'],
  onSelectSegmentsByExpr: UseSegments['onSelectSegmentsByExpr'],
  onSelectAllSegments: UseSegments['selectAllSegments'],
  onMutateSegmentsByExpr: UseSegments['onMutateSegmentsByExpr'],
  jumpSegStart: (i: number) => void,
  jumpSegEnd: (i: number) => void,
  addSegment: UseSegments['addSegment'],
  onEditSegmentTags: (i: number) => void,
  onExtractSegmentFramesAsImages: (segIds: string[]) => Promise<void>,
  onInvertSelectedSegments: UseSegments['invertSelectedSegments'],
  onDuplicateSegmentClick: UseSegments['duplicateSegment'],
}) => {
  const { invertCutSegments, darkMode } = useUserSettings();
  const { t } = useTranslation();
  const { getSegColor } = useSegColors();

  const ref = useRef<HTMLDivElement>(null);

  const contextMenuTemplate = useMemo<ContextMenuTemplate>(() => {
    if (invertCutSegments) return [];

    const updateOrder = (dir: number) => updateSegOrder(index, index + dir);

    return [
      { label: t('Jump to start time'), click: () => jumpSegStart(index) },
      { label: t('Jump to end time'), click: () => jumpSegEnd(index) },

      { type: 'separator' },

      { label: t('Add segment'), click: addSegment },
      { label: t('Label segment'), click: () => onLabelPress(index) },
      { label: t('Remove segment'), click: () => onRemovePress(index) },
      { label: t('Duplicate segment'), click: () => onDuplicateSegmentClick(seg) },

      { type: 'separator' },

      { label: t('Select only this segment'), click: () => onSelectSingleSegment(seg) },
      { label: t('Select all segments'), click: () => onSelectAllSegments() },
      { label: t('Deselect all segments'), click: () => onDeselectAllSegments() },
      { label: t('Select segments by label'), click: () => onSelectSegmentsByLabel() },
      { label: t('Select segments by expression'), click: () => onSelectSegmentsByExpr() },
      { label: t('Invert selected segments'), click: () => onInvertSelectedSegments() },

      { type: 'separator' },

      { label: t('Label selected segments'), click: onLabelSelectedSegments },
      { label: t('Remove selected segments'), click: onRemoveSelected },
      { label: t('Edit segments by expression'), click: () => onMutateSegmentsByExpr() },

      { type: 'separator' },

      { label: t('Change segment order'), click: () => onReorderPress(index) },
      { label: t('Increase segment order'), click: () => updateOrder(1) },
      { label: t('Decrease segment order'), click: () => updateOrder(-1) },

      { type: 'separator' },

      { label: t('Segment tags'), click: () => onEditSegmentTags(index) },
      { label: t('Extract frames as image files'), click: () => onExtractSegmentFramesAsImages([seg.segId]) },
    ];
  }, [invertCutSegments, t, addSegment, onLabelSelectedSegments, onRemoveSelected, updateSegOrder, index, jumpSegStart, jumpSegEnd, onLabelPress, onRemovePress, onDuplicateSegmentClick, seg, onSelectSingleSegment, onSelectAllSegments, onDeselectAllSegments, onSelectSegmentsByLabel, onSelectSegmentsByExpr, onInvertSelectedSegments, onMutateSegmentsByExpr, onReorderPress, onEditSegmentTags, onExtractSegmentFramesAsImages]);

  useContextMenu(ref, contextMenuTemplate);

  const duration = seg.end - seg.start;
  const durationMs = duration * 1000;

  const isActive = !invertCutSegments && currentSegIndex === index;

  useDebounce(() => {
    if (isActive && ref.current) scrollIntoView(ref.current, { behavior: 'smooth', scrollMode: 'if-needed' });
  }, 300, [isActive]);

  function renderNumber() {
    if (invertCutSegments || !('segColorIndex' in seg)) return <FaSave style={{ color: saveColor, marginRight: 5, verticalAlign: 'middle' }} size={14} />;

    const segColor = getSegColor(seg);

    const color = segColor.desaturate(0.25).lightness(darkMode ? 35 : 55);
    const borderColor = darkMode ? color.lighten(0.5) : color.darken(0.3);

    return <b style={{ cursor: 'grab', color: 'white', padding: '0 4px', marginRight: 3, marginLeft: -3, background: color.string(), border: `1px solid ${isActive ? borderColor.string() : 'transparent'}`, borderRadius: 10, fontSize: 12 }}>{index + 1}</b>;
  }

  const timeStr = useMemo(() => `${formatTimecode({ seconds: seg.start })} - ${formatTimecode({ seconds: seg.end })}`, [seg.start, seg.end, formatTimecode]);

  const onDoubleClick = useCallback(() => {
    if (invertCutSegments) return;
    jumpSegStart(index);
  }, [index, invertCutSegments, jumpSegStart]);

  const durationMsFormatted = Math.floor(durationMs);
  const frameCount = getFrameCount(duration);

  const CheckIcon = selected ? FaRegCheckCircle : FaRegCircle;

  const onToggleSegmentSelectedClick = useCallback<MouseEventHandler>((e) => {
    e.stopPropagation();
    onToggleSegmentSelected(seg);
  }, [onToggleSegmentSelected, seg]);

  const cursor = invertCutSegments ? undefined : 'grab';

  const tags = useMemo(() => getSegmentTags('tags' in seg ? seg : {}), [seg]);

  const maybeOnClick = useCallback(() => !invertCutSegments && onClick(index), [index, invertCutSegments, onClick]);

  const motionStyle = useMemo<MotionStyle>(() => ({ originY: 0, margin: '5px 0', background: 'var(--gray2)', border: isActive ? '1px solid var(--gray10)' : '1px solid transparent', padding: 5, borderRadius: 5, position: 'relative' }), [isActive]);

  return (
    <motion.div
      ref={ref}
      role="button"
      onClick={maybeOnClick}
      onDoubleClick={onDoubleClick}
      layout
      style={motionStyle}
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
        {'name' in seg && seg.name && <span style={{ color: primaryTextColor, marginRight: '.3em' }}>{seg.name}</span>}
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

function SegmentList({
  width,
  formatTimecode,
  apparentCutSegments,
  inverseCutSegments,
  getFrameCount,
  onSegClick,
  currentSegIndex,
  updateSegOrder,
  updateSegOrders,
  addSegment,
  removeCutSegment,
  onRemoveSelected,
  onLabelSegment,
  currentCutSeg,
  segmentAtCursor,
  toggleSegmentsList,
  splitCurrentSegment,
  selectedSegments,
  isSegmentSelected,
  onSelectSingleSegment,
  onToggleSegmentSelected,
  onDeselectAllSegments,
  onSelectAllSegments,
  onSelectSegmentsByLabel,
  onSelectSegmentsByExpr,
  onMutateSegmentsByExpr,
  onExtractSegmentFramesAsImages,
  onLabelSelectedSegments,
  onInvertSelectedSegments,
  onDuplicateSegmentClick,
  jumpSegStart,
  jumpSegEnd,
  updateSegAtIndex,
  editingSegmentTags,
  editingSegmentTagsSegmentIndex,
  setEditingSegmentTags,
  setEditingSegmentTagsSegmentIndex,
  onEditSegmentTags,
}: {
  width: number,
  formatTimecode: FormatTimecode,
  apparentCutSegments: ApparentCutSegment[],
  inverseCutSegments: InverseCutSegment[],
  getFrameCount: GetFrameCount,
  onSegClick: (index: number) => void,
  currentSegIndex: number,
  updateSegOrder: UseSegments['updateSegOrder'],
  updateSegOrders: UseSegments['updateSegOrders'],
  addSegment: UseSegments['addSegment'],
  removeCutSegment: UseSegments['removeCutSegment'],
  onRemoveSelected: UseSegments['removeSelectedSegments'],
  onLabelSegment: UseSegments['onLabelSegment'],
  currentCutSeg: UseSegments['currentCutSeg'],
  segmentAtCursor: StateSegment | undefined,
  toggleSegmentsList: () => void,
  splitCurrentSegment: UseSegments['splitCurrentSegment'],
  selectedSegments: UseSegments['selectedSegmentsOrInverse'],
  isSegmentSelected: UseSegments['isSegmentSelected'],
  onSelectSingleSegment: UseSegments['selectOnlySegment'],
  onToggleSegmentSelected: UseSegments['toggleSegmentSelected'],
  onDeselectAllSegments: UseSegments['deselectAllSegments'],
  onSelectAllSegments: UseSegments['selectAllSegments'],
  onSelectSegmentsByLabel: UseSegments['onSelectSegmentsByLabel'],
  onSelectSegmentsByExpr: UseSegments['onSelectSegmentsByExpr'],
  onMutateSegmentsByExpr: UseSegments['onMutateSegmentsByExpr'],
  onExtractSegmentFramesAsImages: (segIds: string[]) => Promise<void>,
  onLabelSelectedSegments: UseSegments['onLabelSelectedSegments'],
  onInvertSelectedSegments: UseSegments['invertSelectedSegments'],
  onDuplicateSegmentClick: UseSegments['duplicateSegment'],
  jumpSegStart: (index: number) => void,
  jumpSegEnd: (index: number) => void,
  updateSegAtIndex: UseSegments['updateSegAtIndex'],
  editingSegmentTags: SegmentTags | undefined,
  editingSegmentTagsSegmentIndex: number | undefined,
  setEditingSegmentTags: Dispatch<SetStateAction<SegmentTags | undefined>>,
  setEditingSegmentTagsSegmentIndex: Dispatch<SetStateAction<number | undefined>>,
  onEditSegmentTags: (index: number) => void,
}) {
  const { t } = useTranslation();
  const { getSegColor } = useSegColors();

  const { invertCutSegments, simpleMode, darkMode } = useUserSettings();

  const segments: (InverseCutSegment | ApparentCutSegment)[] = invertCutSegments ? inverseCutSegments : apparentCutSegments;

  const sortableList = useMemo(() => segments.map((seg) => ({ id: seg.segId, seg })), [segments]);

  const setSortableList = useCallback((newList: typeof sortableList) => {
    if (isEqual(segments.map((s) => s.segId), newList.map((l) => l.id))) return; // No change
    updateSegOrders(newList.map((list) => list.id));
  }, [segments, updateSegOrders]);

  let header: ReactNode = t('Segments to export:');
  if (segments.length === 0) {
    header = invertCutSegments ? (
      <Trans>You have enabled the &quot;invert segments&quot; mode <FaYinYang style={{ verticalAlign: 'middle' }} /> which will cut away selected segments instead of keeping them. But there is no space between any segments, or at least two segments are overlapping. This would not produce any output. Either make room between segments or click the Yinyang <FaYinYang style={{ verticalAlign: 'middle', color: primaryTextColor }} /> symbol below to disable this mode. Alternatively you may combine overlapping segments from the menu.</Trans>
    ) : t('No segments to export.');
  }

  const onReorderSegs = useCallback(async (index: number) => {
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
  }, [apparentCutSegments.length, t, updateSegOrder]);

  function renderFooter() {
    const getButtonColor = (seg: StateSegment | undefined) => getSegColor(seg).desaturate(0.3).lightness(darkMode ? 45 : 55).string();
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

          <FaRegCheckCircle
            size={22}
            title={t('Invert selected segments')}
            role="button"
            style={{ ...buttonBaseStyle, padding: 1, background: segmentAtCursor ? segAtCursorColor : neutralButtonColor }}
            onClick={onInvertSelectedSegments}
          />
        </div>

        <div style={{ padding: '5px 10px', boxSizing: 'border-box', borderBottom: '1px solid var(gray6)', borderTop: '1px solid var(gray6)', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <div>{t('Segments total:')}</div>
          <div>{formatTimecode({ seconds: segmentsTotal })}</div>
        </div>
      </>
    );
  }

  const [editingTag, setEditingTag] = useState<string>();

  const onTagsChange = useCallback((keyValues: Record<string, string>) => setEditingSegmentTags((existingTags) => ({
    ...existingTags,
    ...keyValues,
  })), [setEditingSegmentTags]);

  const onTagReset = useCallback((tag: string) => setEditingSegmentTags((tags) => {
    if (tags == null) throw new Error();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [tag]: deleted, ...rest } = tags;
    return rest;
  }), [setEditingSegmentTags]);

  const onSegmentTagsCloseComplete = useCallback(() => {
    setEditingSegmentTagsSegmentIndex(undefined);
    setEditingSegmentTags(undefined);
  }, [setEditingSegmentTags, setEditingSegmentTagsSegmentIndex]);

  const onSegmentTagsConfirm = useCallback(() => {
    if (editingSegmentTagsSegmentIndex == null) throw new Error();
    updateSegAtIndex(editingSegmentTagsSegmentIndex, { tags: editingSegmentTags });
    onSegmentTagsCloseComplete();
  }, [editingSegmentTags, editingSegmentTagsSegmentIndex, onSegmentTagsCloseComplete, updateSegAtIndex]);

  return (
    <>
      <Dialog
        title={t('Edit segment tags')}
        isShown={editingSegmentTagsSegmentIndex != null}
        hasCancel={false}
        isConfirmDisabled={editingTag != null}
        confirmLabel={t('Save')}
        onConfirm={onSegmentTagsConfirm}
        onCloseComplete={onSegmentTagsCloseComplete}
      >
        <div style={{ color: 'black' }}>
          <TagEditor customTags={editingSegmentTags} editingTag={editingTag} setEditingTag={setEditingTag} onTagsChange={onTagsChange} onTagReset={onTagReset} addTagTitle={t('Add segment tag')} addTagText={t('Enter tag key')} />
        </div>
      </Dialog>

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

        <div style={{ padding: '0 .1em 0 .3em', overflowX: 'hidden', overflowY: 'scroll', flexGrow: 1 }} className="consistent-scrollbar">
          <ReactSortable list={sortableList} setList={setSortableList} disabled={!!invertCutSegments} handle=".segment-handle">
            {sortableList.map(({ id, seg }, index) => {
              const selected = !invertCutSegments && isSegmentSelected({ segId: seg.segId });
              return (
                <Segment
                  key={id}
                  seg={seg}
                  index={index}
                  selected={selected}
                  onClick={onSegClick}
                  addSegment={addSegment}
                  onRemoveSelected={onRemoveSelected}
                  onRemovePress={removeCutSegment}
                  onReorderPress={onReorderSegs}
                  onLabelPress={onLabelSegment}
                  jumpSegStart={jumpSegStart}
                  jumpSegEnd={jumpSegEnd}
                  updateSegOrder={updateSegOrder}
                  getFrameCount={getFrameCount}
                  formatTimecode={formatTimecode}
                  currentSegIndex={currentSegIndex}
                  onSelectSingleSegment={onSelectSingleSegment}
                  onToggleSegmentSelected={onToggleSegmentSelected}
                  onDeselectAllSegments={onDeselectAllSegments}
                  onSelectAllSegments={onSelectAllSegments}
                  onEditSegmentTags={onEditSegmentTags}
                  onSelectSegmentsByLabel={onSelectSegmentsByLabel}
                  onSelectSegmentsByExpr={onSelectSegmentsByExpr}
                  onMutateSegmentsByExpr={onMutateSegmentsByExpr}
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
    </>
  );
}

export default memo(SegmentList);
