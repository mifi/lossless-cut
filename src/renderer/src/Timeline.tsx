import { memo, useRef, useMemo, useCallback, useEffect, useState, MutableRefObject, CSSProperties, WheelEventHandler, MouseEventHandler } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import debounce from 'lodash/debounce';
import { useTranslation } from 'react-i18next';
import { FaCaretDown, FaCaretUp } from 'react-icons/fa';
import invariant from 'tiny-invariant';

import TimelineSeg from './TimelineSeg';
import BetweenSegments from './BetweenSegments';
import useContextMenu from './hooks/useContextMenu';
import useUserSettings from './hooks/useUserSettings';

import styles from './Timeline.module.css';


import { timelineBackground, darkModeTransition } from './colors';
import { Frame } from './ffmpeg';
import { FormatTimecode, InverseCutSegment, OverviewWaveform, RenderableWaveform, WaveformSlice, StateSegment, Thumbnail } from './types';
import Button from './components/Button';


type CalculateTimelinePercent = (time: number) => string | undefined;

const currentTimeWidth = 1;

// eslint-disable-next-line react/display-name
const Waveform = memo(({ waveform, calculateTimelinePercent, fileDurationNonZero, darkMode }: {
  waveform: RenderableWaveform,
  calculateTimelinePercent: CalculateTimelinePercent,
  fileDurationNonZero: number,
  darkMode: boolean,
}) => {
  const leftPos = 'from' in waveform ? calculateTimelinePercent(waveform.from) : '0%';

  const width = 'to' in waveform ? ((Math.min(waveform.to, fileDurationNonZero) - waveform.from) / fileDurationNonZero) * 100 : 100;

  const style = useMemo<CSSProperties>(() => ({
    pointerEvents: 'none', position: 'absolute', height: '100%', left: leftPos, width: `${width}%`, filter: darkMode ? undefined : 'invert(1)', imageRendering: 'pixelated',
  }), [darkMode, leftPos, width]);

  if (waveform.url == null) {
    return <div style={{ ...style }} className={styles['loading-bg']} />;
  }

  return (
    <img src={waveform.url} draggable={false} style={style} alt="" />
  );
});

// eslint-disable-next-line react/display-name
const Waveforms = memo(({ calculateTimelinePercent, fileDurationNonZero, waveforms, overviewWaveform, zoom, darkMode, height }: {
  calculateTimelinePercent: CalculateTimelinePercent,
  fileDurationNonZero: number,
  waveforms: WaveformSlice[],
  overviewWaveform: OverviewWaveform | undefined,
  zoom: number,
  darkMode: boolean,
  height: number,
}) => (
  <div style={{ height, width: `${zoom * 100}%`, position: 'relative' }}>
    {zoom === 1 && overviewWaveform != null ? (
      <Waveform waveform={overviewWaveform} calculateTimelinePercent={calculateTimelinePercent} fileDurationNonZero={fileDurationNonZero} darkMode={darkMode} />
    ) : waveforms.map((waveform) => (
      <Waveform key={`${waveform.from}-${waveform.to}`} waveform={waveform} calculateTimelinePercent={calculateTimelinePercent} fileDurationNonZero={fileDurationNonZero} darkMode={darkMode} />
    ))}
  </div>
));

// eslint-disable-next-line react/display-name
const CommandedTime = memo(({ commandedTimePercent }: { commandedTimePercent: string }) => {
  const color = 'var(--gray12)';
  const commonStyle: CSSProperties = { left: commandedTimePercent, position: 'absolute', pointerEvents: 'none' };
  return (
    <>
      <FaCaretDown style={{ ...commonStyle, top: 0, color, fontSize: 14, marginLeft: -7, marginTop: -6 }} />
      <div style={{ ...commonStyle, bottom: 0, top: 0, backgroundColor: color, width: currentTimeWidth }} />
      <FaCaretUp style={{ ...commonStyle, bottom: 0, color, fontSize: 14, marginLeft: -7, marginBottom: -5 }} />
    </>
  );
});

const timelineHeight = 36;

const timeWrapperStyle: CSSProperties = { height: timelineHeight };

function Timeline({
  fileDurationNonZero,
  startTimeOffset,
  playerTime,
  commandedTime,
  relevantTime,
  zoom,
  neighbouringKeyFrames,
  seekAbs,
  cutSegments,
  setCurrentSegIndex,
  currentSegIndexSafe,
  inverseCutSegments,
  formatTimecode,
  formatTimeAndFrames,
  waveforms,
  overviewWaveform,
  shouldShowWaveform,
  shouldShowKeyframes,
  thumbnails,
  zoomWindowStartTime,
  zoomWindowEndTime,
  onZoomWindowStartTimeChange,
  onGenerateOverviewWaveformClick,
  waveformEnabled,
  waveformHeight,
  showThumbnails,
  playing,
  isFileOpened,
  onWheel,
  commandedTimeRef,
  goToTimecode,
  isSegmentSelected,
  darkMode,
} : {
  fileDurationNonZero: number,
  startTimeOffset: number,
  playerTime: number | undefined,
  commandedTime: number,
  relevantTime: number,
  zoom: number,
  neighbouringKeyFrames: Frame[],
  seekAbs: (a: number) => void,
  cutSegments: StateSegment[],
  setCurrentSegIndex: (a: number) => void,
  currentSegIndexSafe: number,
  inverseCutSegments: InverseCutSegment[],
  formatTimecode: FormatTimecode,
  formatTimeAndFrames: (a: number) => string,
  waveforms: WaveformSlice[],
  overviewWaveform: OverviewWaveform | undefined,
  shouldShowWaveform: boolean,
  shouldShowKeyframes: boolean,
  thumbnails: Thumbnail[],
  zoomWindowStartTime: number,
  zoomWindowEndTime: number | undefined,
  onZoomWindowStartTimeChange: (a: number) => void,
  onGenerateOverviewWaveformClick: () => void,
  waveformEnabled: boolean,
  waveformHeight: number,
  showThumbnails: boolean,
  playing: boolean,
  isFileOpened: boolean,
  onWheel: WheelEventHandler,
  commandedTimeRef: MutableRefObject<number>,
  goToTimecode: () => void,
  isSegmentSelected: (a: { segId: string }) => boolean,
  darkMode: boolean,
}) {
  const { t } = useTranslation();

  const { invertCutSegments } = useUserSettings();

  const timelineScrollerRef = useRef<HTMLDivElement>(null);
  const timelineScrollerSkipEventRef = useRef<boolean>(false);
  const timelineScrollerSkipEventDebounce = useRef<() => void>();
  const timelineWrapperRef = useRef<HTMLDivElement>(null);

  const [hoveringTime, setHoveringTime] = useState<number>();

  const displayTime = (hoveringTime != null && isFileOpened && !playing ? hoveringTime : relevantTime) + startTimeOffset;
  const displayTimePercent = useMemo(() => `${Math.round((displayTime / fileDurationNonZero) * 100)}%`, [displayTime, fileDurationNonZero]);

  const isZoomed = zoom > 1;

  const keyFramesInZoomWindow = useMemo(() => (zoomWindowEndTime == null ? [] : neighbouringKeyFrames.filter((f) => f.time >= zoomWindowStartTime && f.time <= zoomWindowEndTime)), [neighbouringKeyFrames, zoomWindowEndTime, zoomWindowStartTime]);

  // Don't show keyframes if too packed together (at current zoom)
  // See https://github.com/mifi/lossless-cut/issues/259
  const areKeyframesTooClose = keyFramesInZoomWindow.length > zoom * 200;

  const calculateTimelinePos = useCallback((time: number | undefined) => (time !== undefined ? Math.min(time / fileDurationNonZero, 1) : undefined), [fileDurationNonZero]);
  const calculateTimelinePercent = useCallback((time: number | undefined) => {
    const pos = calculateTimelinePos(time);
    return pos !== undefined ? `${pos * 100}%` : undefined;
  }, [calculateTimelinePos]);

  const currentTimePercent = useMemo(() => calculateTimelinePercent(playerTime), [calculateTimelinePercent, playerTime]);
  const commandedTimePercent = useMemo(() => calculateTimelinePercent(commandedTime), [calculateTimelinePercent, commandedTime]);

  const timeOfInterestPosPixels = useMemo(() => {
    // https://github.com/mifi/lossless-cut/issues/676
    const pos = calculateTimelinePos(relevantTime);
    if (pos != null && timelineScrollerRef.current) return pos * zoom * timelineScrollerRef.current!.offsetWidth;
    return undefined;
  }, [calculateTimelinePos, relevantTime, zoom]);

  const calcZoomWindowStartTime = useCallback(() => (timelineScrollerRef.current
    ? (timelineScrollerRef.current.scrollLeft / (timelineScrollerRef.current!.offsetWidth * zoom)) * fileDurationNonZero
    : 0), [fileDurationNonZero, zoom]);

  // const zoomWindowStartTime = calcZoomWindowStartTime(duration, zoom);

  useEffect(() => {
    timelineScrollerSkipEventDebounce.current = debounce(() => {
      timelineScrollerSkipEventRef.current = false;
    }, 1000);
  }, []);

  function suppressScrollerEvents() {
    timelineScrollerSkipEventRef.current = true;
    timelineScrollerSkipEventDebounce.current?.();
  }

  const scrollLeftMotion = useMotionValue(0);

  const spring = useSpring(scrollLeftMotion, { damping: 100, stiffness: 1000 });

  useEffect(() => {
    spring.on('change', (value) => {
      if (timelineScrollerSkipEventRef.current) return; // Don't animate while zooming
      timelineScrollerRef.current!.scrollLeft = value;
    });
  }, [spring]);

  // Pan timeline when cursor moves out of timeline window
  useEffect(() => {
    if (timeOfInterestPosPixels == null || timelineScrollerSkipEventRef.current) return;

    invariant(timelineScrollerRef.current != null);
    if (timeOfInterestPosPixels > timelineScrollerRef.current.scrollLeft + timelineScrollerRef.current.offsetWidth) {
      const timelineWidth = timelineWrapperRef.current!.offsetWidth;
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
      invariant(timelineScrollerRef.current != null);
      const zoomedTargetWidth = timelineScrollerRef.current.offsetWidth * zoom;

      const scrollLeft = Math.max((commandedTimeRef.current / fileDurationNonZero) * zoomedTargetWidth - timelineScrollerRef.current.offsetWidth / 2, 0);
      scrollLeftMotion.set(scrollLeft);
      timelineScrollerRef.current.scrollLeft = scrollLeft;
    }
  }, [zoom, fileDurationNonZero, commandedTimeRef, scrollLeftMotion, isZoomed]);


  useEffect(() => {
    const cancelWheel = (event: WheelEvent) => event.preventDefault();

    const scroller = timelineScrollerRef.current;
    invariant(scroller != null);
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

  const getMouseTimelinePos = useCallback((e: MouseEvent) => {
    const target = timelineWrapperRef.current;
    invariant(target != null);
    const rect = target.getBoundingClientRect();
    const relX = e.pageX - (rect.left + document.body.scrollLeft);
    return (relX / target.offsetWidth) * fileDurationNonZero;
  }, [fileDurationNonZero]);

  const mouseDownRef = useRef<unknown>();

  const handleScrub = useCallback((e: MouseEvent) => seekAbs((getMouseTimelinePos(e))), [seekAbs, getMouseTimelinePos]);

  useEffect(() => {
    setHoveringTime(undefined);
  }, [relevantTime]);

  const onMouseDown = useCallback<MouseEventHandler<HTMLElement>>((e) => {
    if (e.nativeEvent.buttons !== 1) return; // not primary button

    handleScrub(e.nativeEvent);

    mouseDownRef.current = e.target;

    function onMouseMove(e2: MouseEvent) {
      if (mouseDownRef.current == null) return;
      seekAbs(getMouseTimelinePos(e2));
    }

    function onMouseUp() {
      mouseDownRef.current = undefined;
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
    }

    // https://github.com/mifi/lossless-cut/issues/1432
    // https://stackoverflow.com/questions/11533098/how-to-catch-mouse-up-event-outside-of-element
    // https://stackoverflow.com/questions/6073505/what-is-the-difference-between-screenx-y-clientx-y-and-pagex-y
    window.addEventListener('mouseup', onMouseUp, { once: true });
    window.addEventListener('mousemove', onMouseMove);
  }, [getMouseTimelinePos, handleScrub, seekAbs]);

  const timeRef = useRef<HTMLDivElement>(null);

  const onMouseMove = useCallback<MouseEventHandler<HTMLDivElement>>((e) => {
    // need to manually check, because we cannot use css :hover when pointer-events: none
    // and we need pointer-events: none on time because we want to be able to click through it to segments behind (and they are not parent)
    const rect = timeRef.current?.getBoundingClientRect();
    const isInBounds = rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
    timeRef.current?.style.setProperty('opacity', isInBounds ? '0.2' : '1');

    if (!mouseDownRef.current) { // no button pressed
      setHoveringTime(getMouseTimelinePos(e.nativeEvent));
    }
    e.preventDefault();
  }, [getMouseTimelinePos]);

  const onMouseOut = useCallback(() => setHoveringTime(undefined), []);

  const contextMenuTemplate = useMemo(() => [
    { label: t('Seek to timecode'), click: goToTimecode },
  ], [goToTimecode, t]);

  useContextMenu(timelineScrollerRef, contextMenuTemplate);

  const onGenerateOverviewWaveformClick2 = useCallback<MouseEventHandler<HTMLButtonElement>>((e) => {
    e.preventDefault(); // todo this doesn't work. dunno why
    onGenerateOverviewWaveformClick();
  }, [onGenerateOverviewWaveformClick]);

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions,jsx-a11y/mouse-events-have-key-events
    <div
      style={{ position: 'relative', borderTop: '1px solid var(--gray7)', borderBottom: '1px solid var(--gray7)' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      // eslint-disable-next-line jsx-a11y/mouse-events-have-key-events
      onMouseOut={onMouseOut}
    >
      {(waveformEnabled && !shouldShowWaveform) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: timelineHeight, bottom: timelineHeight, left: 0, right: 0, color: 'var(--gray11)' }}>
          {t('Zoom in more to view waveform')}
          <Button onClick={onGenerateOverviewWaveformClick2} style={{ marginLeft: '.5em' }}>{t('Load overview')}</Button>
        </div>
      )}

      <div
        style={{ overflowX: 'scroll', overflowY: 'hidden' }}
        className="hide-scrollbar"
        onWheel={onWheel}
        onScroll={onTimelineScroll}
        ref={timelineScrollerRef}
      >
        {waveformEnabled && shouldShowWaveform && (waveforms.length > 0 || overviewWaveform != null) && (
          <Waveforms
            calculateTimelinePercent={calculateTimelinePercent}
            fileDurationNonZero={fileDurationNonZero}
            waveforms={waveforms}
            overviewWaveform={overviewWaveform}
            zoom={zoom}
            darkMode={darkMode}
            height={waveformHeight}
          />
        )}

        {showThumbnails && (
          <div style={{ height: 60, width: `${zoom * 100}%`, position: 'relative', marginBottom: 3 }}>
            {thumbnails.map((thumbnail, i) => {
              const leftPercent = (thumbnail.time / fileDurationNonZero) * 100;
              const nextThumbnail = thumbnails[i + 1];
              const nextThumbTime = nextThumbnail ? nextThumbnail.time : fileDurationNonZero;
              const maxWidthPercent = ((nextThumbTime - thumbnail.time) / fileDurationNonZero) * 100 * 0.9;
              return (
                <img key={thumbnail.url} src={thumbnail.url} alt="" style={{ position: 'absolute', left: `${leftPercent}%`, height: '100%', boxSizing: 'border-box', maxWidth: `${maxWidthPercent}%`, objectFit: 'cover', border: '1px solid rgba(255, 255, 255, 0.5)', borderBottomRightRadius: 15, borderTopLeftRadius: 15, borderTopRightRadius: 15, pointerEvents: 'none' }} />
              );
            })}
          </div>
        )}

        <div
          style={{ height: timelineHeight, width: `${zoom * 100}%`, position: 'relative', backgroundColor: timelineBackground, transition: darkModeTransition }}
          ref={timelineWrapperRef}
        >
          {inverseCutSegments.map((seg) => (
            <BetweenSegments
              key={seg.segId}
              start={seg.start}
              end={seg.end}
              fileDurationNonZero={fileDurationNonZero}
              invertCutSegments={invertCutSegments}
            />
          ))}

          {cutSegments.map((seg, i) => {
            const selected = invertCutSegments || isSegmentSelected({ segId: seg.segId });

            return (
              <TimelineSeg
                key={seg.segId}
                seg={seg}
                segNum={i}
                onSegClick={setCurrentSegIndex}
                isActive={i === currentSegIndexSafe}
                fileDurationNonZero={fileDurationNonZero}
                invertCutSegments={invertCutSegments}
                formatTimecode={formatTimecode}
                selected={selected}
              />
            );
          })}

          {shouldShowKeyframes && !areKeyframesTooClose && keyFramesInZoomWindow.map((f) => (
            <div key={f.time} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(f.time / fileDurationNonZero) * 100}%`, marginLeft: -1, width: 1, background: 'var(--gray11)', pointerEvents: 'none' }} />
          ))}

          {currentTimePercent !== undefined && (
            <motion.div transition={{ type: 'spring', damping: 70, stiffness: 800 }} animate={{ left: currentTimePercent }} style={{ position: 'absolute', bottom: 0, top: 0, backgroundColor: 'var(--gray12)', width: currentTimeWidth, pointerEvents: 'none' }} />
          )}
          {commandedTimePercent !== undefined && (
            <CommandedTime commandedTimePercent={commandedTimePercent} />
          )}
        </div>
      </div>

      <div style={timeWrapperStyle} className={styles['time-wrapper']}>
        <div className={styles['time']} ref={timeRef}>
          {formatTimeAndFrames(displayTime)}{isZoomed ? ` ${displayTimePercent}` : ''}
        </div>
      </div>
    </div>
  );
}

export default memo(Timeline);
