import React, { memo, useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Hammer from 'react-hammerjs';

import TimelineSeg from './TimelineSeg';
import InverseCutSegment from './InverseCutSegment';

import { timelineBackground } from './colors';

import { getSegColors } from './util';


const hammerOptions = { recognizers: {} };

const Waveform = memo(({ calculateTimelinePos, durationSafe, waveform, zoom, timelineHeight }) => {
  const imgRef = useRef();
  const [style, setStyle] = useState({ display: 'none' });

  const leftPos = calculateTimelinePos(waveform.from);

  const toTruncated = Math.min(waveform.to, durationSafe);

  // Prevents flash
  function onLoad() {
    setStyle({
      position: 'absolute', height: '100%', left: leftPos, width: `${((toTruncated - waveform.from) / durationSafe) * 100}%`,
    });
  }

  return (
    <div style={{ height: timelineHeight, width: `${zoom * 100}%`, position: 'relative' }}>
      <img ref={imgRef} src={waveform.url} draggable={false} style={style} alt="" onLoad={onLoad} />
    </div>
  );
});

const Timeline = memo(({
  durationSafe, getCurrentTime, startTimeOffset, playerTime, commandedTime,
  zoom, neighbouringFrames, seekAbs, seekRel, duration, apparentCutSegments, zoomRel,
  setCurrentSegIndex, currentSegIndexSafe, invertCutSegments, inverseCutSegments, mainVideoStream, formatTimecode,
  waveform, shouldShowWaveform, shouldShowKeyframes, timelineHeight, thumbnails,
  onZoomWindowStartTimeChange, waveformEnabled, thumbnailsEnabled,
}) => {
  const timelineScrollerRef = useRef();
  const timelineScrollerSkipEventRef = useRef();
  const timelineWrapperRef = useRef();

  const offsetCurrentTime = (getCurrentTime() || 0) + startTimeOffset;


  const calculateTimelinePos = useCallback((time) => (time !== undefined && time < durationSafe ? `${(time / durationSafe) * 100}%` : undefined), [durationSafe]);

  const currentTimePos = useMemo(() => calculateTimelinePos(playerTime), [calculateTimelinePos, playerTime]);
  const commandedTimePos = useMemo(() => calculateTimelinePos(commandedTime), [calculateTimelinePos, commandedTime]);

  const zoomed = zoom > 1;

  const currentTimeWidth = 1;
  // Prevent it from overflowing (and causing scroll) when end of timeline

  // Keep cursor in view while scrolling
  useEffect(() => {
    timelineScrollerSkipEventRef.current = true;
    if (zoom > 1) {
      const zoomedTargetWidth = timelineScrollerRef.current.offsetWidth * (zoom - 1);

      timelineScrollerRef.current.scrollLeft = (getCurrentTime() / durationSafe) * zoomedTargetWidth;
    }
  }, [zoom, durationSafe, getCurrentTime]);

  const onTimelineScroll = useCallback((e) => {
    if (!zoomed) return;

    const zoomWindowStartTime = timelineScrollerRef.current
      ? (timelineScrollerRef.current.scrollLeft / (timelineScrollerRef.current.offsetWidth * zoom)) * duration
      : 0;

    onZoomWindowStartTimeChange(zoomWindowStartTime);

    if (timelineScrollerSkipEventRef.current) {
      timelineScrollerSkipEventRef.current = false;
      return;
    }

    seekAbs((((e.target.scrollLeft + (timelineScrollerRef.current.offsetWidth * 0.5))
      / (timelineScrollerRef.current.offsetWidth * zoom)) * duration));
  }, [duration, seekAbs, zoomed, zoom, onZoomWindowStartTimeChange]);

  const handleTap = useCallback((e) => {
    const target = timelineWrapperRef.current;
    const rect = target.getBoundingClientRect();
    const relX = e.srcEvent.pageX - (rect.left + document.body.scrollLeft);
    if (duration) seekAbs((relX / target.offsetWidth) * duration);
  }, [duration, seekAbs]);

  const onWheel = useCallback((e) => {
    const combinedDelta = e.deltaX + e.deltaY;
    if (e.ctrlKey) {
      zoomRel(-e.deltaY / 15);
    } else if (!zoomed) seekRel(combinedDelta / 15);
  }, [seekRel, zoomRel, zoomed]);

  return (
    <Hammer
      onTap={handleTap}
      onPan={handleTap}
      options={hammerOptions}
    >
      <div style={{ position: 'relative' }}>
        <div
          style={{ overflowX: 'scroll' }}
          id="timeline-scroller"
          onWheel={onWheel}
          onScroll={onTimelineScroll}
          ref={timelineScrollerRef}
        >
          {waveformEnabled && shouldShowWaveform && waveform && (
            <Waveform
              calculateTimelinePos={calculateTimelinePos}
              durationSafe={durationSafe}
              waveform={waveform}
              zoom={zoom}
              timelineHeight={timelineHeight}
            />
          )}

          {thumbnailsEnabled && (
            <div style={{ height: timelineHeight, width: `${zoom * 100}%`, position: 'relative' }}>
              {thumbnails.map((thumbnail) => (
                <img key={thumbnail.url} src={thumbnail.url} alt="" style={{ position: 'absolute', left: `${(thumbnail.time / durationSafe) * 100}%`, height: timelineHeight * 1.5, zIndex: 1, maxWidth: '13%', objectFit: 'cover', border: '1px solid rgba(255, 255, 255, 0.5)', borderBottomRightRadius: 15, borderTopLeftRadius: 15, borderTopRightRadius: 15 }} />
              ))}
            </div>
          )}

          <div
            style={{ height: timelineHeight, width: `${zoom * 100}%`, position: 'relative', backgroundColor: timelineBackground }}
            ref={timelineWrapperRef}
          >
            {currentTimePos !== undefined && <motion.div transition={{ type: 'spring', damping: 70, stiffness: 800 }} animate={{ left: currentTimePos }} style={{ position: 'absolute', bottom: 0, top: 0, zIndex: 3, backgroundColor: 'black', width: currentTimeWidth, pointerEvents: 'none' }} />}
            {commandedTimePos !== undefined && <div style={{ left: commandedTimePos, position: 'absolute', bottom: 0, top: 0, zIndex: 4, backgroundColor: 'white', width: currentTimeWidth, pointerEvents: 'none' }} />}

            {apparentCutSegments.map((seg, i) => {
              const {
                segBgColor, segActiveBgColor, segBorderColor,
              } = getSegColors(seg);

              return (
                <TimelineSeg
                  key={seg.uuid}
                  segNum={i}
                  segBgColor={segBgColor}
                  segActiveBgColor={segActiveBgColor}
                  segBorderColor={segBorderColor}
                  onSegClick={setCurrentSegIndex}
                  isActive={i === currentSegIndexSafe}
                  duration={durationSafe}
                  name={seg.name}
                  cutStart={seg.start}
                  cutEnd={seg.end}
                  invertCutSegments={invertCutSegments}
                  zoomed={zoomed}
                />
              );
            })}

            {inverseCutSegments && inverseCutSegments.map((seg) => (
              <InverseCutSegment
                // eslint-disable-next-line react/no-array-index-key
                key={`${seg.start},${seg.end}`}
                start={seg.start}
                end={seg.end}
                duration={durationSafe}
                invertCutSegments={invertCutSegments}
              />
            ))}

            {shouldShowKeyframes && neighbouringFrames.filter(f => f.keyframe).map((f) => (
              <div key={f.time} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(f.time / duration) * 100}%`, marginLeft: -1, width: 1, background: 'rgba(0,0,0,1)', pointerEvents: 'none' }} />
            ))}
          </div>
        </div>

        {(waveformEnabled && !thumbnailsEnabled && !shouldShowWaveform) && (
          <div style={{ position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center', height: timelineHeight, bottom: timelineHeight, left: 0, right: 0, color: 'rgba(255,255,255,0.6)' }}>
            Zoom in more to view waveform
          </div>
        )}

        <div style={{ position: 'absolute', height: timelineHeight, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 2 }}>
          <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 3, padding: '2px 4px', color: 'rgba(255, 255, 255, 0.8)' }}>
            {formatTimecode(offsetCurrentTime)}
          </div>
        </div>
      </div>
    </Hammer>
  );
});

export default Timeline;
