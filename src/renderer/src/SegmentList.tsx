import type { SetStateAction, Dispatch, MouseEventHandler, CSSProperties } from 'react';
import { memo, useMemo, useRef, useCallback, useState, useEffect } from 'react';
import { FaYinYang } from 'react-icons/fa';
import { LuArrowDown01, LuCircle, LuCircleCheck, LuListChecks, LuMinus, LuPlus, LuSave, LuSquareSplitHorizontal, LuTag, LuX } from 'react-icons/lu';
import { motion } from 'motion/react';
import { useTranslation, Trans } from 'react-i18next';
import type { DragEndEvent, DragStartEvent, UniqueIdentifier } from '@dnd-kit/core';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { useVirtualizer } from '@tanstack/react-virtual';
import { CSS } from '@dnd-kit/utilities';
import invariant from 'tiny-invariant';
import prettyBytes from 'pretty-bytes';

import useContextMenu from './hooks/useContextMenu';
import useUserSettings from './hooks/useUserSettings';
import useActionTitle from './hooks/useActionTitle';
import { saveColor, darkModeTransition } from './colors';
import { useSegColors } from './contexts';
import { getSegmentTags } from './segments';
import TagEditor, { cancelTagEditOnEscape } from './components/TagEditor';
import type { ContextMenuTemplate, DefiniteSegmentBase, FormatTimecode, GetFrameCount, InverseCutSegment, SegmentBase, SegmentColorIndex, SegmentTags, StateSegment } from './types';
import type { UseSegments } from './hooks/useSegments';
import * as Dialog from './components/Dialog';
import { DialogButton } from './components/Button';
import getSwal from './swal';
import styles from './SegmentList.module.css';


// eslint-disable-next-line react/display-name
const Segment = memo(({
  seg,
  index,
  isActive,
  dragging,
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
  onSelectAllMarkers,
  onSelectAllSegments,
  onMutateSegmentsByExpr,
  jumpSegStart,
  jumpSegEnd,
  addSegment,
  onEditSegmentTags,
  onExtractSegmentsFramesAsImages,
  onExtractSelectedSegmentsFramesAsImages,
  onInvertSelectedSegments,
  onDuplicateSegmentClick,
  getSegEstimatedSize,
}: {
  seg: StateSegment | InverseCutSegment,
  index: number,
  isActive?: boolean | undefined,
  dragging?: boolean | undefined,
  formatTimecode: FormatTimecode,
  getFrameCount: GetFrameCount,
  updateSegOrder: UseSegments['updateSegOrder'],
  onClick: (i: number) => void,
  onRemovePress: UseSegments['removeSegment'],
  onRemoveSelected: UseSegments['removeSelectedSegments'],
  onLabelSelectedSegments: UseSegments['labelSelectedSegments'],
  onReorderPress: (i: number) => Promise<void>,
  onLabelPress: UseSegments['labelSegment'],
  selected: boolean | undefined,
  onSelectSingleSegment: UseSegments['selectOnlySegment'],
  onToggleSegmentSelected: UseSegments['toggleSegmentSelected'],
  onDeselectAllSegments: UseSegments['deselectAllSegments'],
  onSelectSegmentsByLabel: UseSegments['selectSegmentsByLabel'],
  onSelectSegmentsByExpr: UseSegments['selectSegmentsByExpr'],
  onSelectAllMarkers: UseSegments['selectAllMarkers'],
  onSelectAllSegments: UseSegments['selectAllSegments'],
  onMutateSegmentsByExpr: UseSegments['mutateSegmentsByExpr'],
  jumpSegStart: (i: number) => void,
  jumpSegEnd: (i: number) => void,
  addSegment: UseSegments['addSegment'],
  onEditSegmentTags: (i: number) => void,
  onExtractSegmentsFramesAsImages: (segments: Pick<SegmentBase, 'start' | 'end'>[]) => Promise<void>,
  onExtractSelectedSegmentsFramesAsImages: () => void,
  onInvertSelectedSegments: UseSegments['invertSelectedSegments'],
  onDuplicateSegmentClick: UseSegments['duplicateSegment'],
  getSegEstimatedSize: UseSegments['getSegEstimatedSize'],
}) => {
  const { invertCutSegments, darkMode } = useUserSettings();
  const { t } = useTranslation();
  const { getSegColor } = useSegColors();

  const ref = useRef<HTMLDivElement | null>(null);

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
      { label: t('Select all markers'), click: () => onSelectAllMarkers() },
      { label: t('Select segments by label'), click: () => onSelectSegmentsByLabel() },
      { label: t('Select segments by expression'), click: () => onSelectSegmentsByExpr() },
      { label: t('Invert selected segments'), click: () => onInvertSelectedSegments() },

      { type: 'separator' },

      { label: t('Label selected segments'), click: onLabelSelectedSegments },
      { label: t('Edit segments by expression'), click: () => onMutateSegmentsByExpr() },
      { label: t('Extract frames from selected segments as image files'), click: onExtractSelectedSegmentsFramesAsImages },
      { label: t('Remove selected segments'), click: onRemoveSelected },

      { type: 'separator' },

      { label: t('Change segment order'), click: () => onReorderPress(index) },
      { label: t('Increase segment order'), click: () => updateOrder(1) },
      { label: t('Decrease segment order'), click: () => updateOrder(-1) },

      { type: 'separator' },

      { label: t('Segment tags'), click: () => onEditSegmentTags(index) },
      { label: t('Extract segment frames as image files'), click: () => onExtractSegmentsFramesAsImages([seg]) },
    ];
  }, [invertCutSegments, t, addSegment, onLabelSelectedSegments, onRemoveSelected, onExtractSelectedSegmentsFramesAsImages, updateSegOrder, index, jumpSegStart, jumpSegEnd, onLabelPress, onRemovePress, onDuplicateSegmentClick, seg, onSelectSingleSegment, onSelectAllSegments, onDeselectAllSegments, onSelectAllMarkers, onSelectSegmentsByLabel, onSelectSegmentsByExpr, onInvertSelectedSegments, onMutateSegmentsByExpr, onReorderPress, onEditSegmentTags, onExtractSegmentsFramesAsImages]);

  useContextMenu(ref, contextMenuTemplate);

  const duration = useMemo(() => (seg.end == null ? undefined : seg.end - seg.start), [seg]);
  const estimatedSize = useMemo(() => getSegEstimatedSize(seg), [getSegEstimatedSize, seg]);

  const timeStr = useMemo(() => (
    seg.end == null
      ? formatTimecode({ seconds: seg.start })
      : `${formatTimecode({ seconds: seg.start })} → ${formatTimecode({ seconds: seg.end })}`
  ), [formatTimecode, seg]);

  function renderNumber() {
    if (invertCutSegments || !('segColorIndex' in seg)) {
      return <LuSave style={{ color: saveColor, marginRight: '.2em', verticalAlign: 'middle' }} size={14} />;
    }

    return (
      <b className={styles['number']} style={{ background: getSegColor(seg).string(), color: '#15121f' }}>
        {index + 1}
      </b>
    );
  }

  const onDoubleClick = useCallback(() => {
    if (invertCutSegments) return;
    jumpSegStart(index);
  }, [index, invertCutSegments, jumpSegStart]);

  const CheckIcon = selected ? LuCircleCheck : LuCircle;

  const onToggleSegmentSelectedClick = useCallback<MouseEventHandler>((e) => {
    e.stopPropagation();
    onToggleSegmentSelected(seg);
  }, [onToggleSegmentSelected, seg]);

  const cursor = invertCutSegments ? undefined : (dragging ? 'grabbing' : 'grab');

  const tags = useMemo(() => getSegmentTags('tags' in seg ? seg : {}), [seg]);

  const handleSegmentClick = useCallback<MouseEventHandler<HTMLDivElement>>((e) => {
    e.currentTarget.blur();
    if (!invertCutSegments) onClick(index);
  }, [index, invertCutSegments, onClick]);

  const handleDraggableClick = useCallback<MouseEventHandler<HTMLDivElement>>((e) => {
    e.currentTarget.blur();
  }, []);

  const sortable = useSortable({
    id: seg.segId,
    transition: {
      duration: 150,
      easing: 'ease-in-out',
    },
    disabled: invertCutSegments,
  });

  const style = useMemo<CSSProperties>(() => {
    const transitions = [
      ...(sortable.transition ? [sortable.transition] : []),
      'opacity 100ms ease-out',
    ];
    return {
      visibility: sortable.isDragging ? 'hidden' : undefined,
      originY: 0,
      transform: CSS.Transform.toString(sortable.transform),
      transition: transitions.length > 0 ? transitions.join(', ') : undefined,
      opacity: !selected && !invertCutSegments ? 0.5 : undefined,
    };
  }, [invertCutSegments, selected, sortable.isDragging, sortable.transform, sortable.transition]);

  const barColor = useMemo(() => (invertCutSegments || !('segColorIndex' in seg) ? saveColor : getSegColor(seg).desaturate(0.2).lightness(darkMode ? 60 : 50).string()), [darkMode, getSegColor, invertCutSegments, seg]);

  const setRef = useCallback((node: HTMLDivElement | null) => {
    sortable.setNodeRef(node);
    ref.current = node;
  }, [sortable]);

  const name = 'name' in seg && seg.name ? seg.name : undefined;

  return (
    <div
      ref={setRef}
      role="button"
      onClick={handleSegmentClick}
      onDoubleClick={onDoubleClick}
      style={style}
      className={['segment-list-entry', styles['card'], ...(isActive ? [styles['active']] : [])].join(' ')}
    >
      <div className={styles['colorBar']} style={{ background: barColor }} />

      <div
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...sortable.attributes}
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...sortable.listeners}
        role="button"
        tabIndex={-1}
        style={{ cursor }}
        onClick={handleDraggableClick}
      >
        <div className={styles['row']}>
          {renderNumber()}
          {name ? (
            <span className={styles['name']}>{name}</span>
          ) : (
            <span className={`llc-mono ${styles['name']}`} style={{ fontWeight: 500, fontSize: '.7em' }}>{timeStr}</span>
          )}
          {name && duration != null && (
            <span className={`llc-mono ${styles['duration']}`} title={t('Duration')}>{formatTimecode({ seconds: duration, shorten: true })}</span>
          )}
        </div>

        {name && <div className={`llc-mono ${styles['range']}`}>{timeStr}</div>}
      </div>

      {Object.entries(tags).map(([tagName, value]) => (
        <span className={styles['tag']} key={tagName}>{tagName}: <b>{value}</b></span>
      ))}

      {duration != null && (
        <div className={styles['details']}>
          {!name && <span className={`llc-mono ${styles['duration']}`} style={{ marginRight: '.6em', fontSize: '1em' }} title={t('Duration')}>{formatTimecode({ seconds: duration, shorten: true })}</span>}
          <Trans>{{ durationMsFormatted: Math.floor(duration * 1000) }} ms</Trans>
          <span>, <Trans>{{ frameCount: (duration && getFrameCount(duration)) ?? '?' }} frames</Trans></span>
          {estimatedSize != null && (
            <span>
              , ~{prettyBytes(estimatedSize, { space: false, maximumFractionDigits: 1, minimumFractionDigits: 0 })}
            </span>
          )}
        </div>
      )}

      {!invertCutSegments && selected != null && (
        <div className={styles['check']}>
          <CheckIcon className="selected" size={17} onClick={onToggleSegmentSelectedClick} />
        </div>
      )}
    </div>
  );
});

function SegmentList({
  width,
  formatTimecode,
  cutSegments,
  inverseCutSegments,
  getFrameCount,
  onSegClick,
  currentSegIndex,
  updateSegOrder,
  updateSegOrders,
  addSegment,
  removeSegment,
  onRemoveSelected,
  onLabelSegment,
  firstSegmentAtCursor,
  toggleSegmentsList,
  splitCurrentSegment,
  selectedSegments,
  onSelectSingleSegment,
  onToggleSegmentSelected,
  onDeselectAllSegments,
  onSelectAllSegments,
  onSelectSegmentsByLabel,
  onSelectSegmentsByExpr,
  onMutateSegmentsByExpr,
  onSelectAllMarkers,
  onExtractSegmentsFramesAsImages,
  onExtractSelectedSegmentsFramesAsImages,
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
  getSegEstimatedSize,
}: {
  width: number,
  formatTimecode: FormatTimecode,
  cutSegments: StateSegment[],
  inverseCutSegments: InverseCutSegment[],
  getFrameCount: GetFrameCount,
  onSegClick: (index: number) => void,
  currentSegIndex: number,
  updateSegOrder: UseSegments['updateSegOrder'],
  updateSegOrders: UseSegments['updateSegOrders'],
  addSegment: UseSegments['addSegment'],
  removeSegment: UseSegments['removeSegment'],
  onRemoveSelected: UseSegments['removeSelectedSegments'],
  onLabelSegment: UseSegments['labelSegment'],
  firstSegmentAtCursor: StateSegment | undefined,
  toggleSegmentsList: () => void,
  splitCurrentSegment: UseSegments['splitCurrentSegment'],
  selectedSegments: DefiniteSegmentBase[],
  onSelectSingleSegment: UseSegments['selectOnlySegment'],
  onToggleSegmentSelected: UseSegments['toggleSegmentSelected'],
  onDeselectAllSegments: UseSegments['deselectAllSegments'],
  onSelectAllSegments: UseSegments['selectAllSegments'],
  onSelectSegmentsByLabel: UseSegments['selectSegmentsByLabel'],
  onSelectSegmentsByExpr: UseSegments['selectSegmentsByExpr'],
  onSelectAllMarkers: UseSegments['selectAllMarkers'],
  onMutateSegmentsByExpr: UseSegments['mutateSegmentsByExpr'],
  onExtractSegmentsFramesAsImages: (segments: Pick<SegmentBase, 'start' | 'end'>[]) => Promise<void>,
  onExtractSelectedSegmentsFramesAsImages: () => void,
  onLabelSelectedSegments: UseSegments['labelSelectedSegments'],
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
  getSegEstimatedSize: UseSegments['getSegEstimatedSize'],
}) {
  const { t } = useTranslation();
  const { getSegColor, nextSegColorIndex } = useSegColors();
  const [draggingId, setDraggingId] = useState<UniqueIdentifier | undefined>();

  const { invertCutSegments, simpleMode, darkMode, springAnimation } = useUserSettings();
  const actionTitle = useActionTitle();

  const getButtonColor = useCallback((seg: SegmentColorIndex | undefined, next?: boolean) => getSegColor(seg ? { segColorIndex: next ? seg.segColorIndex + 1 : seg.segColorIndex } : undefined).desaturate(0.3).lightness(darkMode ? 45 : 55).string(), [darkMode, getSegColor]);
  const segAtCursorColor = useMemo(() => getButtonColor(firstSegmentAtCursor), [getButtonColor, firstSegmentAtCursor]);
  const nextSegmentColor = useMemo(() => getButtonColor({ segColorIndex: nextSegColorIndex }, false), [getButtonColor, nextSegColorIndex]);

  const segmentsTotal = useMemo(() => selectedSegments.reduce((acc, seg) => (seg.end == null ? 0 : seg.end - seg.start) + acc, 0), [selectedSegments]);

  const segmentsOrInverse: (InverseCutSegment | StateSegment)[] = invertCutSegments ? inverseCutSegments : cutSegments;

  const sortableList = useMemo(() => segmentsOrInverse.map((seg) => ({ id: seg.segId, seg })), [segmentsOrInverse]);

  const isOnlyMarkers = useMemo(() => segmentsOrInverse.length > 0 && segmentsOrInverse.every((seg) => seg.end == null), [segmentsOrInverse]);

  function getHeader() {
    if (segmentsOrInverse.length === 0) {
      if (invertCutSegments) {
        return (
          <Trans>You have enabled the &quot;invert segments&quot; mode <FaYinYang style={{ verticalAlign: 'middle' }} /> which will cut away selected segments instead of keeping them. But there is no space between any segments, or at least two segments are overlapping. This would not produce any output. Either make room between segments or click the Yinyang <FaYinYang style={{ verticalAlign: 'middle' }} /> symbol below to disable this mode. Alternatively you may combine overlapping segments from the menu.</Trans>
        );
      }
      return t('No segments to export.');
    }

    if (isOnlyMarkers) {
      return t('Markers:');
    }
    return t('Segments to export:');
  }

  const onReorderSegs = useCallback(async (index: number) => {
    if (cutSegments.length < 2) return;
    const { value } = await getSwal().Swal.fire({
      title: `${t('Change order of segment')} ${index + 1}`,
      text: t('Please enter a number from 1 to {{n}} to be the new order for the current segment', { n: cutSegments.length }),
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
  }, [cutSegments.length, t, updateSegOrder]);

  function renderFooter() {
    return (
      <>
        <div className={styles['actions']}>
          <button
            type="button"
            className={styles['addButton']}
            style={{ background: nextSegmentColor }}
            title={actionTitle(t('Add segment'), 'addSegment')}
            onClick={addSegment}
          >
            <LuPlus size={15} />
            {t('Add segment')}
          </button>

          <button
            type="button"
            className="llc-icon-button"
            aria-disabled={cutSegments.length === 0}
            title={actionTitle(t('Remove cutpoint from segment {{segmentNumber}}', { segmentNumber: currentSegIndex + 1 }), 'removeCurrentCutpoint')}
            onClick={() => removeSegment(currentSegIndex)}
          >
            <LuMinus size={16} />
          </button>

          {!invertCutSegments && !simpleMode && (
            <>
              <button
                type="button"
                className="llc-icon-button"
                aria-disabled={cutSegments.length < 2}
                title={actionTitle(t('Change segment order'), 'reorderSegsByStartTime')}
                onClick={() => onReorderSegs(currentSegIndex)}
              >
                <LuArrowDown01 size={16} />
              </button>

              <button
                type="button"
                className="llc-icon-button"
                aria-disabled={cutSegments.length === 0}
                title={actionTitle(t('Label segment'), 'labelCurrentSegment')}
                onClick={() => onLabelSegment(currentSegIndex)}
              >
                <LuTag size={15} />
              </button>
            </>
          )}

          <button
            type="button"
            className="llc-icon-button"
            aria-disabled={!firstSegmentAtCursor}
            style={firstSegmentAtCursor ? { color: segAtCursorColor } : undefined}
            title={actionTitle(t('Split segment at cursor'), 'splitCurrentSegment')}
            onClick={splitCurrentSegment}
          >
            <LuSquareSplitHorizontal size={16} />
          </button>

          {!invertCutSegments && (
            <button
              type="button"
              className="llc-icon-button"
              aria-disabled={cutSegments.length === 0}
              title={actionTitle(t('Invert segment selection'), 'invertSelectedSegments')}
              onClick={onInvertSelectedSegments}
            >
              <LuListChecks size={16} />
            </button>
          )}
        </div>

        <div className={styles['total']}>
          <div>{t('Segments total:')}</div>
          <div className={`llc-mono ${styles['totalValue']}`}>{formatTimecode({ seconds: segmentsTotal })}</div>
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
    invariant(tags != null);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [tag]: _deleted, ...rest } = tags;
    return rest;
  }), [setEditingSegmentTags]);

  const onSegmentTagsCloseComplete = useCallback(() => {
    setEditingSegmentTagsSegmentIndex(undefined);
    setEditingSegmentTags(undefined);
  }, [setEditingSegmentTags, setEditingSegmentTagsSegmentIndex]);

  const onSegmentTagsConfirm = useCallback(() => {
    invariant(editingSegmentTagsSegmentIndex != null);
    updateSegAtIndex(editingSegmentTagsSegmentIndex, { tags: editingSegmentTags });
    onSegmentTagsCloseComplete();
  }, [editingSegmentTags, editingSegmentTagsSegmentIndex, onSegmentTagsCloseComplete, updateSegAtIndex]);

  const scrollerRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: {
      distance: 10,
    },
  }));

  // todo https://github.com/TanStack/virtual/issues/1119
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: sortableList.length,
    gap: 7,
    getScrollElement: () => scrollerRef.current,
    estimateSize: () => 66, // todo this probably needs to be changed if the segment height changes
    overscan: 5,
    getItemKey: (index) => sortableList[index]!.id,
  });

  useEffect(() => {
    if (invertCutSegments) return;
    rowVirtualizer.scrollToIndex(currentSegIndex, { behavior: 'smooth', align: 'auto' });
  }, [currentSegIndex, invertCutSegments, rowVirtualizer]);

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingId(event.active.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingId(undefined);
    const { active, over } = event;
    if (over != null && active.id !== over?.id) {
      const ids = sortableList.map((s) => s.id);
      const oldIndex = ids.indexOf(active.id as string);
      const newIndex = ids.indexOf(over.id as string);
      const newList = arrayMove(sortableList, oldIndex, newIndex);
      updateSegOrders(newList.map((item) => item.id));
    }
  };

  const draggingSeg = useMemo(() => sortableList.find((s) => s.id === draggingId), [sortableList, draggingId]);

  function renderSegment({ seg, index, selected, isActive, dragging }: {
    seg: StateSegment | InverseCutSegment,
    index: number,
    selected?: boolean,
    isActive?: boolean,
    dragging?: boolean,
  }) {
    return (
      <Segment
        seg={seg}
        index={index}
        isActive={isActive}
        dragging={dragging}
        selected={selected}
        onClick={onSegClick}
        addSegment={addSegment}
        onRemoveSelected={onRemoveSelected}
        onRemovePress={removeSegment}
        onReorderPress={onReorderSegs}
        onLabelPress={onLabelSegment}
        jumpSegStart={jumpSegStart}
        jumpSegEnd={jumpSegEnd}
        updateSegOrder={updateSegOrder}
        getFrameCount={getFrameCount}
        formatTimecode={formatTimecode}
        onSelectSingleSegment={onSelectSingleSegment}
        onToggleSegmentSelected={onToggleSegmentSelected}
        onDeselectAllSegments={onDeselectAllSegments}
        onSelectAllSegments={onSelectAllSegments}
        onEditSegmentTags={onEditSegmentTags}
        onSelectSegmentsByLabel={onSelectSegmentsByLabel}
        onSelectSegmentsByExpr={onSelectSegmentsByExpr}
        onMutateSegmentsByExpr={onMutateSegmentsByExpr}
        onExtractSegmentsFramesAsImages={onExtractSegmentsFramesAsImages}
        onExtractSelectedSegmentsFramesAsImages={onExtractSelectedSegmentsFramesAsImages}
        onLabelSelectedSegments={onLabelSelectedSegments}
        onSelectAllMarkers={onSelectAllMarkers}
        onInvertSelectedSegments={onInvertSelectedSegments}
        onDuplicateSegmentClick={onDuplicateSegmentClick}
        getSegEstimatedSize={getSegEstimatedSize}
      />
    );
  }

  return (
    <>
      <Dialog.Root open={editingSegmentTagsSegmentIndex != null} onOpenChange={(open) => !open && onSegmentTagsCloseComplete()}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content style={{ width: '40em' }} aria-describedby={undefined} onEscapeKeyDown={cancelTagEditOnEscape(editingTag, setEditingTag)}>
            <Dialog.Title>{t('Edit segment tags')}</Dialog.Title>

            <TagEditor customTags={editingSegmentTags} editingTag={editingTag} setEditingTag={setEditingTag} onTagsChange={onTagsChange} onTagReset={onTagReset} addTagTitle={t('Add segment tag')} />

            <Dialog.ButtonRow>
              <DialogButton onClick={onSegmentTagsConfirm} disabled={editingTag != null} primary>
                <LuSave style={{ verticalAlign: 'baseline', fontSize: '.8em', marginRight: '.3em' }} />
                {t('Save')}
              </DialogButton>
            </Dialog.ButtonRow>

            <Dialog.CloseButton />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <motion.div
        className={`llc-panel ${styles['panel']}`}
        style={{ width, flexShrink: 0, transition: darkModeTransition }}
        initial={{ x: width }}
        animate={{ x: 0 }}
        exit={{ x: width }}
        transition={springAnimation}
      >
        <div className={`no-user-select ${styles['header']}`}>
          <span className={styles['title']}>
            {getHeader()}
            {segmentsOrInverse.length > 0 && <span className={styles['subtitle']}>{segmentsOrInverse.length}</span>}
          </span>

          <button type="button" className="llc-icon-button" title={actionTitle(t('Close sidebar'), 'toggleSegmentsList')} onClick={toggleSegmentsList}>
            <LuX size={16} />
          </button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} onDragStart={handleDragStart} modifiers={[restrictToVerticalAxis]}>
          <SortableContext items={sortableList} strategy={verticalListSortingStrategy}>
            <div ref={scrollerRef} style={{ padding: '0 .3em 0 .6em', overflowX: 'hidden', overflowY: 'scroll', flexGrow: 1 }} className="consistent-scrollbar">
              <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative', overflow: 'hidden' }}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const { id, seg } = sortableList[virtualRow.index]!;
                  const selected = 'selected' in seg ? seg.selected : true;
                  const isActive = !invertCutSegments && currentSegIndex === virtualRow.index;

                  return (
                    <div
                      key={id}
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      {renderSegment({ seg, index: virtualRow.index, selected, isActive })}
                    </div>
                  );
                })}
              </div>
            </div>
          </SortableContext>

          <DragOverlay>
            {draggingSeg ? renderSegment({ seg: draggingSeg.seg, index: sortableList.indexOf(draggingSeg), dragging: true }) : null}
          </DragOverlay>
        </DndContext>

        {isOnlyMarkers && (
          <div style={{ padding: '1em .7em', color: 'var(--gray-11)', fontSize: '.85em' }}>
            {t('Markers are segments without an end time and will not be exported. Convert markers to segments by setting their end time.')}
          </div>
        )}

        {renderFooter()}
      </motion.div>
    </>
  );
}

export default memo(SegmentList);
