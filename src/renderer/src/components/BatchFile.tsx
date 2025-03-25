import { memo, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FaAngleRight, FaFile } from 'react-icons/fa';

import useContextMenu from '../hooks/useContextMenu';
import { primaryTextColor } from '../colors';

function BatchFile({ path, index, isOpen, isSelected, name, onSelect, onDelete }: {
  path: string,
  index: number,
  isOpen: boolean,
  isSelected: boolean,
  name: string,
  onSelect: (a: string) => void,
  onDelete: (a: string) => void,
}) {
  const ref = useRef<HTMLDivElement>(null);

  const { t } = useTranslation();
  const contextMenuTemplate = useMemo(() => [
    { label: t('Remove'), click: () => onDelete(path) },
  ], [t, onDelete, path]);

  useContextMenu(ref, contextMenuTemplate);

  return (
    <div ref={ref} role="button" style={{ background: isSelected ? 'var(--gray7)' : undefined, fontSize: 13, padding: '3px 6px', display: 'flex', alignItems: 'center', alignContent: 'flex-start' }} title={path} onClick={() => onSelect(path)}>
      <FaFile size={14} style={{ color: isSelected ? primaryTextColor : undefined, flexShrink: 0 }} />
      <div style={{ flexBasis: 4, flexShrink: 0 }} />
      <div style={{ whiteSpace: 'nowrap', cursor: 'pointer', overflow: 'hidden' }}>{index + 1}. {name}</div>
      <div style={{ flexGrow: 1 }} />
      {isOpen && <FaAngleRight size={14} style={{ color: 'var(--gray9)', marginRight: -5, flexShrink: 0 }} />}
    </div>
  );
}

export default memo(BatchFile);
