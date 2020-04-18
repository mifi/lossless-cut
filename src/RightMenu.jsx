import React, { memo } from 'react';
import { IoIosCamera } from 'react-icons/io';
import { FaTrashAlt, FaFileExport } from 'react-icons/fa';
import { MdRotate90DegreesCcw } from 'react-icons/md';
import { FiScissors } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';

import { primaryColor } from './colors';


const RightMenu = memo(({
  isRotationSet, rotation, areWeCutting, increaseRotation, deleteSource, renderCaptureFormatButton,
  capture, cutClick, outSegments, hasVideo, autoMerge,
}) => {
  const rotationStr = `${rotation}°`;
  const CutIcon = areWeCutting ? FiScissors : FaFileExport;

  const { t } = useTranslation();

  let exportButtonTitle = t('Export');
  if (outSegments) {
    if (outSegments.length === 1) {
      exportButtonTitle = t('Export selection');
    } else if (outSegments.length > 1) {
      exportButtonTitle = t('Export {{ num }} segments', { num: outSegments.length });
    }
  }

  const exportButtonText = autoMerge && outSegments && outSegments.length > 1 ? t('Export+merge') : t('Export');

  return (
    <div className="no-user-select" style={{ padding: '.3em', display: 'flex', alignItems: 'center' }}>
      {hasVideo && (
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
      )}

      <FaTrashAlt
        title={t('Delete source file')}
        style={{ padding: '5px 10px' }}
        size={16}
        onClick={deleteSource}
        role="button"
      />

      {hasVideo && (
        <>
          {renderCaptureFormatButton({ height: 20 })}

          <IoIosCamera
            style={{ paddingLeft: 5, paddingRight: 15 }}
            size={25}
            title={t('Capture frame')}
            onClick={capture}
          />
        </>
      )}

      <span
        style={{ background: primaryColor, borderRadius: 5, padding: '3px 7px', fontSize: 13 }}
        onClick={cutClick}
        title={exportButtonTitle}
        role="button"
      >
        <CutIcon
          style={{ verticalAlign: 'middle', marginRight: 4 }}
          size={15}
        />
        {exportButtonText}
      </span>
    </div>
  );
});

export default RightMenu;
