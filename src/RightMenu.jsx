import React, { memo } from 'react';
import { IoIosCamera } from 'react-icons/io';
import { FaTrashAlt, FaFileExport } from 'react-icons/fa';
import { MdRotate90DegreesCcw } from 'react-icons/md';
import { FiScissors } from 'react-icons/fi';

import { primaryColor } from './colors';


const RightMenu = memo(({
  isRotationSet, rotation, areWeCutting, increaseRotation, deleteSource, renderCaptureFormatButton,
  capture, cutClick, multipleCutSegments,
}) => {
  const rotationStr = `${rotation}°`;
  const CutIcon = areWeCutting ? FiScissors : FaFileExport;

  return (
    <div className="no-user-select" style={{ position: 'absolute', right: 0, bottom: 0, padding: '.3em', display: 'flex', alignItems: 'center' }}>
      <div>
        <span style={{ width: 40, textAlign: 'right', display: 'inline-block' }}>{isRotationSet && rotationStr}</span>
        <MdRotate90DegreesCcw
          size={26}
          style={{ margin: '0 5px', verticalAlign: 'middle' }}
          title={`Set output rotation. Current: ${isRotationSet ? rotationStr : 'Don\'t modify'}`}
          onClick={increaseRotation}
          role="button"
        />
      </div>

      <FaTrashAlt
        title="Delete source file"
        style={{ padding: '5px 10px' }}
        size={16}
        onClick={deleteSource}
        role="button"
      />

      {renderCaptureFormatButton({ height: 20 })}

      <IoIosCamera
        style={{ paddingLeft: 5, paddingRight: 15 }}
        size={25}
        title="Capture frame"
        onClick={capture}
      />

      <span
        style={{ background: primaryColor, borderRadius: 5, padding: '3px 7px', fontSize: 14 }}
        onClick={cutClick}
        title={multipleCutSegments ? 'Export all segments' : 'Export selection'}
        role="button"
      >
        <CutIcon
          style={{ verticalAlign: 'middle', marginRight: 3 }}
          size={16}
        />
        Export
      </span>
    </div>
  );
});

export default RightMenu;
