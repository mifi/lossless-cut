import React, { memo, useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import Hammer from 'react-hammerjs';
import debounce from 'lodash/debounce';
import { useTranslation } from 'react-i18next';

import TimelineSeg from './TimelineSeg';
import InverseCutSegment from './InverseCutSegment';


import { timelineBackground } from './colors';

import { getSegColors } from './util';


const hammerOptions = { recognizers: {} };

const Waveform = memo(({ calculateTimelinePercent, durationSafe, waveform, zoom, timelineHeight }) => {
  const imgRef = useRef();
  const [style, setStyle] = useState({ display: 'none' });

  const leftPos = calculateTimelinePercent(waveform.from);

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
  zoom, neighbouringFrames, seekAbs, apparentCutSegments,
  setCurrentSegIndex, currentSegIndexSafe, invertCutSegments, inverseCutSegments, formatTimecode,
  waveform, shouldShowWaveform, shouldShowKeyframes, timelineHeight, thumbnails,
  onZoomWindowStartTimeChange, waveformEnabled, thumbnailsEnabled,
  playing, isFileOpened, onWheel, commandedTimeRef,
}) => {
  const { t } = useTranslation();

  const timelineScrollerRef = useRef();
  const timelineScrollerSkipEventRef = useRef();
  const timelineScrollerSkipEventDebounce = useRef();
  const timelineWrapperRef = useRef();

  const [hoveringTime, setHoveringTime] = useState();

  const currentTime = getCurrentTime() || 0;
  const displayTime = (hoveringTime != null && isFileOpened && !playing ? hoveringTime : currentTime) + startTimeOffset;

  const keyframes = neighbouringFrames ? neighbouringFrames.filter(f => f.keyframe) : [];
  // Don't show keyframes if too packed together (at current zoom)
  // See https://github.com/mifi/lossless-cut/issues/259
  const areKeyframesTooClose = keyframes.length > zoom * 200;

  const calculateTimelinePos = useCallback((time) => (time !== undefined && time < durationSafe ? time / durationSafe : undefined), [durationSafe]);
  const calculateTimelinePercent = useCallback((time) => {
    const pos = calculateTimelinePos(time);
    return pos !== undefined ? `${pos * 100}%` : undefined;
  }, [calculateTimelinePos]);

  const currentTimePercent = useMemo(() => calculateTimelinePercent(playerTime), [calculateTimelinePercent, playerTime]);
  const commandedTimePercent = useMemo(() => calculateTimelinePercent(commandedTime), [calculateTimelinePercent, commandedTime]);

  const commandedTimePosPixels = useMemo(() => {
    const pos = calculateTimelinePos(commandedTime);
    if (pos != null && timelineScrollerRef.current) return pos * zoom * timelineScrollerRef.current.offsetWidth;
    return undefined;
  }, [calculateTimelinePos, commandedTime, zoom]);

  const calcZoomWindowStartTime = useCallback(() => (timelineScrollerRef.current
    ? (timelineScrollerRef.current.scrollLeft / (timelineScrollerRef.current.offsetWidth * zoom)) * durationSafe
    : 0), [durationSafe, zoom]);

  // const zoomWindowStartTime = calcZoomWindowStartTime(duration, zoom);

  useEffect(() => {
    timelineScrollerSkipEventDebounce.current = debounce(() => {
      timelineScrollerSkipEventRef.current = false;
    }, 1000);
  }, []);

  function suppressScrollerEvents() {
    timelineScrollerSkipEventRef.current = true;
    timelineScrollerSkipEventDebounce.current();
  }

  const scrollLeftMotion = useMotionValue(0);

  const spring = useSpring(scrollLeftMotion, { damping: 100, stiffness: 1000 });

  useEffect(() => {
    spring.onChange(value => {
      if (timelineScrollerSkipEventRef.current) return; // Don't animate while zooming
      timelineScrollerRef.current.scrollLeft = value;
    });
  }, [spring]);

  // Pan timeline when cursor moves out of timeline window
  useEffect(() => {
    if (commandedTimePosPixels == null || timelineScrollerSkipEventRef.current) return;

    if (commandedTimePosPixels > timelineScrollerRef.current.scrollLeft + timelineScrollerRef.current.offsetWidth) {
      const timelineWidth = timelineWrapperRef.current.offsetWidth;
      const scrollLeft = commandedTimePosPixels - (timelineScrollerRef.current.offsetWidth * 0.1);
      scrollLeftMotion.set(Math.min(scrollLeft, timelineWidth - timelineScrollerRef.current.offsetWidth));
    } else if (commandedTimePosPixels < timelineScrollerRef.current.scrollLeft) {
      const scrollLeft = commandedTimePosPixels - (timelineScrollerRef.current.offsetWidth * 0.9);
      scrollLeftMotion.set(Math.max(scrollLeft, 0));
    }
  }, [commandedTimePosPixels, scrollLeftMotion]);

  const currentTimeWidth = 1;

  // Keep cursor in middle while zooming
  useEffect(() => {
    suppressScrollerEvents();

    if (zoom > 1) {
      const zoomedTargetWidth = timelineScrollerRef.current.offsetWidth * zoom;

      const scrollLeft = Math.max((commandedTimeRef.current / durationSafe) * zoomedTargetWidth - timelineScrollerRef.current.offsetWidth / 2, 0);
      scrollLeftMotion.set(scrollLeft);
      timelineScrollerRef.current.scrollLeft = scrollLeft;
    }
  }, [zoom, durationSafe, commandedTimeRef, scrollLeftMotion]);


  useEffect(() => {
    const cancelWheel = (event) => event.preventDefault();

    const scroller = timelineScrollerRef.current;
    scroller.addEventListener('wheel', cancelWheel, { passive: false });

    return () => {
      scroller.removeEventListener('wheel', cancelWheel);
    };
  }, []);

  const onTimelineScroll = useCallback(() => {
    onZoomWindowStartTimeChange(calcZoomWindowStartTime());
  }, [calcZoomWindowStartTime, onZoomWindowStartTimeChange]);

  // Keep cursor in middle while scrolling
  /* const onTimelineScroll = useCallback((e) => {
    onZoomWindowStartTimeChange(zoomWindowStartTime);

    if (!zoomed || timelineScrollerSkipEventRef.current) return;

    seekAbs((((e.target.scrollLeft + (timelineScrollerRef.current.offsetWidth * 0.5))
      / (timelineScrollerRef.current.offsetWidth * zoom)) * duration));
  }, [duration, seekAbs, zoomed, zoom, zoomWindowStartTime, onZoomWindowStartTimeChange]); */

  const getMouseTimelinePos = useCallback((e) => {
    const target = timelineWrapperRef.current;
    const rect = target.getBoundingClientRect();
    const relX = e.pageX - (rect.left + document.body.scrollLeft);
    return (relX / target.offsetWidth) * durationSafe;
  }, [durationSafe]);

  const handleTap = useCallback((e) => {
    seekAbs((getMouseTimelinePos(e.srcEvent)));
  }, [seekAbs, getMouseTimelinePos]);

  useEffect(() => {
    setHoveringTime();
  }, [playerTime, commandedTime]);

  const onMouseMove = useCallback((e) => setHoveringTime(getMouseTimelinePos(e.nativeEvent)), [getMouseTimelinePos]);
  const onMouseOut = useCallback(() => setHoveringTime(), []);

  return (
    // eslint-disable-next-line jsx-a11y/mouse-events-have-key-events
    <Hammer
      onTap={handleTap}
      onPan={handleTap}
      onMouseMove={onMouseMove}
      onMouseOut={onMouseOut}
      options={hammerOptions}
    >
      <div style={{ position: 'relative' }}>
        <div
          style={{ overflowX: 'scroll' }}
          className="hide-scrollbar"
          onWheel={onWheel}
          onScroll={onTimelineScroll}
          ref={timelineScrollerRef}
        >
          {waveformEnabled && shouldShowWaveform && waveform && (
            <Waveform
              calculateTimelinePercent={calculateTimelinePercent}
              durationSafe={durationSafe}
              waveform={waveform}
              zoom={zoom}
              timelineHeight={timelineHeight}
            />
          )}

          {thumbnailsEnabled && (
            <div style={{ height: timelineHeight, width: `${zoom * 100}%`, position: 'relative' }}>
              {thumbnails.map((thumbnail, i) => {
                const leftPercent = (thumbnail.time / durationSafe) * 100;
                const nextThumbnail = thumbnails[i + 1];
                const nextThumbTime = nextThumbnail ? nextThumbnail.time : durationSafe;
                const maxWidthPercent = ((nextThumbTime - thumbnail.time) / durationSafe) * 100 * 0.9;
                return (
                  <img key={thumbnail.url} src={thumbnail.url} alt="" style={{ position: 'absolute', left: `${leftPercent}%`, height: timelineHeight * 1.5, zIndex: 1, maxWidth: `${maxWidthPercent}%`, objectFit: 'cover', border: '1px solid rgba(255, 255, 255, 0.5)', borderBottomRightRadius: 15, borderTopLeftRadius: 15, borderTopRightRadius: 15, pointerEvents: 'none' }} />
                );
              })}
            </div>
          )}

          <div
            style={{ height: timelineHeight, width: `${zoom * 100}%`, position: 'relative', backgroundColor: timelineBackground }}
            ref={timelineWrapperRef}
          >
            {currentTimePercent !== undefined && <motion.div transition={{ type: 'spring', damping: 70, stiffness: 800 }} animate={{ left: currentTimePercent }} style={{ position: 'absolute', bottom: 0, top: 0, zIndex: 3, backgroundColor: 'rgba(255,255,255,0.6)', width: currentTimeWidth, pointerEvents: 'none' }} />}
            {commandedTimePercent !== undefined && <div style={{ left: commandedTimePercent, position: 'absolute', bottom: 0, top: 0, zIndex: 4, backgroundColor: 'white', width: currentTimeWidth, pointerEvents: 'none' }} />}

            {apparentCutSegments.map((seg, i) => {
              const { segBgColor, segActiveBgColor, segBorderColor } = getSegColors(seg);

              if (seg.start === 0 && seg.end === 0) return null; // No video loaded

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

            {shouldShowKeyframes && !areKeyframesTooClose && keyframes.map((f) => (
              <div key={f.time} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(f.time / durationSafe) * 100}%`, marginLeft: -1, width: 1, background: 'rgba(0,0,0,0.4)', pointerEvents: 'none' }} />
            ))}
          </div>
        </div>

        {(waveformEnabled && !thumbnailsEnabled && !shouldShowWaveform) && (
          <div style={{ position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center', height: timelineHeight, bottom: timelineHeight, left: 0, right: 0, color: 'rgba(255,255,255,0.6)' }}>
            {t('Zoom in more to view waveform')}
          </div>
        )}

        <div style={{ position: 'absolute', height: timelineHeight, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 2 }}>
          <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 3, padding: '2px 4px', color: 'rgba(255, 255, 255, 0.8)' }}>
            {formatTimecode(displayTime)}
          </div>
        </div>
      </div>
    </Hammer>
  );
});

export default Timeline;
