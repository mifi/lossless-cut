import type { CSSProperties, ClipboardEvent, Dispatch, FormEvent, KeyboardEvent, SetStateAction } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { FaExclamationTriangle } from 'react-icons/fa';
import { LuArrowLeftToLine, LuArrowRightToLine, LuAudioWaveform, LuCamera, LuChevronFirst, LuChevronLast, LuChevronLeft, LuChevronRight, LuDiamond, LuGauge, LuImages, LuKeyRound, LuPause, LuPlay, LuRotateCcw, LuSkipBack, LuSkipForward, LuTrash2, LuZoomIn } from 'react-icons/lu';
// import useTraceUpdate from 'use-trace-update';
import invariant from 'tiny-invariant';

import { darkModeTransition, dangerColor } from './colors';
import ToggleExportConfirm from './components/ToggleExportConfirm';
import CaptureFormatButton from './components/CaptureFormatButton';
import Select from './components/Select';

import SimpleModeButton from './components/SimpleModeButton';
import { withBlur } from './util';
import { errorToast } from './swal';
import { UserFacingError } from '../errors';
import { getSegColor as getSegColorRaw } from './util/colors';
import { useSegColors } from './contexts';
import { isExactTimecodeMatch } from './util/duration';
import useUserSettings from './hooks/useUserSettings';
import useActionTitle from './hooks/useActionTitle';
import { askForPlaybackRate, checkAppPath } from './dialogs';
import type { FormatTimecode, GetFrameCount, ParseTimecode, PlaybackMode, SegmentColorIndex, StateSegment } from './types';
import type { WaveformMode } from '../../common/types';
import type { Frame } from './ffmpeg';
import mainApi from './mainApi';
import styles from './BottomBar.module.css';


const zoomOptions = Array.from({ length: 13 }).fill(undefined).map((_unused, z) => 2 ** z);

// eslint-disable-next-line react/display-name
const CutTimeInput = memo(({ disabled, darkMode, cutTime, setCutTime, startTimeOffset, seekAbs, currentCutSeg, isStart, formatTimecode, parseTimecode }: {
  disabled: boolean,
  darkMode: boolean,
  cutTime: number | undefined,
  setCutTime: (type: 'start' | 'end', v: number | undefined) => void,
  startTimeOffset: number,
  seekAbs: (a: number) => void,
  currentCutSeg: StateSegment | undefined,
  isStart?: boolean,
  formatTimecode: FormatTimecode,
  parseTimecode: ParseTimecode,
}) => {
  const { t } = useTranslation();
  const { getSegColor } = useSegColors();
  const { timecodeFormat } = useUserSettings();

  const [cutTimeManual, setCutTimeManual] = useState<string>();
  const [error, setError] = useState<boolean>(false);
  const skipCommitOnBlurRef = useRef(false);

  // Clear manual overrides if upstream cut time has changed
  useEffect(() => {
    // todo
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCutTimeManual(undefined);
    setError(false);
  }, [currentCutSeg?.segId, currentCutSeg?.start, currentCutSeg?.end]);

  const isCutTimeManualSet = cutTimeManual !== undefined;

  const border = useMemo(() => {
    const segColor = getSegColor(currentCutSeg);
    return `3px solid ${darkMode ? segColor.desaturate(0.2).lightness(60).string() : segColor.desaturate(0.2).lightness(50).string()}`;
  }, [currentCutSeg, darkMode, getSegColor]);

  const setTime = useCallback((timeWithOffset: number | undefined, seek: boolean) => {
    // Note: If we get an error from setCutTime, remain in the editing state (cutTimeManual)
    // https://github.com/mifi/lossless-cut/issues/988

    if (timeWithOffset == null) { // clear time
      invariant(!isStart);
      setCutTime('end', undefined);
    } else {
      const timeWithoutOffset = Math.max(timeWithOffset - startTimeOffset, 0);
      setCutTime(isStart ? 'start' : 'end', timeWithoutOffset);
      if (seek) seekAbs(timeWithoutOffset);
    }
    setCutTimeManual(undefined);
    setError(false);
  }, [isStart, seekAbs, setCutTime, startTimeOffset]);

  const isEmptyEndTime = useCallback((v: string | undefined) => !isStart && v?.trim() === '', [isStart]);

  const parseAndSetCutTime = useCallback((text: string, seek = true) => {
    if (isEmptyEndTime(text)) {
      setTime(undefined, seek); // clear time
      return true;
    }

    // Don't proceed if not a valid time value
    const timeWithOffset = parseTimecode(text);
    if (timeWithOffset === undefined || !Number.isFinite(timeWithOffset)) return false;

    setTime(timeWithOffset, seek);
    return true;
  }, [isEmptyEndTime, parseTimecode, setTime]);

  const handleSubmit = useCallback((e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      if (cutTimeManual != null && !parseAndSetCutTime(cutTimeManual)) return;

      // release focus, so that keyboard shortcuts work again https://github.com/mifi/lossless-cut/issues/2942
      skipCommitOnBlurRef.current = true; // already committed
      e.currentTarget.querySelector('input')?.blur();
    } catch (err) {
      console.warn('Cannot submit cut time', err);
      setError(true);
    }
  }, [cutTimeManual, parseAndSetCutTime]);

  const handleCutTimeInput = useCallback((text: string) => {
    try {
      // In frame count mode, every prefix of a number is also a valid frame number (typing 123 would commit 1, 12, 123), so wait for enter/blur
      if ((timecodeFormat !== 'frameCount' && isExactTimecodeMatch(text, parseTimecode, formatTimecode)) || isEmptyEndTime(text)) {
        parseAndSetCutTime(text);
        return;
      }
    } catch (err) {
      console.warn(err);
      setError(true);
    }

    // else or if error, just set manual value, to make sure it doesn't jump to end https://github.com/mifi/lossless-cut/issues/988#issuecomment-3475870072
    setCutTimeManual(text);
  }, [formatTimecode, isEmptyEndTime, parseAndSetCutTime, parseTimecode, timecodeFormat]);

  const handleInputKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    // escape cancels the edit instead of committing it on blur
    if (e.key === 'Escape' && !e.nativeEvent.isComposing) {
      skipCommitOnBlurRef.current = true;
      e.currentTarget.blur();
    }
  }, []);

  const handleInputBlur = useCallback(() => {
    const skipCommit = skipCommitOnBlurRef.current;
    skipCommitOnBlurRef.current = false;
    if (!skipCommit) {
      // keep the text if the whole window lost focus (e.g. switching app to copy a timecode). Focus will be restored to the input
      if (!document.hasFocus()) return;

      // commit input when focus is lost (e.g. clicking elsewhere), so that it's not silently lost. Don't seek, because that would override where the user clicked
      if (cutTimeManual != null) {
        try {
          if (!parseAndSetCutTime(cutTimeManual, false)) {
            setError(true); // keep the text, so the user can see and fix it
            return;
          }
        } catch (err) {
          console.warn('Cannot set cut time on blur', err);
          if (err instanceof UserFacingError) errorToast(err.message);
          setError(true);
          return;
        }
      }
    }
    setCutTimeManual(undefined);
    setError(false);
  }, [cutTimeManual, parseAndSetCutTime]);

  const pasteCutTime = useCallback((text: string) => {
    try {
      setCutTimeManual(text);
      parseAndSetCutTime(text);
      setError(false);
    } catch (err) {
      console.warn(err);
      setError(true);
    }
  }, [parseAndSetCutTime]);

  const handleCutTimePaste = useCallback((e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    pasteCutTime(e.clipboardData.getData('Text'));
  }, [pasteCutTime]);

  const handleContextMenu = useCallback(async () => {
    const text = await mainApi.readClipboardText();
    if (text) pasteCutTime(text);
  }, [pasteCutTime]);

  const style = useMemo<CSSProperties>(() => ({
    border: '1px solid var(--llc-control-border)',
    borderLeft: border,
    borderRadius: 'var(--llc-radius-control)',
    backgroundColor: 'var(--llc-track-bg)',
    transition: darkModeTransition,
    fontSize: 12,
    textAlign: 'center',
    height: '2em',
    padding: '0 6px',
    margin: 0,
    boxSizing: 'border-box',
    fontFamily: 'var(--llc-font-mono)',
    fontVariantNumeric: 'tabular-nums',
    width: 104,
    outline: 'none',
    color: error ? dangerColor : (isCutTimeManualSet ? 'var(--llc-text-1)' : 'var(--llc-text-2)'),
  }), [border, error, isCutTimeManualSet]);

  function renderValue() {
    if (isCutTimeManualSet) return cutTimeManual;
    if (cutTime == null) return formatTimecode({ seconds: 0 }); // marker, see https://github.com/mifi/lossless-cut/issues/2590
    return formatTimecode({ seconds: cutTime + startTimeOffset });
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        disabled={disabled}
        style={style}
        type="text"
        title={isStart ? t('Manually input current segment\'s start time') : t('Manually input current segment\'s end time')}
        onChange={(e) => handleCutTimeInput(e.target.value)}
        onPaste={handleCutTimePaste}
        onBlur={handleInputBlur}
        onKeyDown={handleInputKeyDown}
        onContextMenu={handleContextMenu}
        value={renderValue()}
      />
    </form>
  );
});

function BottomBar({
  zoom, setZoom, timelineToggleComfortZoom,
  isRotationSet, rotation, increaseRotation, cleanupFilesDialog,
  captureSnapshot, hasVideo, dockContainer,
  seekAbs, currentSegIndexSafe, cutSegments, currentCutSeg, setCutStart, setCutEnd,
  setCurrentSegIndex,
  jumpTimelineStart, jumpTimelineEnd, jumpCutEnd, jumpCutStart, startTimeOffset, setCutTime,
  playing, shortStep, togglePlay, toggleLoopSelectedSegments, hasAudio,
  keyframesEnabled, toggleShowKeyframes, seekClosestKeyframe, detectedFps, isFileOpened, selectedSegments,
  darkMode,
  toggleShowThumbnails, toggleWaveformMode, waveformMode, showThumbnails,
  outputPlaybackRate, setOutputPlaybackRate,
  formatTimecode, parseTimecode, playbackRate,
  currentFrame, playbackMode, displayTime, fileDurationNonZero, getFrameCount,
}: {
  zoom: number,
  setZoom: (fn: (z: number) => number) => void,
  timelineToggleComfortZoom: () => void,
  isRotationSet: boolean,
  rotation: number,
  increaseRotation: () => void,
  cleanupFilesDialog: () => void,
  captureSnapshot: () => void,
  dockContainer: HTMLElement | null,
  hasVideo: boolean,
  seekAbs: (a: number) => void,
  currentSegIndexSafe: number,
  cutSegments: StateSegment[],
  currentCutSeg: StateSegment | undefined,
  setCutStart: () => void,
  setCutEnd: () => void,
  setCurrentSegIndex: Dispatch<SetStateAction<number>>,
  jumpTimelineStart: () => void,
  jumpTimelineEnd: () => void,
  jumpCutEnd: () => void,
  jumpCutStart: () => void,
  startTimeOffset: number,
  setCutTime: (type: 'start' | 'end', v: number | undefined) => void,
  playing: boolean,
  shortStep: (a: number) => void,
  togglePlay: () => void,
  toggleLoopSelectedSegments: () => void,
  hasAudio: boolean,
  keyframesEnabled: boolean,
  toggleShowKeyframes: () => void,
  seekClosestKeyframe: (a: number) => void,
  detectedFps: number | undefined,
  isFileOpened: boolean,
  selectedSegments: SegmentColorIndex[],
  darkMode: boolean,
  toggleShowThumbnails: () => void,
  toggleWaveformMode: () => void,
  waveformMode: WaveformMode | undefined,
  showThumbnails: boolean,
  outputPlaybackRate: number,
  setOutputPlaybackRate: (v: number) => void,
  formatTimecode: FormatTimecode,
  parseTimecode: ParseTimecode,
  playbackRate: number,
  currentFrame: Frame | undefined,
  playbackMode: PlaybackMode | undefined,
  displayTime: number,
  fileDurationNonZero: number,
  getFrameCount: GetFrameCount,
}) {
  const { t } = useTranslation();
  const { getSegColor } = useSegColors();

  const isZoomed = zoom > 1;

  // ok this is a bit over-engineered but what the hell!
  const loopSelectedSegmentsButtonStyle = useMemo<CSSProperties>(() => {
    // need at least 2 gradient elements:
    const selectedSegmentsSafe = (
      selectedSegments.length >= 2
        ? selectedSegments
        : [
          selectedSegments[0] ?? { segColorIndex: 0 },
          selectedSegments[1] ?? { segColorIndex: 1 },
        ]
    ).slice(0, 10);

    const gradientColors = selectedSegmentsSafe.map((seg, i) => {
      const segColor = getSegColorRaw(seg);
      // make colors stronger, the more segments
      return `${segColor.alpha(Math.max(0.4, Math.min(0.8, selectedSegmentsSafe.length / 3))).string()} ${((i / (selectedSegmentsSafe.length - 1)) * 100).toFixed(1)}%`;
    }).join(', ');

    return {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '1.55em',
      height: '1.55em',
      borderRadius: '50%',
      color: 'white',
      background: `linear-gradient(90deg, ${gradientColors})`,
      boxShadow: '0 0 0 1px rgba(255, 255, 255, .35)',
    };
  }, [selectedSegments]);

  const keyframeStyle = useMemo(() => ({
    color: currentFrame != null && currentFrame.keyframe ? '#c4b5fd' : undefined, // the dock is always dark
  }), [currentFrame]);

  const { simpleMode, toggleSimpleMode, exportConfirmEnabled } = useUserSettings();
  const actionTitle = useActionTitle();

  const rotationStr = `${rotation}°`;

  useEffect(() => {
    checkAppPath();
  }, []);

  const handleChangePlaybackRateClick = useCallback(async () => {
    const newRate = await askForPlaybackRate({ detectedFps, outputPlaybackRate });
    if (newRate != null) setOutputPlaybackRate(newRate);
  }, [detectedFps, outputPlaybackRate, setOutputPlaybackRate]);

  const playbackRateRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    playbackRateRef.current?.animate([{ transform: 'scale(2)', color: 'var(--gray-12)', backgroundColor: playbackRate === 1 ? 'var(--violet-10)' : (playbackRate < 1 ? 'var(--yellow-8)' : 'var(--orange-10)') }, {}], { duration: 200 });
  }, [playbackRate]);

  function renderJumpCutpointButton(direction: number) {
    const newIndex = currentSegIndexSafe + direction;
    const seg = cutSegments[newIndex];

    const backgroundColor = seg ? getSegColor(seg).desaturate(0.3).lightness(45).alpha(0.85).string() : 'rgba(255, 255, 255, .1)';
    const text = seg ? `${newIndex + 1}` : '–';

    return (
      <button
        type="button"
        className={styles['segJump']}
        style={{ backgroundColor, opacity: seg ? undefined : 0.5, margin: '0 .25em' }}
        title={`${direction > 0 ? t('Select next segment') : t('Select previous segment')} (${newIndex + 1})`}
        onClick={() => seg && setCurrentSegIndex(newIndex)}
      >
        {text}
      </button>
    );
  }

  const PlayPause = playing ? LuPause : LuPlay;
  const PlayPauseMode = playing && (playbackMode === 'play-selected-segments' || playbackMode === 'loop-selected-segments') ? LuPause : LuPlay;

  const cutChipColor = useMemo(() => getSegColor(currentCutSeg ?? { segColorIndex: 0 }).desaturate(0.2).lightness(darkMode ? 60 : 50).string(), [currentCutSeg, darkMode, getSegColor]);

  const displayTimeFrameCount = useMemo(() => getFrameCount(displayTime), [displayTime, getFrameCount]);

  const toolbarOpacity = isFileOpened ? 1 : 0.5;

  const dock = (
    <div className={styles['dockWrapper']}>
      <div className={`no-user-select llc-video-overlay ${styles['dock']}`}>
        {!simpleMode && (
          <>
            <button type="button" className="llc-icon-button" title={actionTitle(t('Jump to start of video'), 'jumpTimelineStart')} onClick={jumpTimelineStart}>
              <LuChevronFirst size={18} />
            </button>

            {renderJumpCutpointButton(-1)}

            <button type="button" className="llc-icon-button" title={actionTitle(t('Jump to current segment\'s start time'), 'jumpCutStart')} onClick={jumpCutStart}>
              <LuSkipBack size={16} />
            </button>
          </>
        )}

        {keyframesEnabled && (
          <button type="button" className="llc-icon-button" style={keyframeStyle} title={actionTitle(t('Seek previous keyframe'), 'seekBackwardsKeyframe')} onClick={() => seekClosestKeyframe(-1)}>
            <LuDiamond size={11} /><LuChevronLeft size={14} style={{ marginLeft: '-.4em' }} />
          </button>
        )}

        {!simpleMode && (
          <button type="button" className="llc-icon-button" title={actionTitle(t('One frame back'), 'seekPreviousFrame')} onClick={() => shortStep(-1)}>
            <LuChevronLeft size={20} />
          </button>
        )}

        <button type="button" className={styles['play']} title={actionTitle(t('Play/pause'), 'togglePlayResetSpeed')} onClick={() => togglePlay()}>
          <PlayPause size={18} fill="currentColor" style={{ marginLeft: playing ? 0 : '.12em' }} />
        </button>

        {!simpleMode && (
          <button type="button" className="llc-icon-button" title={actionTitle(t('One frame forward'), 'seekNextFrame')} onClick={() => shortStep(1)}>
            <LuChevronRight size={20} />
          </button>
        )}

        {keyframesEnabled && (
          <button type="button" className="llc-icon-button" style={keyframeStyle} title={actionTitle(t('Seek next keyframe'), 'seekForwardsKeyframe')} onClick={() => seekClosestKeyframe(1)}>
            <LuChevronRight size={14} style={{ marginRight: '-.4em' }} /><LuDiamond size={11} />
          </button>
        )}

        {!simpleMode && (
          <>
            <button type="button" className="llc-icon-button" title={actionTitle(t('Jump to current segment\'s end time'), 'jumpCutEnd')} onClick={jumpCutEnd}>
              <LuSkipForward size={16} />
            </button>

            {renderJumpCutpointButton(1)}

            <button type="button" className="llc-icon-button" title={actionTitle(t('Jump to end of video'), 'jumpTimelineEnd')} onClick={jumpTimelineEnd}>
              <LuChevronLast size={18} />
            </button>
          </>
        )}

        <div className="llc-divider" />

        <button type="button" className="llc-icon-button" onClick={toggleLoopSelectedSegments} title={actionTitle(t('Play selected segments in order'), 'toggleLoopSelectedSegments')}>
          <span style={loopSelectedSegmentsButtonStyle}>
            <PlayPauseMode size={10} fill="currentColor" />
          </span>
        </button>

        {hasVideo && (
          <button type="button" className="llc-icon-button" title={actionTitle(t('Capture frame'), 'captureSnapshot')} onClick={captureSnapshot}>
            <LuCamera size={17} />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {dockContainer != null && isFileOpened && createPortal(dock, dockContainer)}

      <div className={`no-user-select ${styles['toolbar']}`}>
        <div className={styles['left']} style={{ opacity: toolbarOpacity }}>
          <button type="button" className={styles['cutChip']} title={actionTitle(t('Start current segment at current time'), 'setCutStart')} onClick={setCutStart}>
            <span className={styles['cutChipDot']} style={{ background: cutChipColor }} />
            <LuArrowRightToLine size={14} />
            {t('Start')}
          </button>

          {!simpleMode && <CutTimeInput disabled={!isFileOpened} darkMode={darkMode} currentCutSeg={currentCutSeg} startTimeOffset={startTimeOffset} seekAbs={seekAbs} cutTime={currentCutSeg?.start} setCutTime={setCutTime} isStart formatTimecode={formatTimecode} parseTimecode={parseTimecode} />}

          {!simpleMode && <span className={styles['rangeArrow']}>→</span>}

          {!simpleMode && <CutTimeInput disabled={!isFileOpened} darkMode={darkMode} currentCutSeg={currentCutSeg} startTimeOffset={startTimeOffset} seekAbs={seekAbs} cutTime={currentCutSeg?.end} setCutTime={setCutTime} formatTimecode={formatTimecode} parseTimecode={parseTimecode} />}

          <button type="button" className={styles['cutChip']} title={actionTitle(t('End current segment at current time'), 'setCutEnd')} onClick={setCutEnd}>
            {t('End')}
            <LuArrowLeftToLine size={14} />
            <span className={styles['cutChipDot']} style={{ background: cutChipColor }} />
          </button>
        </div>

        <div className={`llc-mono ${styles['time']}`}>
          {formatTimecode({ seconds: displayTime })}
          <span className={styles['timeSecondary']}>
            {displayTimeFrameCount ?? 0}f
            {isZoomed && ` · ${Math.round((displayTime / fileDurationNonZero) * 100)}%`}
          </span>
        </div>

        <div className={styles['right']}>
          {!simpleMode && isFileOpened && (
            <>
              {hasAudio && (
                <button type="button" className="llc-icon-button" aria-pressed={waveformMode != null} title={actionTitle(t('Show waveform'), 'toggleWaveformMode')} onClick={() => toggleWaveformMode()}>
                  <LuAudioWaveform size={17} />
                </button>
              )}
              {hasVideo && (
                <>
                  <button type="button" className="llc-icon-button" aria-pressed={showThumbnails} title={actionTitle(t('Show thumbnails'), 'toggleShowThumbnails')} onClick={toggleShowThumbnails}>
                    <LuImages size={16} />
                  </button>

                  <button type="button" className="llc-icon-button" aria-pressed={keyframesEnabled} title={actionTitle(t('Show keyframes'), 'toggleShowKeyframes')} onClick={toggleShowKeyframes}>
                    <LuKeyRound size={16} />
                  </button>
                </>
              )}

              <div className="llc-divider" />

              <button type="button" className="llc-icon-button llc-mono" title={t('Zoom')} onClick={timelineToggleComfortZoom}>
                <LuZoomIn size={16} />
                <span className={styles['small']}>{Math.floor(zoom)}x</span>
              </button>

              <Select style={{ width: '5.5em' }} value={zoomOptions.includes(zoom) ? zoom.toString() : ''} title={t('Zoom')} onChange={withBlur((e) => setZoom(() => parseInt(e.target.value, 10)))}>
                <option key="" value="" disabled>{t('Zoom')}</option>
                {zoomOptions.map((val) => (
                  <option key={val} value={String(val)}>{t('Zoom')} {val}x</option>
                ))}
              </Select>

              <button type="button" className="llc-icon-button llc-mono" title={t('Change FPS')} onClick={handleChangePlaybackRateClick}>
                <LuGauge size={16} />
                <span ref={playbackRateRef} title={t('Playback rate')} className={styles['small']} style={{ borderRadius: '.5em' }}>{playbackRate.toFixed(1)}×</span>
                {detectedFps != null && (
                  <span title={t('Video FPS')} className={styles['small']}>{(detectedFps * outputPlaybackRate).toFixed(3)}</span>
                )}
              </button>

              {hasVideo && (
                <button type="button" className="llc-icon-button" aria-pressed={isRotationSet} title={actionTitle(`${t('Set output rotation. Current: ')} ${isRotationSet ? rotationStr : t('Don\'t modify')}`, 'increaseRotation')} onClick={increaseRotation}>
                  <LuRotateCcw size={16} />
                  {isRotationSet && <span className={styles['small']}>{rotationStr}</span>}
                </button>
              )}

              <div className="llc-divider" />
            </>
          )}

          {hasVideo && !simpleMode && <CaptureFormatButton />}

          {!simpleMode && isFileOpened && (
            <button type="button" className="llc-icon-button" style={{ color: dangerColor }} title={actionTitle(t('Close file and clean up'), 'cleanupFilesDialog')} onClick={cleanupFilesDialog}>
              <LuTrash2 size={16} />
            </button>
          )}

          {!exportConfirmEnabled && (<FaExclamationTriangle style={{ color: dangerColor, margin: '0 .3em' }} title={t('Export options screen is disabled, and you will not see any important notices or warnings.')} />)}
          {(!simpleMode || !exportConfirmEnabled) && <ToggleExportConfirm size={19} style={{ margin: '0 .3em' }} />}

          <SimpleModeButton style={{ margin: '0 .3em' }} />

          {simpleMode && (
            <div role="button" onClick={toggleSimpleMode} className={styles['small']}>{t('Toggle advanced view')}</div>
          )}
        </div>
      </div>
    </>
  );
}

export default memo(BottomBar);
