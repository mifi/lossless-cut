import React, { memo, useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import Hammer from 'react-hammerjs';
import debounce from 'lodash/debounce';
import { useTranslation } from 'react-i18next';
import { FaCaretDown, FaCaretUp } from 'react-icons/fa';

import TimelineSeg from './TimelineSeg';
import BetweenSegments from './BetweenSegments';
import useContextMenu from './hooks/useContextMenu';
import useUserSettings from './hooks/useUserSettings';


import { timelineBackground } from './colors';

import { getSegColor } from './util/colors';

const currentTimeWidth = 1;

const hammerOptions = { recognizers: {} };

const Waveform = memo(({ waveform, calculateTimelinePercent, durationSafe }) => {
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
    <img src={waveform.url} draggable={false} style={style} alt="" onLoad={onLoad} />
  );
});

const Waveforms = memo(({ calculateTimelinePercent, durationSafe, waveforms, zoom, timelineHeight }) => (
  <div style={{ height: timelineHeight, width: `${zoom * 100}%`, position: 'relative' }}>
    {waveforms.map((waveform) => (
      <Waveform key={`${waveform.from}-${waveform.to}`} waveform={waveform} calculateTimelinePercent={calculateTimelinePercent} durationSafe={durationSafe} />
    ))}
  </div>
));

const CommandedTime = memo(({ commandedTimePercent }) => {
  const color = 'white';
  const commonStyle = { left: commandedTimePercent, position: 'absolute', zIndex: 4, pointerEvents: 'none' };
  return (
    <>
      <FaCaretDown style={{ ...commonStyle, top: 0, color, fontSize: 14, marginLeft: -7, marginTop: -6 }} />
      <div style={{ ...commonStyle, bottom: 0, top: 0, backgroundColor: color, width: currentTimeWidth }} />
      <FaCaretUp style={{ ...commonStyle, bottom: 0, color, fontSize: 14, marginLeft: -7, marginBottom: -5 }} />
    </>
  );
});

const Timeline = memo(({
  durationSafe, getCurrentTime, startTimeOffset, playerTime, commandedTime,
  zoom, neighbouringKeyFrames, seekAbs, apparentCutSegments,
  setCurrentSegIndex, currentSegIndexSafe, inverseCutSegments, formatTimecode,
  waveforms, shouldShowWaveform, shouldShowKeyframes, timelineHeight = 36, thumbnails,
  onZoomWindowStartTimeChange, waveformEnabled, thumbnailsEnabled,
  playing, isFileOpened, onWheel, commandedTimeRef, goToTimecode,
}) => {
  const { t } = useTranslation();

  const { invertCutSegments } = useUserSettings();

  const timelineScrollerRef = useRef();
  const timelineScrollerSkipEventRef = useRef();
  const timelineScrollerSkipEventDebounce = useRef();
  const timelineWrapperRef = useRef();

  const [hoveringTime, setHoveringTime] = useState();

  const currentTime = getCurrentTime() || 0;
  const displayTime = (hoveringTime != null && isFileOpened && !playing ? hoveringTime : currentTime) + startTimeOffset;
  const displayTimePercent = useMemo(() => `${Math.round((displayTime / durationSafe) * 100)}%`, [displayTime, durationSafe]);

  const isZoomed = zoom > 1;

  // Don't show keyframes if too packed together (at current zoom)
  // See https://github.com/mifi/lossless-cut/issues/259
  // todo
  // const areKeyframesTooClose = keyframes.length > zoom * 200;
  const areKeyframesTooClose = false;

  const calculateTimelinePos = useCallback((time) => (time !== undefined ? Math.min(time / durationSafe, 1) : undefined), [durationSafe]);
  const calculateTimelinePercent = useCallback((time) => {
    const pos = calculateTimelinePos(time);
    return pos !== undefined ? `${pos * 100}%` : undefined;
  }, [calculateTimelinePos]);

  const currentTimePercent = useMemo(() => calculateTimelinePercent(playerTime), [calculateTimelinePercent, playerTime]);
  const commandedTimePercent = useMemo(() => calculateTimelinePercent(commandedTime), [calculateTimelinePercent, commandedTime]);

  const timeOfInterestPosPixels = useMemo(() => {
    // https://github.com/mifi/lossless-cut/issues/676
    const pos = calculateTimelinePos(playerTime);
    if (pos != null && timelineScrollerRef.current) return pos * zoom * timelineScrollerRef.current.offsetWidth;
    return undefined;
  }, [calculateTimelinePos, playerTime, zoom]);

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
    if (timeOfInterestPosPixels == null || timelineScrollerSkipEventRef.current) return;

    if (timeOfInterestPosPixels > timelineScrollerRef.current.scrollLeft + timelineScrollerRef.current.offsetWidth) {
      const timelineWidth = timelineWrapperRef.current.offsetWidth;
      const scrollLeft = timeOfInterestPosPixels - (timelineScrollerRef.current.offsetWidth * 0.1);
      scrollLeftMotion.set(Math.min(scrollLeft, timelineWidth - timelineScrollerRef.current.offsetWidth));
    } else if (timeOfInterestPosPixels < timelineScrollerRef.current.scrollLeft) {
      const scrollLeft = timeOfInterestPosPixels - (timelineScrollerRef.current.offsetWidth * 0.9);
      scrollLeftMotion.set(Math.max(scrollLeft, 0));
    }
  }, [timeOfInterestPosPixels, scrollLeftMotion]);

  // Keep cursor in middle while zooming
  useEffect(() => {
    suppressScrollerEvents();

    if (isZoomed) {
      const zoomedTargetWidth = timelineScrollerRef.current.offsetWidth * zoom;

      const scrollLeft = Math.max((commandedTimeRef.current / durationSafe) * zoomedTargetWidth - timelineScrollerRef.current.offsetWidth / 2, 0);
      scrollLeftMotion.set(scrollLeft);
      timelineScrollerRef.current.scrollLeft = scrollLeft;
    }
  }, [zoom, durationSafe, commandedTimeRef, scrollLeftMotion, isZoomed]);


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

  const contextMenuTemplate = useMemo(() => [
    { label: t('Seek to timecode'), click: goToTimecode },
  ], [goToTimecode, t]);

  useContextMenu(timelineScrollerRef, contextMenuTemplate);

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
          {waveformEnabled && shouldShowWaveform && waveforms.length > 0 && (
            <Waveforms
              calculateTimelinePercent={calculateTimelinePercent}
              durationSafe={durationSafe}
              waveforms={waveforms}
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
            {currentTimePercent !== undefined && (
              <motion.div transition={{ type: 'spring', damping: 70, stiffness: 800 }} animate={{ left: currentTimePercent }} style={{ position: 'absolute', bottom: 0, top: 0, zIndex: 3, backgroundColor: 'rgba(255,255,255,0.6)', width: currentTimeWidth, pointerEvents: 'none' }} />
            )}
            {commandedTimePercent !== undefined && (
              <CommandedTime commandedTimePercent={commandedTimePercent} />
            )}

            {apparentCutSegments.map((seg, i) => {
              const segColor = getSegColor(seg);

              if (seg.start === 0 && seg.end === 0) return null; // No video loaded

              return (
                <TimelineSeg
                  key={seg.segId}
                  segNum={i}
                  segBgColor={segColor.alpha(0.6).string()}
                  segActiveBgColor={segColor.alpha(0.7).string()}
                  segBorderColor={segColor.lighten(0.2).string()}
                  onSegClick={setCurrentSegIndex}
                  isActive={i === currentSegIndexSafe}
                  duration={durationSafe}
                  name={seg.name}
                  cutStart={seg.start}
                  cutEnd={seg.end}
                  invertCutSegments={invertCutSegments}
                  formatTimecode={formatTimecode}
                />
              );
            })}

            {inverseCutSegments.map((seg) => (
              <BetweenSegments
                // eslint-disable-next-line react/no-array-index-key
                key={`${seg.start},${seg.end}`}
                start={seg.start}
                end={seg.end}
                duration={durationSafe}
                invertCutSegments={invertCutSegments}
              />
            ))}

            {shouldShowKeyframes && !areKeyframesTooClose && neighbouringKeyFrames.map((f) => (
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
            {formatTimecode({ seconds: displayTime })}{isZoomed ? ` ${displayTimePercent}` : ''}
          </div>
        </div>
      </div>
    </Hammer>
  );
});

export default Timeline;
