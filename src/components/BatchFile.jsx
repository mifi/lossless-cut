import React, { memo, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FaAngleRight, FaFile } from 'react-icons/fa';

import useContextMenu from '../hooks/useContextMenu';
import { primaryColor } from '../colors';

const BatchFile = memo(({ path, filePath, name, onOpen, onDelete }) => {
  const ref = useRef();

  const { t } = useTranslation();
  const contextMenuTemplate = useMemo(() => [
    { label: t('Remove'), click: () => onDelete(path) },
  ], [t, onDelete, path]);

  useContextMenu(ref, contextMenuTemplate);
  const isCurrent = path === filePath;

  return (
    <div ref={ref} role="button" style={{ background: isCurrent ? 'rgba(255,255,255,0.15)' : undefined, fontSize: 13, padding: '1px 3px', cursor: 'pointer', display: 'flex', alignItems: 'center', minHeight: 30, alignContent: 'flex-start' }} title={path} onClick={() => onOpen(path)}>
      <FaFile size={14} style={{ color: primaryColor, marginLeft: 3, marginRight: 4, flexShrink: 0 }} />
      <div style={{ wordBreak: 'break-all' }}>{name}</div>
      <div style={{ flexGrow: 1 }} />
      {isCurrent && <FaAngleRight size={14} style={{ color: 'white', marginRight: -3, flexShrink: 0 }} />}
    </div>
  );
});

export default BatchFile;
