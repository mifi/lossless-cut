import { DragEventHandler, memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FaTimes, FaHatWizard, FaSortAlphaDown, FaSortAlphaUp } from 'react-icons/fa';
import { AiOutlineMergeCells } from 'react-icons/ai';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay, UniqueIdentifier } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

import BatchFile from './BatchFile';
import { controlsBackground, darkModeTransition, primaryColor } from '../colors';
import { BatchFile as BatchFileType } from '../types';
import useUserSettings from '../hooks/useUserSettings';


const iconStyle = {
  flexShrink: 0,
  color: 'var(--gray-12)',
  cursor: 'pointer',
  paddingTop: 3,
  paddingBottom: 3,
  padding: '3px 5px',
};

function BatchFilesList({ selectedBatchFiles, filePath, width, batchFiles, setBatchFiles, onBatchFileSelect, batchListRemoveFile, closeBatch, onMergeFilesClick, onBatchConvertToSupportedFormatClick, onDrop }: {
  selectedBatchFiles: string[],
  filePath: string | undefined,
  width: number,
  batchFiles: BatchFileType[],
  setBatchFiles: (f: BatchFileType[]) => void,
  onBatchFileSelect: (f: string) => void,
  batchListRemoveFile: (path: string | undefined) => void,
  closeBatch: () => void,
  onMergeFilesClick: () => void,
  onBatchConvertToSupportedFormatClick: () => void,
  onDrop: DragEventHandler<HTMLDivElement>,
}) {
  const { t } = useTranslation();
  const { springAnimation, simpleMode } = useUserSettings();

  const [sortDesc, setSortDesc] = useState<boolean>();
  const [draggingId, setDraggingId] = useState<UniqueIdentifier | undefined>();

  const sortableList = batchFiles.map((batchFile) => ({ id: batchFile.path, batchFile }));

  const onSortClick = useCallback(() => {
    const newSortDesc = sortDesc == null ? false : !sortDesc;
    const sortedFiles = [...batchFiles];
    const order = newSortDesc ? -1 : 1;
    // natural language sort (numeric) https://github.com/mifi/lossless-cut/issues/844
    sortedFiles.sort((a, b) => order * a.name.localeCompare(b.name, 'en-US', { numeric: true }));
    setBatchFiles(sortedFiles);
    setSortDesc(newSortDesc);
  }, [batchFiles, setBatchFiles, sortDesc]);

  const SortIcon = sortDesc ? FaSortAlphaDown : FaSortAlphaUp;

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: {
      distance: 10,
    },
  }));

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
      setBatchFiles(newList.map((item) => item.batchFile));
    }
  };

  const draggingFile = useMemo(() => sortableList.find((s) => s.id === draggingId), [sortableList, draggingId]);

  return (
    <motion.div
      className="no-user-select"
      style={{ width, background: controlsBackground, color: 'var(--gray-12)', borderRight: '1px solid var(--gray-7)', transition: darkModeTransition, display: 'flex', flexDirection: 'column', overflowY: 'hidden', overflowX: 'hidden', resize: 'horizontal' }}
      initial={{ x: -width }}
      animate={{ x: 0 }}
      exit={{ x: -width }}
      transition={springAnimation}
      onDrop={onDrop}
    >
      <div style={{ paddingBottom: '.5em', paddingTop: 0, paddingLeft: '.5em', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '.2em' }}>
        <div style={{ fontSize: '.9em' }}>{t('Batch file list')}{batchFiles.length > 0 && ` (${batchFiles.length})`}</div>
        <div style={{ flexGrow: 1 }} />
        <FaHatWizard role="button" title={`${t('Convert to supported format')}...`} style={iconStyle} onClick={onBatchConvertToSupportedFormatClick} />
        <SortIcon role="button" title={t('Sort items')} style={iconStyle} onClick={onSortClick} />
        <AiOutlineMergeCells className={simpleMode ? 'export-animation' : undefined} role="button" title={`${t('Merge/concatenate files')}...`} style={{ ...iconStyle, color: 'white', background: primaryColor, borderRadius: '.5em' }} onClick={onMergeFilesClick} />
        <FaTimes role="button" title={t('Close batch')} style={{ ...iconStyle, color: 'var(--gray-11)' }} onClick={closeBatch} />
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} onDragStart={handleDragStart} modifiers={[restrictToVerticalAxis]}>
        <SortableContext items={sortableList} strategy={verticalListSortingStrategy}>
          <div style={{ overflowX: 'hidden', overflowY: 'auto' }}>
            {sortableList.map(({ batchFile: { path, name } }, index) => (
              <BatchFile key={path} index={index} path={path} name={name} isSelected={selectedBatchFiles.includes(path)} isOpen={filePath === path} onSelect={onBatchFileSelect} onDelete={batchListRemoveFile} />
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {draggingFile ? <BatchFile dragging index={sortableList.indexOf(draggingFile)} path={draggingFile.batchFile.path} name={draggingFile.batchFile.name} /> : null}
        </DragOverlay>
      </DndContext>
    </motion.div>
  );
}

export default memo(BatchFilesList);
