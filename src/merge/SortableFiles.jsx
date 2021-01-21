import React, { memo, useState, useCallback, useEffect } from 'react';
import {
  sortableContainer,
  sortableElement,
  arrayMove,
} from 'react-sortable-hoc';
import { basename } from 'path';
import { Checkbox } from 'evergreen-ui';
import { useTranslation } from 'react-i18next';

const rowStyle = {
  padding: 5, fontSize: 14, margin: '7px 0', boxShadow: '0 0 5px 0px rgba(0,0,0,0.3)', overflowY: 'auto', whiteSpace: 'nowrap',
};

const SortableItem = sortableElement(({ value, sortIndex }) => (
  <div style={rowStyle} title={value}>
    {sortIndex + 1}
    {'. '}
    {basename(value)}
  </div>
));

const SortableContainer = sortableContainer(({ items }) => (
  <div>
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

  useEffect(() => onAllStreamsChange(allStreams), [allStreams, onAllStreamsChange]);
  useEffect(() => onSegmentsToChaptersChange(segmentsToChapters), [segmentsToChapters, onSegmentsToChaptersChange]);
  useEffect(() => onChange(items), [items, onChange]);

  const onSortEnd = useCallback(({ oldIndex, newIndex }) => {
    const newItems = arrayMove(items, oldIndex, newIndex);
    setItems(newItems);
  }, [items]);

  const { t } = useTranslation();


  return (
    <div>
      <div><b>{t('Merge/concatenate files')}</b></div>

      <div style={{ whiteSpace: 'pre-wrap', textAlign: 'left', fontSize: 14 }}>{t('This dialog can be used to concatenate files in series, e.g. one after the other:\n[file1][file2][file3]\nIt can NOT be used for merging tracks in parallell (like adding an audio track to a video).\nMake sure all files are of the exact same codecs & codec parameters (fps, resolution etc).\n\nDrag and drop to change the order of your files here:')}</div>
      <SortableContainer
        items={items}
        onSortEnd={onSortEnd}
        helperContainer={helperContainer}
        getContainer={() => helperContainer().parentNode}
        helperClass="dragging-helper-class"
      />

      <div style={{ marginTop: 10 }}>
        <div>
          <Checkbox checked={allStreams} onChange={e => setAllStreams(e.target.checked)} label={t('Include all tracks?')} />
          <div style={{ fontSize: 12, textAlign: 'left' }}>{t('If this is checked, all audio/video/subtitle/data tracks will be included. This may not always work for all file types. If not checked, only default streams will be included.')}</div>
        </div>

        <div>
          <Checkbox checked={segmentsToChapters} onChange={e => setSegmentsToChapters(e.target.checked)} label={t('Create chapters from merged segments? (slow)')} />
        </div>
      </div>
    </div>
  );
});

export default SortableFiles;
