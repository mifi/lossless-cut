import React, { memo, useCallback } from 'react';
import { Select } from 'evergreen-ui';
import { motion } from 'framer-motion';
import { FaYinYang, FaTrashAlt } from 'react-icons/fa';
import { MdRotate90DegreesCcw } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { IoIosCamera } from 'react-icons/io';

import { primaryTextColor } from './colors';

import ExportButton from './components/ExportButton';
import ToggleExportConfirm from './components/ToggleExportConfirm';


import SimpleModeButton from './components/SimpleModeButton';
import { withBlur, toast } from './util';

const isDev = window.require('electron-is-dev');
const start = new Date().getTime();
const zoomOptions = Array(13).fill().map((unused, z) => 2 ** z);

const BottomMenu = memo(({
  zoom, setZoom, invertCutSegments, setInvertCutSegments, toggleComfortZoom, simpleMode, toggleSimpleMode,
  isRotationSet, rotation, areWeCutting, increaseRotation, cleanupFiles, renderCaptureFormatButton,
  capture, onExportPress, enabledOutSegments, hasVideo, autoMerge, exportConfirmEnabled, toggleExportConfirmEnabled,
}) => {
  const { t } = useTranslation();

  const onYinYangClick = useCallback(() => {
    setInvertCutSegments(v => {
      const newVal = !v;
      if (newVal) toast.fire({ title: t('When you export, selected segments on the timeline will be REMOVED - the surrounding areas will be KEPT') });
      else toast.fire({ title: t('When you export, selected segments on the timeline will be KEPT - the surrounding areas will be REMOVED.') });
      return newVal;
    });
  }, [setInvertCutSegments, t]);

  const rotationStr = `${rotation}°`;

  return (
    <div
      className="no-user-select"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 4px' }}
    >
      <SimpleModeButton simpleMode={simpleMode} toggleSimpleMode={toggleSimpleMode} style={{ flexShrink: 0 }} />

      {simpleMode && <div role="button" onClick={toggleSimpleMode} style={{ marginLeft: 5, fontSize: '90%' }}>{t('Toggle advanced view')}</div>}

      {!simpleMode && (
        <div style={{ marginLeft: 5 }}>
          <motion.div
            style={{ width: 24, height: 24 }}
            animate={{ rotateX: invertCutSegments ? 0 : 180 }}
            transition={{ duration: 0.3 }}
          >
            <FaYinYang
              size={24}
              role="button"
              title={invertCutSegments ? t('Discard selected segments') : t('Keep selected segments')}
              onClick={onYinYangClick}
            />
          </motion.div>
        </div>
      )}

      {!simpleMode && (
        <>
          <div role="button" style={{ marginRight: 5, marginLeft: 10 }} title={t('Zoom')} onClick={toggleComfortZoom}>{Math.floor(zoom)}x</div>

          <Select height={20} style={{ flexBasis: 85, flexGrow: 0 }} value={zoomOptions.includes(zoom) ? zoom.toString() : ''} title={t('Zoom')} onChange={withBlur(e => setZoom(parseInt(e.target.value, 10)))}>
            <option key="" value="" disabled>{t('Zoom')}</option>
            {zoomOptions.map(val => (
              <option key={val} value={String(val)}>{t('Zoom')} {val}x</option>
            ))}
          </Select>
        </>
      )}

      <div style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 1, flexGrow: 0, overflow: 'hidden', margin: '0 10px' }}>{!isDev && new Date().getTime() - start > 2 * 60 * 1000 && ['t', 'u', 'C', 's', 's', 'e', 'l', 's', 's', 'o', 'L'].reverse().join('')}</div>

      <div style={{ flexGrow: 1 }} />

      {hasVideo && (
        <>
          <span style={{ textAlign: 'right', display: 'inline-block' }}>{isRotationSet && rotationStr}</span>
          <MdRotate90DegreesCcw
            size={24}
            style={{ margin: '0px 0px 0 2px', verticalAlign: 'middle', color: isRotationSet ? primaryTextColor : undefined }}
            title={`${t('Set output rotation. Current: ')} ${isRotationSet ? rotationStr : t('Don\'t modify')}`}
            onClick={increaseRotation}
            role="button"
          />
        </>
      )}

      {!simpleMode && (
        <FaTrashAlt
          title={t('Close file and clean up')}
          style={{ padding: '5px 10px' }}
          size={16}
          onClick={cleanupFiles}
          role="button"
        />
      )}

      {hasVideo && (
        <>
          {!simpleMode && renderCaptureFormatButton({ height: 20 })}

          <IoIosCamera
            style={{ paddingLeft: 5, paddingRight: 15 }}
            size={25}
            title={t('Capture frame')}
            onClick={capture}
          />
        </>
      )}

      {!simpleMode && <ToggleExportConfirm style={{ marginRight: 5 }} exportConfirmEnabled={exportConfirmEnabled} toggleExportConfirmEnabled={toggleExportConfirmEnabled} />}

      <ExportButton enabledOutSegments={enabledOutSegments} areWeCutting={areWeCutting} autoMerge={autoMerge} onClick={onExportPress} />
    </div>
  );
});

export default BottomMenu;
