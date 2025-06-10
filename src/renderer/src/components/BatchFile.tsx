import { memo, useRef, useMemo, useCallback, CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { FaAngleRight, FaFile } from 'react-icons/fa';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import useContextMenu from '../hooks/useContextMenu';
import { primaryTextColor } from '../colors';

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
    cursor: dragging ? 'grabbing' : 'pointer',
    fontSize: 13,
    padding: '3px 6px',
    display: 'flex',
    alignItems: 'center',
    alignContent: 'flex-start',
  }), [sortable.isDragging, sortable.transform, sortable.transition, isSelected, dragging]);

  return (
    <div
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...sortable.attributes}
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...sortable.listeners}
      ref={setRef}
      role="button"
      style={style}
      title={path}
      onClick={() => onSelect?.(path)}
    >
      <FaFile size={14} style={{ color: isSelected ? primaryTextColor : undefined, flexShrink: 0 }} />
      <div style={{ flexBasis: 4, flexShrink: 0 }} />
      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>{index + 1}. {name}</div>
      <div style={{ flexGrow: 1 }} />
      {isOpen && <FaAngleRight size={14} style={{ color: 'var(--gray-9)', marginRight: -5, flexShrink: 0 }} />}
    </div>
  );
}

export default memo(BatchFile);
