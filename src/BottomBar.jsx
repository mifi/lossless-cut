import React, { memo, useCallback, useEffect } from 'react';
import { Select } from 'evergreen-ui';
import { motion } from 'framer-motion';
import { MdRotate90DegreesCcw } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { IoIosCamera, IoMdKey } from 'react-icons/io';
import { FaYinYang, FaTrashAlt, FaStepBackward, FaStepForward, FaCaretLeft, FaCaretRight, FaPause, FaPlay, FaImages, FaKey } from 'react-icons/fa';
import { GiSoundWaves } from 'react-icons/gi';
// import useTraceUpdate from 'use-trace-update';

import { primaryTextColor, primaryColor } from './colors';
import SegmentCutpointButton from './components/SegmentCutpointButton';
import SetCutpointButton from './components/SetCutpointButton';
import ExportButton from './components/ExportButton';
import ToggleExportConfirm from './components/ToggleExportConfirm';

import SimpleModeButton from './components/SimpleModeButton';
import { withBlur, toast, mirrorTransform } from './util';
import { getSegColor } from './util/colors';
import { formatDuration, parseDuration } from './util/duration';

const isDev = window.require('electron-is-dev');

const start = new Date().getTime();
const zoomOptions = Array(13).fill().map((unused, z) => 2 ** z);

const leftRightWidth = 100;

const BottomBar = memo(({
  zoom, setZoom, invertCutSegments, setInvertCutSegments, toggleComfortZoom, simpleMode, toggleSimpleMode,
  isRotationSet, rotation, areWeCutting, increaseRotation, cleanupFiles, renderCaptureFormatButton,
  capture, onExportPress, enabledSegments, hasVideo, autoMerge, exportConfirmEnabled, toggleExportConfirmEnabled,
  seekAbs, currentSegIndexSafe, cutSegments, currentCutSeg, setCutStart, setCutEnd,
  setCurrentSegIndex, cutStartTimeManual, setCutStartTimeManual, cutEndTimeManual, setCutEndTimeManual,
  duration, jumpCutEnd, jumpCutStart, startTimeOffset, setCutTime, currentApparentCutSeg,
  playing, shortStep, togglePlay, setTimelineMode, hasAudio, timelineMode,
  keyframesEnabled, toggleKeyframesEnabled, seekClosestKeyframe, detectedFps,
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

  // Clear manual overrides if upstream cut time has changed
  useEffect(() => {
    setCutStartTimeManual();
    setCutEndTimeManual();
  }, [setCutStartTimeManual, setCutEndTimeManual, currentApparentCutSeg.start, currentApparentCutSeg.end]);

  function renderJumpCutpointButton(direction) {
    const newIndex = currentSegIndexSafe + direction;
    const seg = cutSegments[newIndex];

    const backgroundColor = seg && getSegColor(seg).alpha(0.5).string();
    const opacity = seg ? undefined : 0.3;
    const text = seg ? `${newIndex + 1}` : '-';
    const wide = text.length > 1;
    const segButtonStyle = {
      backgroundColor, opacity, padding: `6px ${wide ? 4 : 6}px`, borderRadius: 10, color: 'white', fontSize: wide ? 12 : 14, width: 20, boxSizing: 'border-box', letterSpacing: -1, lineHeight: '10px', fontWeight: 'bold', margin: '0 6px',
    };

    return (
      <div
        style={segButtonStyle}
        role="button"
        title={`${direction > 0 ? t('Select next segment') : t('Select previous segment')} (${newIndex + 1})`}
        onClick={() => seg && setCurrentSegIndex(newIndex)}
      >
        {text}
      </div>
    );
  }

  function renderCutTimeInput(type) {
    const isStart = type === 'start';

    const cutTimeManual = isStart ? cutStartTimeManual : cutEndTimeManual;
    const cutTime = isStart ? currentApparentCutSeg.start : currentApparentCutSeg.end;
    const setCutTimeManual = isStart ? setCutStartTimeManual : setCutEndTimeManual;

    const isCutTimeManualSet = () => cutTimeManual !== undefined;

    const border = `1px solid ${getSegColor(currentCutSeg).alpha(0.8).string()}`;

    const cutTimeInputStyle = {
      background: 'white', border, borderRadius: 5, color: 'rgba(0, 0, 0, 0.7)', fontSize: 13, textAlign: 'center', padding: '1px 5px', marginTop: 0, marginBottom: 0, marginLeft: isStart ? 0 : 5, marginRight: isStart ? 5 : 0, boxSizing: 'border-box', fontFamily: 'inherit', width: 90, outline: 'none',
    };

    function parseAndSetCutTime(text) {
      setCutTimeManual(text);

      // Don't proceed if not a valid time value
      const timeWithOffset = parseDuration(text);
      if (timeWithOffset === undefined) return;

      const timeWithoutOffset = Math.max(timeWithOffset - startTimeOffset, 0);
      try {
        setCutTime(type, timeWithoutOffset);
        seekAbs(timeWithoutOffset);
      } catch (err) {
        console.error('Cannot set cut time', err);
        // If we get an error from setCutTime, remain in the editing state (cutTimeManual)
        // https://github.com/mifi/lossless-cut/issues/988
      }
    }

    function handleCutTimeInput(text) {
      // Allow the user to erase to reset
      if (text.length === 0) {
        setCutTimeManual();
        return;
      }

      parseAndSetCutTime(text);
    }

    async function handleCutTimePaste(e) {
      e.preventDefault();

      try {
        const clipboardData = e.clipboardData.getData('Text');
        parseAndSetCutTime(clipboardData);
      } catch (err) {
        console.error(err);
      }
    }

    return (
      <input
        style={{ ...cutTimeInputStyle, color: isCutTimeManualSet() ? '#dc1d1d' : undefined }}
        type="text"
        title={isStart ? t('Manually input cut start point') : t('Manually input cut end point')}
        onChange={e => handleCutTimeInput(e.target.value)}
        onPaste={handleCutTimePaste}
        value={isCutTimeManualSet()
          ? cutTimeManual
          : formatDuration({ seconds: cutTime + startTimeOffset })}
      />
    );
  }

  const PlayPause = playing ? FaPause : FaPlay;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', flexBasis: leftRightWidth }}>
          {!simpleMode && (
            <>
              {hasAudio && (
                <GiSoundWaves
                  size={24}
                  style={{ padding: '0 5px', color: timelineMode === 'waveform' ? primaryTextColor : undefined }}
                  role="button"
                  title={t('Show waveform')}
                  onClick={() => setTimelineMode('waveform')}
                />
              )}
              {hasVideo && (
                <>
                  <FaImages
                    size={20}
                    style={{ padding: '0 5px', color: timelineMode === 'thumbnails' ? primaryTextColor : undefined }}
                    role="button"
                    title={t('Show thumbnails')}
                    onClick={() => setTimelineMode('thumbnails')}
                  />

                  <FaKey
                    size={16}
                    style={{ padding: '0 5px', color: keyframesEnabled ? primaryTextColor : undefined }}
                    role="button"
                    title={t('Show keyframes')}
                    onClick={toggleKeyframesEnabled}
                  />
                </>
              )}
            </>
          )}
        </div>

        <div style={{ flexGrow: 1 }} />

        {!simpleMode && (
          <>
            <FaStepBackward
              size={16}
              title={t('Jump to start of video')}
              role="button"
              onClick={() => seekAbs(0)}
            />

            {renderJumpCutpointButton(-1)}

            <SegmentCutpointButton currentCutSeg={currentCutSeg} side="start" Icon={FaStepBackward} onClick={jumpCutStart} title={t('Jump to cut start')} style={{ marginRight: 5 }} />
          </>
        )}

        <SetCutpointButton currentCutSeg={currentCutSeg} side="start" onClick={setCutStart} title={t('Set cut start to current position')} style={{ marginRight: 5 }} />

        {!simpleMode && renderCutTimeInput('start')}

        <IoMdKey
          size={25}
          role="button"
          title={t('Seek previous keyframe')}
          style={{ flexShrink: 0, marginRight: 2, transform: mirrorTransform }}
          onClick={() => seekClosestKeyframe(-1)}
        />

        {!simpleMode && (
          <FaCaretLeft
            style={{ flexShrink: 0, marginLeft: -6, marginRight: -4 }}
            size={28}
            role="button"
            title={t('One frame back')}
            onClick={() => shortStep(-1)}
          />
        )}

        <div style={{ background: primaryColor, margin: '2px 5px 0 5px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 17 }}>
          <PlayPause
            style={{ marginLeft: playing ? 0 : 2 }}
            size={16}
            role="button"
            onClick={togglePlay}
          />
        </div>

        {!simpleMode && (
          <FaCaretRight
            style={{ flexShrink: 0, marginRight: -6, marginLeft: -4 }}
            size={28}
            role="button"
            title={t('One frame forward')}
            onClick={() => shortStep(1)}
          />
        )}

        <IoMdKey
          style={{ flexShrink: 0, marginLeft: 2 }}
          size={25}
          role="button"
          title={t('Seek next keyframe')}
          onClick={() => seekClosestKeyframe(1)}
        />

        {!simpleMode && renderCutTimeInput('end')}

        <SetCutpointButton currentCutSeg={currentCutSeg} side="end" onClick={setCutEnd} title={t('Set cut end to current position')} style={{ marginLeft: 5 }} />

        {!simpleMode && (
          <>
            <SegmentCutpointButton currentCutSeg={currentCutSeg} side="end" Icon={FaStepForward} onClick={jumpCutEnd} title={t('Jump to cut end')} style={{ marginLeft: 5 }} />

            {renderJumpCutpointButton(1)}

            <FaStepForward
              size={16}
              title={t('Jump to end of video')}
              role="button"
              onClick={() => seekAbs(duration)}
            />
          </>
        )}

        <div style={{ flexGrow: 1 }} />

        <div style={{ flexBasis: leftRightWidth }} />
      </div>

      <div
        className="no-user-select"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 4px' }}
      >
        <SimpleModeButton simpleMode={simpleMode} toggleSimpleMode={toggleSimpleMode} style={{ flexShrink: 0 }} />

        {simpleMode && <div role="button" onClick={toggleSimpleMode} style={{ marginLeft: 5, fontSize: '90%' }}>{t('Toggle advanced view')}</div>}

        {!simpleMode && (
          <>
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

            <div role="button" style={{ marginRight: 5, marginLeft: 10 }} title={t('Zoom')} onClick={toggleComfortZoom}>{Math.floor(zoom)}x</div>

            <Select height={20} style={{ flexBasis: 85, flexGrow: 0 }} value={zoomOptions.includes(zoom) ? zoom.toString() : ''} title={t('Zoom')} onChange={withBlur(e => setZoom(parseInt(e.target.value, 10)))}>
              <option key="" value="" disabled>{t('Zoom')}</option>
              {zoomOptions.map(val => (
                <option key={val} value={String(val)}>{t('Zoom')} {val}x</option>
              ))}
            </Select>

            {detectedFps != null && <div title={t('Video FPS')} style={{ color: 'rgba(255,255,255,0.6)', fontSize: '.7em', marginLeft: 6 }}>{detectedFps.toFixed(3)}</div>}
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

        <ExportButton size={1.3} enabledSegments={enabledSegments} areWeCutting={areWeCutting} autoMerge={autoMerge} onClick={onExportPress} />
      </div>
    </>
  );
});

export default BottomBar;
