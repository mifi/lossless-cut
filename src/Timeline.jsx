import React, { memo, useRef, useMemo, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import Hammer from 'react-hammerjs';

import TimelineSeg from './TimelineSeg';
import InverseCutSegment from './InverseCutSegment';

import { timelineBackground } from './colors';

import { getSegColors } from './util';


const hammerOptions = { recognizers: {} };

const Timeline = memo(({
  durationSafe, getCurrentTime, startTimeOffset, playerTime, commandedTime,
  zoom, neighbouringFrames, seekAbs, seekRel, duration, apparentCutSegments, zoomRel,
  setCurrentSegIndex, currentSegIndexSafe, invertCutSegments, inverseCutSegments, mainVideoStream, formatTimecode,
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

  const shouldShowKeyframes = neighbouringFrames.length >= 2 && (neighbouringFrames[neighbouringFrames.length - 1].time - neighbouringFrames[0].time) / durationSafe > (0.1 / zoom);

  useEffect(() => {
    timelineScrollerSkipEventRef.current = true;
    if (zoom > 1) {
      timelineScrollerRef.current.scrollLeft = (getCurrentTime() / durationSafe)
        * (timelineWrapperRef.current.offsetWidth - timelineScrollerRef.current.offsetWidth);
    }
  }, [zoom, durationSafe, getCurrentTime]);

  const onTimelineScroll = useCallback((e) => {
    if (timelineScrollerSkipEventRef.current) {
      timelineScrollerSkipEventRef.current = false;
      return;
    }
    if (!zoomed) return;
    seekAbs((((e.target.scrollLeft + (timelineScrollerRef.current.offsetWidth / 2))
      / timelineWrapperRef.current.offsetWidth) * duration));
  }, [duration, seekAbs, zoomed]);

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
          <div
            style={{ height: 36, width: `${zoom * 100}%`, position: 'relative', backgroundColor: timelineBackground }}
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

            {mainVideoStream && shouldShowKeyframes && neighbouringFrames.filter(f => f.keyframe).map((f) => (
              <div key={f.time} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(f.time / duration) * 100}%`, marginLeft: -1, width: 1, background: 'rgba(0,0,0,1)', pointerEvents: 'none' }} />
            ))}
          </div>
        </div>

        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 3, padding: '2px 4px', color: 'rgba(255, 255, 255, 0.8)' }}>
            {formatTimecode(offsetCurrentTime)}
          </div>
        </div>
      </div>
    </Hammer>
  );
});

export default Timeline;
