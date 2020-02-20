import React, { memo, useState, useCallback, useEffect } from 'react';
import {
  sortableContainer,
  sortableElement,
  arrayMove,
} from 'react-sortable-hoc';
import { basename } from 'path';
import { Checkbox } from 'evergreen-ui';

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
  items: itemsProp, onChange, helperContainer, onAllStreamsChange,
}) => {
  const [items, setItems] = useState(itemsProp);
  const [allStreams, setAllStreams] = useState(false);

  useEffect(() => onAllStreamsChange(allStreams), [allStreams, onAllStreamsChange]);
  useEffect(() => onChange(items), [items, onChange]);

  const onSortEnd = useCallback(({ oldIndex, newIndex }) => {
    const newItems = arrayMove(items, oldIndex, newIndex);
    setItems(newItems);
  }, [items]);

  return (
    <div>
      <div><b>Sort your files for merge</b></div>
      <SortableContainer
        items={items}
        onSortEnd={onSortEnd}
        helperContainer={helperContainer}
        getContainer={() => helperContainer().parentNode}
        helperClass="dragging-helper-class"
      />

      <div style={{ marginTop: 10 }}>
        <Checkbox checked={allStreams} onChange={e => setAllStreams(e.target.checked)} label="Include all streams?" />
      </div>
    </div>
  );
});

export default SortableFiles;
