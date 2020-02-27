import React, { memo } from 'react';
import { FaHandPointLeft, FaHandPointRight, FaStepBackward, FaStepForward, FaCaretLeft, FaCaretRight, FaPause, FaPlay } from 'react-icons/fa';
import { GiSoundWaves } from 'react-icons/gi';
// import useTraceUpdate from 'use-trace-update';

import { getSegColors, parseDuration, formatDuration } from './util';


const TimelineControls = memo(({
  seekAbs, currentSegIndexSafe, cutSegments, currentCutSeg, setCutStart, setCutEnd,
  setCurrentSegIndex, cutStartTimeManual, setCutStartTimeManual, cutEndTimeManual, setCutEndTimeManual,
  duration, jumpCutEnd, jumpCutStart, startTimeOffset, setCutTime, currentApparentCutSeg,
  playing, shortStep, playCommand, setTimelineExpanded, hasAudio,
}) => {
  const {
    segActiveBgColor: currentSegActiveBgColor,
    segBorderColor: currentSegBorderColor,
  } = getSegColors(currentCutSeg);

  const getSegButtonStyle = ({ segActiveBgColor, segBorderColor }) => ({ background: segActiveBgColor, border: `2px solid ${segBorderColor}`, borderRadius: 6, color: 'white', fontSize: 14, textAlign: 'center', lineHeight: '11px', fontWeight: 'bold' });

  function renderSetCutpointButton({ side, Icon, onClick, title, style }) {
    const start = side === 'start';
    const border = `4px solid ${currentSegBorderColor}`;
    return (
      <Icon
        size={13}
        title={title}
        role="button"
        style={{ padding: start ? '4px 4px 4px 2px' : '4px 2px 4px 4px', borderLeft: start && border, borderRight: !start && border, background: currentSegActiveBgColor, borderRadius: 6, ...style }}
        onClick={onClick}
      />
    );
  }

  function renderJumpCutpointButton(direction) {
    const newIndex = currentSegIndexSafe + direction;
    const seg = cutSegments[newIndex];

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
        title={`Select ${direction > 0 ? 'next' : 'previous'} segment (${newIndex + 1})`}
        onClick={() => seg && setCurrentSegIndex(newIndex)}
      >
        {newIndex + 1}
      </div>
    );
  }

  function renderCutTimeInput(type) {
    const cutTimeManual = type === 'start' ? cutStartTimeManual : cutEndTimeManual;
    const cutTimeInputStyle = {
      background: 'white', borderRadius: 5, color: 'rgba(0, 0, 0, 0.7)', fontSize: 13, padding: '3px 5px', margin: '0 3px', border: 'none', boxSizing: 'border-box', fontFamily: 'inherit', width: 90, textAlign: type === 'start' ? 'right' : 'left',
    };

    const isCutTimeManualSet = () => cutTimeManual !== undefined;

    const set = type === 'start' ? setCutStartTimeManual : setCutEndTimeManual;

    const handleCutTimeInput = (text) => {
      // Allow the user to erase
      if (text.length === 0) {
        set();
        return;
      }

      const time = parseDuration(text);
      if (time === undefined) {
        set(text);
        return;
      }

      set();

      const rel = time - startTimeOffset;
      try {
        setCutTime(type, rel);
      } catch (err) {
        console.error('Cannot set cut time', err);
      }
      seekAbs(rel);
    };

    const cutTime = type === 'start' ? currentApparentCutSeg.start : currentApparentCutSeg.end;

    return (
      <input
        style={{ ...cutTimeInputStyle, color: isCutTimeManualSet() ? '#dc1d1d' : undefined }}
        type="text"
        title={`Manually input cut ${type === 'start' ? 'start' : 'end'} point`}
        onChange={e => handleCutTimeInput(e.target.value)}
        value={isCutTimeManualSet()
          ? cutTimeManual
          : formatDuration({ seconds: cutTime + startTimeOffset })}
      />
    );
  }

  const PlayPause = playing ? FaPause : FaPlay;

  const leftRightWidth = 50;

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', flexBasis: leftRightWidth }}>
        {hasAudio && (
          <GiSoundWaves
            size={24}
            style={{ padding: '0 5px' }}
            role="button"
            title="Expand timeline"
            onClick={() => setTimelineExpanded(v => !v)}
          />
        )}
      </div>

      <div style={{ flexGrow: 1 }} />

      <FaStepBackward
        size={16}
        title="Jump to start of video"
        role="button"
        onClick={() => seekAbs(0)}
      />

      {renderJumpCutpointButton(-1)}

      {renderSetCutpointButton({ side: 'start', Icon: FaStepBackward, onClick: jumpCutStart, title: 'Jump to cut start', style: { marginRight: 5 } })}

      {renderSetCutpointButton({ side: 'start', Icon: FaHandPointLeft, onClick: setCutStart, title: 'Set cut start to current position' })}

      {renderCutTimeInput('start')}

      <FaCaretLeft
        size={20}
        role="button"
        title="One frame back"
        onClick={() => shortStep(-1)}
      />
      <PlayPause
        size={16}
        role="button"
        onClick={playCommand}
      />
      <FaCaretRight
        size={20}
        role="button"
        title="One frame forward"
        onClick={() => shortStep(1)}
      />

      {renderCutTimeInput('end')}

      {renderSetCutpointButton({ side: 'end', Icon: FaHandPointRight, onClick: setCutEnd, title: 'Set cut end to current position' })}

      {renderSetCutpointButton({ side: 'end', Icon: FaStepForward, onClick: jumpCutEnd, title: 'Jump to cut end', style: { marginLeft: 5 } })}

      {renderJumpCutpointButton(1)}

      <FaStepForward
        size={16}
        title="Jump to end of video"
        role="button"
        onClick={() => seekAbs(duration)}
      />

      <div style={{ flexGrow: 1 }} />

      <div style={{ flexBasis: leftRightWidth }} />
    </div>
  );
});

export default TimelineControls;
