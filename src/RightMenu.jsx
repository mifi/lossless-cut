import React, { memo } from 'react';
import { IoIosCamera } from 'react-icons/io';
import { FaTrashAlt, FaFileExport } from 'react-icons/fa';
import { MdRotate90DegreesCcw } from 'react-icons/md';
import { FiScissors } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';

import { primaryColor } from './colors';


const RightMenu = memo(({
  isRotationSet, rotation, areWeCutting, increaseRotation, deleteSource, renderCaptureFormatButton,
  capture, cutClick, multipleCutSegments,
}) => {
  const rotationStr = `${rotation}°`;
  const CutIcon = areWeCutting ? FiScissors : FaFileExport;

  const { t } = useTranslation();

  return (
    <div className="no-user-select" style={{ padding: '.3em', display: 'flex', alignItems: 'center' }}>
      <div>
        <span style={{ width: 40, textAlign: 'right', display: 'inline-block' }}>{isRotationSet && rotationStr}</span>
        <MdRotate90DegreesCcw
          size={26}
          style={{ margin: '0 5px', verticalAlign: 'middle' }}
          title={`${t('Set output rotation. Current: ')} ${isRotationSet ? rotationStr : t('Don\'t modify')}`}
          onClick={increaseRotation}
          role="button"
        />
      </div>

      <FaTrashAlt
        title={t('Delete source file')}
        style={{ padding: '5px 10px' }}
        size={16}
        onClick={deleteSource}
        role="button"
      />

      {renderCaptureFormatButton({ height: 20 })}

      <IoIosCamera
        style={{ paddingLeft: 5, paddingRight: 15 }}
        size={25}
        title={t('Capture frame')}
        onClick={capture}
      />

      <span
        style={{ background: primaryColor, borderRadius: 5, padding: '3px 7px', fontSize: 14 }}
        onClick={cutClick}
        title={multipleCutSegments ? t('Export all segments') : t('Export selection')}
        role="button"
      >
        <CutIcon
          style={{ verticalAlign: 'middle', marginRight: 3 }}
          size={16}
        />
        {t('Export')}
      </span>
    </div>
  );
});

export default RightMenu;
