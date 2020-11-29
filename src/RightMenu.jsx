import React, { memo } from 'react';
import { IoIosCamera } from 'react-icons/io';
import { FaTrashAlt } from 'react-icons/fa';
import { MdRotate90DegreesCcw } from 'react-icons/md';
import { useTranslation } from 'react-i18next';

import { primaryTextColor } from './colors';

import ExportButton from './components/ExportButton';
import ToggleExportConfirm from './components/ToggleExportConfirm';


const RightMenu = memo(({
  isRotationSet, rotation, areWeCutting, increaseRotation, deleteSource, renderCaptureFormatButton,
  capture, onExportPress, outSegments, hasVideo, autoMerge, exportConfirmEnabled, toggleExportConfirmEnabled,
}) => {
  const rotationStr = `${rotation}°`;

  const { t } = useTranslation();

  return (
    <div className="no-user-select" style={{ padding: '.3em', display: 'flex', alignItems: 'center' }}>
      {hasVideo && (
        <div>
          <span style={{ width: 40, textAlign: 'right', display: 'inline-block' }}>{isRotationSet && rotationStr}</span>
          <MdRotate90DegreesCcw
            size={26}
            style={{ margin: '0 5px', verticalAlign: 'middle', color: isRotationSet ? primaryTextColor : undefined }}
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

      <ToggleExportConfirm style={{ marginRight: 5 }} exportConfirmEnabled={exportConfirmEnabled} toggleExportConfirmEnabled={toggleExportConfirmEnabled} />

      <ExportButton outSegments={outSegments} areWeCutting={areWeCutting} autoMerge={autoMerge} onClick={onExportPress} />
    </div>
  );
});

export default RightMenu;
