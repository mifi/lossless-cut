import { memo, useRef, useMemo, useCallback, CSSProperties, MouseEventHandler } from 'react';
import { useTranslation } from 'react-i18next';
import { FaFile, FaTimes } from 'react-icons/fa';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import useContextMenu from '../hooks/useContextMenu';
import { dangerColor, primaryTextColor } from '../colors';

function BatchFile({ path, index, isOpen, isSelected, name, onSelect, onDelete, dragging }: {
  path: string,
  index: number,
  isOpen?: boolean,
  isSelected?: boolean,
  name: string,
  onSelect?: (a: string) => void,
  onDelete?: (a: string) => void,
  dragging?: boolean,
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  const { t } = useTranslation();
  const contextMenuTemplate = useMemo(() => [
    { label: t('Remove'), click: () => onDelete?.(path) },
  ], [t, onDelete, path]);

  useContextMenu(ref, contextMenuTemplate);

  const sortable = useSortable({
    id: path,
    transition: {
      duration: 150,
      easing: 'ease-in-out',
    },
  });

  const setRef = useCallback((node: HTMLDivElement | null) => {
    sortable.setNodeRef(node);
    ref.current = node;
  }, [sortable]);

  const style = useMemo<CSSProperties>(() => ({
    visibility: sortable.isDragging ? 'hidden' : undefined,
    opacity: dragging ? 0.6 : 1,
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    background: isSelected ? 'var(--gray-7)' : undefined,
    cursor: dragging ? 'grabbing' : 'default',
    fontSize: 13,
    padding: '.2em .2em .2em .4em',
    display: 'flex',
    alignItems: 'center',
    alignContent: 'flex-start',
    borderRight: `.3em solid ${isOpen ? 'var(--gray-8)' : 'transparent'}`,
  }), [sortable.isDragging, sortable.transform, sortable.transition, dragging, isSelected, isOpen]);

  const handleClick = useCallback<MouseEventHandler<HTMLDivElement>>((e) => {
    onSelect?.(path);
    e.currentTarget.blur();
  }, [onSelect, path]);

  return (
    <div
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...sortable.attributes}
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...sortable.listeners}
      ref={setRef}
      role="button"
      tabIndex={-1}
      style={style}
      title={path}
      onClick={handleClick}
    >
      <FaFile style={{ color: isSelected ? primaryTextColor : undefined, flexShrink: 0, fontSize: '1em', marginRight: '.1em' }} />
      <div style={{ flexShrink: 0, marginRight: '.1em' }}>{index + 1}.</div>
      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', direction: 'rtl' }}>
        <span style={{ direction: 'ltr', unicodeBidi: 'isolate', display: 'inline-block' }}>{name}</span>
      </div>
      <div style={{ flexGrow: 1 }} />
      {onDelete && <FaTimes style={{ color: dangerColor, fontSize: '.9em', marginRight: '-.3em', flexShrink: 0, cursor: 'pointer', padding: '.3em' }} role="button" onClick={() => onDelete(path)} />}
    </div>
  );
}

export default memo(BatchFile);
