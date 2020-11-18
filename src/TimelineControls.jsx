import React, { Fragment, memo } from 'react';
import { FaHandPointLeft, FaHandPointRight, FaStepBackward, FaStepForward, FaCaretLeft, FaCaretRight, FaPause, FaPlay, FaImages, FaKey } from 'react-icons/fa';
import { GiSoundWaves } from 'react-icons/gi';
import { IoMdKey } from 'react-icons/io';
import { useTranslation } from 'react-i18next';
// import useTraceUpdate from 'use-trace-update';

import { getSegColors, parseDuration, formatDuration } from './util';
import { primaryTextColor } from './colors';
import SetCutpointButton from './SetCutpointButton';

const TimelineControls = memo(({
  seekAbs, currentSegIndexSafe, cutSegments, currentCutSeg, setCutStart, setCutEnd,
  setCurrentSegIndex, cutStartTimeManual, setCutStartTimeManual, cutEndTimeManual, setCutEndTimeManual,
  duration, jumpCutEnd, jumpCutStart, startTimeOffset, setCutTime, currentApparentCutSeg,
  playing, shortStep, togglePlay, setTimelineMode, hasAudio, hasVideo, timelineMode,
  keyframesEnabled, toggleKeyframesEnabled, seekClosestKeyframe,
}) => {
  const { t } = useTranslation();


  function renderJumpCutpointButton(direction) {
    const newIndex = currentSegIndexSafe + direction;
    const seg = cutSegments[newIndex];

    const getSegButtonStyle = ({ segActiveBgColor, segBorderColor }) => ({ background: segActiveBgColor, border: `2px solid ${segBorderColor}`, borderRadius: 6, color: 'white', fontSize: 14, textAlign: 'center', lineHeight: '11px', fontWeight: 'bold' });

    let segButtonStyle;

    if (seg) {
      const { segActiveBgColor, segBorderColor } = getSegColors(seg);
      segButtonStyle = getSegButtonStyle({ segActiveBgColor, segBorderColor });
    } else {
      segButtonStyle = getSegButtonStyle({ segActiveBgColor: 'rgba(255,255,255,0.3)', segBorderColor: 'rgba(255,255,255,0.5)' });
    }

    return (
      <div
        style={{ ...segButtonStyle, height: 10, padding: 4, margin: '0 5px' }}
        role="button"
        title={`${direction > 0 ? t('Select next segment') : t('Select previous segment')} (${newIndex + 1})`}
        onClick={() => seg && setCurrentSegIndex(newIndex)}
      >
        {newIndex + 1}
      </div>
    );
  }

  function renderCutTimeInput(type) {
    const isStart = type === 'start';

    const cutTimeManual = isStart ? cutStartTimeManual : cutEndTimeManual;
    const cutTime = isStart ? currentApparentCutSeg.start : currentApparentCutSeg.end;
    const setCutTimeManual = isStart ? setCutStartTimeManual : setCutEndTimeManual;

    const isCutTimeManualSet = () => cutTimeManual !== undefined;

    const cutTimeInputStyle = {
      background: 'white', borderRadius: 5, color: 'rgba(0, 0, 0, 0.7)', fontSize: 13, textAlign: 'center', padding: '1px 5px', marginTop: 0, marginBottom: 0, marginLeft: isStart ? 3 : 5, marginRight: isStart ? 5 : 3, border: 'none', boxSizing: 'border-box', fontFamily: 'inherit', width: 90, outline: 'none',
    };

    function parseAndSetCutTime(text) {
      // Not a valid duration? Only set manual
      const timeWithOffset = parseDuration(text);
      if (timeWithOffset === undefined) {
        setCutTimeManual(text);
        return;
      }

      setCutTimeManual();

      const timeWithoutOffset = Math.max(timeWithOffset - startTimeOffset, 0);
      try {
        setCutTime(type, timeWithoutOffset);
        seekAbs(timeWithoutOffset);
      } catch (err) {
        console.error('Cannot set cut time', err);
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

  const leftRightWidth = 100;

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', flexBasis: leftRightWidth }}>
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
          <Fragment>
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
          </Fragment>
        )}
      </div>

      <div style={{ flexGrow: 1 }} />

      <FaStepBackward
        size={16}
        title={t('Jump to start of video')}
        role="button"
        onClick={() => seekAbs(0)}
      />

      {renderJumpCutpointButton(-1)}

      <SetCutpointButton currentCutSeg={currentCutSeg} side="start" Icon={FaStepBackward} onClick={jumpCutStart} title={t('Jump to cut start')} style={{ marginRight: 5 }} />
      <SetCutpointButton currentCutSeg={currentCutSeg} side="start" Icon={FaHandPointLeft} onClick={setCutStart} title={t('Set cut start to current position')} />

      {renderCutTimeInput('start')}

      <IoMdKey
        size={20}
        role="button"
        title={t('Seek previous keyframe')}
        style={{ transform: 'matrix(-1, 0, 0, 1, 0, 0)' }}
        onClick={() => seekClosestKeyframe(-1)}
      />
      <FaCaretLeft
        size={20}
        role="button"
        title={t('One frame back')}
        onClick={() => shortStep(-1)}
      />
      <PlayPause
        size={16}
        role="button"
        onClick={togglePlay}
      />
      <FaCaretRight
        size={20}
        role="button"
        title={t('One frame forward')}
        onClick={() => shortStep(1)}
      />
      <IoMdKey
        size={20}
        role="button"
        title={t('Seek next keyframe')}
        onClick={() => seekClosestKeyframe(1)}
      />

      {renderCutTimeInput('end')}

      <SetCutpointButton currentCutSeg={currentCutSeg} side="end" Icon={FaHandPointRight} onClick={setCutEnd} title={t('Set cut end to current position')} />
      <SetCutpointButton currentCutSeg={currentCutSeg} side="end" Icon={FaStepForward} onClick={jumpCutEnd} title={t('Jump to cut end')} style={{ marginLeft: 5 }} />

      {renderJumpCutpointButton(1)}

      <FaStepForward
        size={16}
        title={t('Jump to end of video')}
        role="button"
        onClick={() => seekAbs(duration)}
      />

      <div style={{ flexGrow: 1 }} />

      <div style={{ flexBasis: leftRightWidth }} />
    </div>
  );
});

export default TimelineControls;
