import React, { memo, useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Hammer from 'react-hammerjs';
import debounce from 'lodash/debounce';
import { useTranslation } from 'react-i18next';

import TimelineSeg from './TimelineSeg';
import InverseCutSegment from './InverseCutSegment';
import normalizeWheel from './normalizeWheel';


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
  zoom, neighbouringFrames, seekAbs, seekRel, duration, apparentCutSegments, zoomRel,
  setCurrentSegIndex, currentSegIndexSafe, invertCutSegments, inverseCutSegments, formatTimecode,
  waveform, shouldShowWaveform, shouldShowKeyframes, timelineHeight, thumbnails,
  onZoomWindowStartTimeChange, waveformEnabled, thumbnailsEnabled, wheelSensitivity,
  invertTimelineScroll,
}) => {
  const { t } = useTranslation();

  const timelineScrollerRef = useRef();
  const timelineScrollerSkipEventRef = useRef();
  const timelineScrollerSkipEventDebounce = useRef();
  const timelineWrapperRef = useRef();

  const offsetCurrentTime = (getCurrentTime() || 0) + startTimeOffset;


  const calculateTimelinePos = useCallback((time) => (time !== undefined && time < durationSafe ? time / durationSafe : undefined), [durationSafe]);
  const calculateTimelinePercent = useCallback((time) => {
    const pos = calculateTimelinePos(time);
    return pos !== undefined ? `${pos * 100}%` : undefined;
  }, [calculateTimelinePos]);

  const currentTimePercent = useMemo(() => calculateTimelinePercent(playerTime), [calculateTimelinePercent, playerTime]);
  const commandedTimePercent = useMemo(() => calculateTimelinePercent(commandedTime), [calculateTimelinePercent, commandedTime]);

  const currentTimePosPixels = useMemo(() => {
    const pos = calculateTimelinePos(playerTime);
    if (pos != null) return pos * zoom * timelineScrollerRef.current.offsetWidth;
    return undefined;
  }, [calculateTimelinePos, playerTime, zoom]);

  const calcZoomWindowStartTime = useCallback(() => (timelineScrollerRef.current
    ? (timelineScrollerRef.current.scrollLeft / (timelineScrollerRef.current.offsetWidth * zoom)) * duration
    : 0), [duration, zoom]);

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

  // Pan timeline when cursor moves out of timeline window
  useEffect(() => {
    if (currentTimePosPixels == null || timelineScrollerSkipEventRef.current) return;

    if (currentTimePosPixels > timelineScrollerRef.current.scrollLeft + timelineScrollerRef.current.offsetWidth) {
      suppressScrollerEvents();
      timelineScrollerRef.current.scrollLeft += timelineScrollerRef.current.offsetWidth * 0.9;
    } else if (currentTimePosPixels < timelineScrollerRef.current.scrollLeft) {
      suppressScrollerEvents();
      timelineScrollerRef.current.scrollLeft -= timelineScrollerRef.current.offsetWidth * 0.9;
    }
  }, [currentTimePosPixels]);

  const currentTimeWidth = 1;

  // Keep cursor in middle while zooming
  useEffect(() => {
    suppressScrollerEvents();

    if (zoom > 1) {
      const zoomedTargetWidth = timelineScrollerRef.current.offsetWidth * zoom;

      timelineScrollerRef.current.scrollLeft = Math.max((getCurrentTime() / durationSafe) * zoomedTargetWidth - timelineScrollerRef.current.offsetWidth / 2, 0);
    }
  }, [zoom, durationSafe, getCurrentTime]);


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


  const handleTap = useCallback((e) => {
    const target = timelineWrapperRef.current;
    const rect = target.getBoundingClientRect();
    const relX = e.srcEvent.pageX - (rect.left + document.body.scrollLeft);
    if (duration) seekAbs((relX / target.offsetWidth) * duration);
  }, [duration, seekAbs]);

  const onWheel = useCallback((e) => {
    const { pixelX, pixelY } = normalizeWheel(e);
    // console.log({ spinX, spinY, pixelX, pixelY });

    const seekDirection = invertTimelineScroll ? 1 : -1;
    const zoomDirection = invertTimelineScroll ? -1 : 1;

    if (e.ctrlKey) {
      zoomRel(zoomDirection * (pixelY) * wheelSensitivity * 0.4);
    } else {
      seekRel(seekDirection * (pixelX + pixelY) * wheelSensitivity * 0.2);
    }
  }, [seekRel, zoomRel, wheelSensitivity, invertTimelineScroll]);

  return (
    <Hammer
      onTap={handleTap}
      onPan={handleTap}
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
            {t('Zoom in more to view waveform')}
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
