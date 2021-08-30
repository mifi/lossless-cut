import React, { memo, useState, useCallback, useEffect } from 'react';
import { sortableContainer, sortableElement } from 'react-sortable-hoc';
import { basename } from 'path';
import { Pane, Checkbox, SortAlphabeticalIcon, SortAlphabeticalDescIcon, IconButton } from 'evergreen-ui';
import { useTranslation } from 'react-i18next';
import arrayMove from 'array-move';
import orderBy from 'lodash/orderBy';

const rowStyle = {
  padding: '3px 10px', fontSize: 14, margin: '7px 0', overflowY: 'auto', whiteSpace: 'nowrap', cursor: 'grab',
};

const SortableItem = sortableElement(({ value, sortIndex }) => (
  <Pane elevation={1} style={rowStyle} title={value}>
    {sortIndex + 1}
    {'. '}
    {basename(value)}
  </Pane>
));

const SortableContainer = sortableContainer(({ items }) => (
  <div style={{ padding: '0 3px' }}>
    {items.map((value, index) => (
      <SortableItem key={value} index={index} sortIndex={index} value={value} />
    ))}
  </div>
));

const SortableFiles = memo(({
  items: itemsProp, onChange, helperContainer, onAllStreamsChange, onSegmentsToChaptersChange,
}) => {
  const [items, setItems] = useState(itemsProp);
  const [allStreams, setAllStreams] = useState(false);
  const [segmentsToChapters, setSegmentsToChapters] = useState(false);
  const [sortDesc, setSortDesc] = useState();

  useEffect(() => onAllStreamsChange(allStreams), [allStreams, onAllStreamsChange]);
  useEffect(() => onSegmentsToChaptersChange(segmentsToChapters), [segmentsToChapters, onSegmentsToChaptersChange]);
  useEffect(() => onChange(items), [items, onChange]);

  const onSortEnd = useCallback(({ oldIndex, newIndex }) => {
    const newItems = arrayMove(items, oldIndex, newIndex);
    setItems(newItems);
  }, [items]);

  const { t } = useTranslation();

  function onSortClick() {
    const newSortDesc = sortDesc == null ? false : !sortDesc;
    setItems(orderBy(items, undefined, [newSortDesc ? 'desc' : 'asc']));
    setSortDesc(newSortDesc);
  }

  return (
    <div style={{ textAlign: 'left' }}>
      <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, marginBottom: 10 }}>{t('This dialog can be used to concatenate files in series, e.g. one after the other:\n[file1][file2][file3]\nIt can NOT be used for merging tracks in parallell (like adding an audio track to a video).\nMake sure all files are of the exact same codecs & codec parameters (fps, resolution etc).\n\nDrag and drop to change the order of your files here:')}</div>

      <SortableContainer
        items={items}
        onSortEnd={onSortEnd}
        helperContainer={helperContainer}
        getContainer={() => helperContainer().parentNode}
        helperClass="dragging-helper-class"
      />

      <div style={{ marginTop: 10 }}>
        <Checkbox checked={allStreams} onChange={e => setAllStreams(e.target.checked)} label={`${t('Include all tracks?')} ${t('If this is checked, all audio/video/subtitle/data tracks will be included. This may not always work for all file types. If not checked, only default streams will be included.')}`} />

        <Checkbox checked={segmentsToChapters} onChange={e => setSegmentsToChapters(e.target.checked)} label={t('Create chapters from merged segments? (slow)')} />

        <div>
          <IconButton icon={sortDesc ? SortAlphabeticalDescIcon : SortAlphabeticalIcon} onClick={onSortClick} />
        </div>
      </div>
    </div>
  );
});

export default SortableFiles;
