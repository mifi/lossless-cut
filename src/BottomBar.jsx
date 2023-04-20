import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { MdRotate90DegreesCcw } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { IoIosCamera, IoMdKey } from 'react-icons/io';
import { FaYinYang, FaTrashAlt, FaStepBackward, FaStepForward, FaCaretLeft, FaCaretRight, FaPause, FaPlay, FaImages, FaKey, FaSun } from 'react-icons/fa';
import { GiSoundWaves } from 'react-icons/gi';
// import useTraceUpdate from 'use-trace-update';

import { primaryTextColor, primaryColor, darkModeTransition } from './colors';
import SegmentCutpointButton from './components/SegmentCutpointButton';
import SetCutpointButton from './components/SetCutpointButton';
import ExportButton from './components/ExportButton';
import ToggleExportConfirm from './components/ToggleExportConfirm';
import CaptureFormatButton from './components/CaptureFormatButton';
import Select from './components/Select';

import SimpleModeButton from './components/SimpleModeButton';
import { withBlur, mirrorTransform, checkAppPath } from './util';
import { toast } from './swal';
import { getSegColor as getSegColorRaw } from './util/colors';
import { useSegColors } from './contexts';
import { formatDuration, parseDuration, isExactDurationMatch } from './util/duration';
import useUserSettings from './hooks/useUserSettings';

const { clipboard } = window.require('electron');


const zoomOptions = Array(13).fill().map((unused, z) => 2 ** z);

const leftRightWidth = 100;

const CutTimeInput = memo(({ darkMode, cutTime, setCutTime, startTimeOffset, seekAbs, currentCutSeg, currentApparentCutSeg, isStart }) => {
  const { t } = useTranslation();
  const { getSegColor } = useSegColors();

  const [cutTimeManual, setCutTimeManual] = useState();

  // Clear manual overrides if upstream cut time has changed
  useEffect(() => {
    setCutTimeManual();
  }, [setCutTimeManual, currentApparentCutSeg.start, currentApparentCutSeg.end]);

  const isCutTimeManualSet = () => cutTimeManual !== undefined;

  const border = useMemo(() => {
    const segColor = getSegColor(currentCutSeg);
    return `.1em solid ${darkMode ? segColor.desaturate(0.4).lightness(50).string() : segColor.desaturate(0.2).lightness(60).string()}`;
  }, [currentCutSeg, darkMode, getSegColor]);

  const cutTimeInputStyle = {
    border, borderRadius: 5, backgroundColor: 'var(--gray5)', transition: darkModeTransition, fontSize: 13, textAlign: 'center', padding: '1px 5px', marginTop: 0, marginBottom: 0, marginLeft: isStart ? 0 : 5, marginRight: isStart ? 5 : 0, boxSizing: 'border-box', fontFamily: 'inherit', width: 90, outline: 'none',
  };

  const trySetTime = useCallback((timeWithOffset) => {
    const timeWithoutOffset = Math.max(timeWithOffset - startTimeOffset, 0);
    try {
      setCutTime(isStart ? 'start' : 'end', timeWithoutOffset);
      seekAbs(timeWithoutOffset);
      setCutTimeManual();
    } catch (err) {
      console.error('Cannot set cut time', err);
      // If we get an error from setCutTime, remain in the editing state (cutTimeManual)
      // https://github.com/mifi/lossless-cut/issues/988
    }
  }, [isStart, seekAbs, setCutTime, startTimeOffset]);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();

    // Don't proceed if not a valid time value
    const timeWithOffset = parseDuration(cutTimeManual);
    if (timeWithOffset === undefined) return;

    trySetTime(timeWithOffset);
  }, [cutTimeManual, trySetTime]);

  const parseAndSetCutTime = useCallback((text) => {
    // Don't proceed if not a valid time value
    const timeWithOffset = parseDuration(text);
    if (timeWithOffset === undefined) return;

    trySetTime(timeWithOffset);
  }, [trySetTime]);

  function handleCutTimeInput(text) {
    setCutTimeManual(text);

    if (isExactDurationMatch(text)) parseAndSetCutTime(text);
  }

  const tryPaste = useCallback((clipboardText) => {
    try {
      setCutTimeManual(clipboardText);
      parseAndSetCutTime(clipboardText);
    } catch (err) {
      console.error(err);
    }
  }, [parseAndSetCutTime]);

  const handleCutTimePaste = useCallback((e) => {
    e.preventDefault();

    try {
      const clipboardData = e.clipboardData.getData('Text');
      setCutTimeManual(clipboardData);
      parseAndSetCutTime(clipboardData);
    } catch (err) {
      console.error(err);
    }
  }, [parseAndSetCutTime]);

  const handleContextMenu = useCallback(() => {
    const text = clipboard.readText();
    if (text) tryPaste(text);
  }, [tryPaste]);

  return (
    <form onSubmit={handleSubmit}>
      <input
        style={{ ...cutTimeInputStyle, color: isCutTimeManualSet() ? 'var(--red11)' : 'var(--gray12)' }}
        type="text"
        title={isStart ? t('Manually input current segment\'s start time') : t('Manually input current segment\'s end time')}
        onChange={e => handleCutTimeInput(e.target.value)}
        onPaste={handleCutTimePaste}
        onBlur={() => setCutTimeManual()}
        onContextMenu={handleContextMenu}
        value={isCutTimeManualSet()
          ? cutTimeManual
          : formatDuration({ seconds: cutTime + startTimeOffset })}
      />
    </form>
  );
});

const BottomBar = memo(({
  zoom, setZoom, timelineToggleComfortZoom,
  isRotationSet, rotation, areWeCutting, increaseRotation, cleanupFilesDialog,
  captureSnapshot, onExportPress, segmentsToExport, hasVideo,
  seekAbs, currentSegIndexSafe, cutSegments, currentCutSeg, setCutStart, setCutEnd,
  setCurrentSegIndex,
  jumpTimelineStart, jumpTimelineEnd, jumpCutEnd, jumpCutStart, startTimeOffset, setCutTime, currentApparentCutSeg,
  playing, shortStep, togglePlay, toggleLoopSelectedSegments, hasAudio,
  keyframesEnabled, toggleKeyframesEnabled, seekClosestKeyframe, detectedFps, isFileOpened, selectedSegments,
  darkMode, setDarkMode,
  toggleEnableThumbnails, toggleWaveformMode, waveformMode, showThumbnails,
}) => {
  const { t } = useTranslation();
  const { getSegColor } = useSegColors();

  // ok this is a bit over-engineered but what the hell!
  const loopSelectedSegmentsButtonStyle = useMemo(() => {
    // cannot have less than 1 gradient element:
    const selectedSegmentsSafe = (selectedSegments.length > 1 ? selectedSegments : [selectedSegments[0], selectedSegments[0]]).slice(0, 10);

    const gradientColors = selectedSegmentsSafe.map((seg, i) => {
      const segColor = getSegColorRaw(seg);
      // make colors stronger, the more segments
      return `${segColor.alpha(Math.max(0.4, Math.min(0.8, selectedSegmentsSafe.length / 3))).string()} ${((i / (selectedSegmentsSafe.length - 1)) * 100).toFixed(1)}%`;
    }).join(', ');

    return {
      paddingLeft: 2,
      backgroundOffset: 30,
      background: `linear-gradient(90deg, ${gradientColors})`,
      border: '1px solid var(--gray8)',
      color: 'white',
      margin: '0px 5px 0 0px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 20,
      height: 24,
      borderRadius: 4,
    };
  }, [selectedSegments]);

  const { invertCutSegments, setInvertCutSegments, simpleMode, toggleSimpleMode, exportConfirmEnabled } = useUserSettings();

  const onYinYangClick = useCallback(() => {
    setInvertCutSegments(v => {
      const newVal = !v;
      if (newVal) toast.fire({ title: t('When you export, selected segments on the timeline will be REMOVED - the surrounding areas will be KEPT') });
      else toast.fire({ title: t('When you export, selected segments on the timeline will be KEPT - the surrounding areas will be REMOVED.') });
      return newVal;
    });
  }, [setInvertCutSegments, t]);

  const rotationStr = `${rotation}°`;

  useEffect(() => {
    checkAppPath();
  }, []);

  function renderJumpCutpointButton(direction) {
    const newIndex = currentSegIndexSafe + direction;
    const seg = cutSegments[newIndex];

    const backgroundColor = seg && getSegColor(seg).desaturate(0.6).lightness(darkMode ? 35 : 55).string();
    const opacity = seg ? undefined : 0.5;
    const text = seg ? `${newIndex + 1}` : '-';
    const wide = text.length > 1;
    const segButtonStyle = {
      backgroundColor, opacity, padding: `6px ${wide ? 4 : 6}px`, borderRadius: 10, color: seg ? 'white' : undefined, fontSize: wide ? 12 : 14, width: 20, boxSizing: 'border-box', letterSpacing: -1, lineHeight: '10px', fontWeight: 'bold', margin: '0 6px',
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

  const PlayPause = playing ? FaPause : FaPlay;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', flexBasis: leftRightWidth }}>
          {!simpleMode && (
            <>
              <FaSun color="var(--gray12)" role="button" onClick={() => setDarkMode((v) => !v)} style={{ padding: '0 .2em 0 .3em' }} />

              {hasAudio && (
                <GiSoundWaves
                  size={24}
                  style={{ padding: '0 .1em', color: ['big-waveform', 'waveform'].includes(waveformMode) ? primaryTextColor : undefined }}
                  role="button"
                  title={t('Show waveform')}
                  onClick={() => toggleWaveformMode('waveform')}
                />
              )}
              {hasVideo && (
                <>
                  <FaImages
                    size={20}
                    style={{ padding: '0 .2em', color: showThumbnails ? primaryTextColor : undefined }}
                    role="button"
                    title={t('Show thumbnails')}
                    onClick={toggleEnableThumbnails}
                  />

                  <FaKey
                    size={16}
                    style={{ padding: '0 .2em', color: keyframesEnabled ? primaryTextColor : undefined }}
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
              style={{ flexShrink: 0 }}
              title={t('Jump to start of video')}
              role="button"
              onClick={jumpTimelineStart}
            />

            {renderJumpCutpointButton(-1)}

            <SegmentCutpointButton currentCutSeg={currentCutSeg} side="start" Icon={FaStepBackward} onClick={jumpCutStart} title={t('Jump to current segment\'s start time')} style={{ marginRight: 5 }} />
          </>
        )}

        <SetCutpointButton currentCutSeg={currentCutSeg} side="start" onClick={setCutStart} title={t('Start current segment at current time')} style={{ marginRight: 5 }} />

        {!simpleMode && <CutTimeInput darkMode={darkMode} currentCutSeg={currentCutSeg} currentApparentCutSeg={currentApparentCutSeg} startTimeOffset={startTimeOffset} seekAbs={seekAbs} cutTime={currentApparentCutSeg.start} setCutTime={setCutTime} isStart />}

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

        <div role="button" onClick={() => togglePlay()} style={{ background: primaryColor, margin: '2px 5px 0 5px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 17, color: 'white' }}>
          <PlayPause
            style={{ paddingLeft: playing ? 0 : 2 }}
            size={16}
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

        {!simpleMode && <CutTimeInput darkMode={darkMode} currentCutSeg={currentCutSeg} currentApparentCutSeg={currentApparentCutSeg} startTimeOffset={startTimeOffset} seekAbs={seekAbs} cutTime={currentApparentCutSeg.end} setCutTime={setCutTime} />}

        <SetCutpointButton currentCutSeg={currentCutSeg} side="end" onClick={setCutEnd} title={t('End current segment at current time')} style={{ marginLeft: 5 }} />

        {!simpleMode && (
          <>
            <SegmentCutpointButton currentCutSeg={currentCutSeg} side="end" Icon={FaStepForward} onClick={jumpCutEnd} title={t('Jump to current segment\'s end time')} style={{ marginLeft: 5 }} />

            {renderJumpCutpointButton(1)}

            <FaStepForward
              size={16}
              style={{ flexShrink: 0 }}
              title={t('Jump to end of video')}
              role="button"
              onClick={jumpTimelineEnd}
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
        <SimpleModeButton style={{ flexShrink: 0 }} />

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
                  style={{ color: invertCutSegments ? primaryTextColor : undefined }}
                  onClick={onYinYangClick}
                />
              </motion.div>
            </div>

            <div role="button" style={{ marginRight: 5, marginLeft: 10 }} title={t('Zoom')} onClick={timelineToggleComfortZoom}>{Math.floor(zoom)}x</div>

            <Select style={{ height: 20, flexBasis: 85, flexGrow: 0 }} value={zoomOptions.includes(zoom) ? zoom.toString() : ''} title={t('Zoom')} onChange={withBlur(e => setZoom(parseInt(e.target.value, 10)))}>
              <option key="" value="" disabled>{t('Zoom')}</option>
              {zoomOptions.map(val => (
                <option key={val} value={String(val)}>{t('Zoom')} {val}x</option>
              ))}
            </Select>

            {detectedFps != null && <div title={t('Video FPS')} style={{ color: 'var(--gray11)', fontSize: '.7em', marginLeft: 6 }}>{detectedFps.toFixed(3)}</div>}
          </>
        )}

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

        {!simpleMode && isFileOpened && (
          <FaTrashAlt
            title={t('Close file and clean up')}
            style={{ padding: '5px 10px' }}
            size={16}
            onClick={cleanupFilesDialog}
            role="button"
          />
        )}

        {hasVideo && (
          <>
            {!simpleMode && <CaptureFormatButton height={20} />}

            <IoIosCamera
              style={{ paddingLeft: 5, paddingRight: 15 }}
              size={25}
              title={t('Capture frame')}
              onClick={captureSnapshot}
            />
          </>
        )}

        <div role="button" onClick={toggleLoopSelectedSegments} title={t('Play selected segments in order')} style={loopSelectedSegmentsButtonStyle}>
          <FaPlay
            size={14}
          />
        </div>

        {(!simpleMode || !exportConfirmEnabled) && <ToggleExportConfirm style={{ marginRight: 5 }} />}

        <ExportButton size={1.3} segmentsToExport={segmentsToExport} areWeCutting={areWeCutting} onClick={onExportPress} />
      </div>
    </>
  );
});

export default BottomBar;
