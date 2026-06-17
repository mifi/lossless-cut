import type { CSSProperties, ClipboardEvent, Dispatch, FormEvent, SetStateAction } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { MdRotate90DegreesCcw } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { IoIosCamera, IoMdKey, IoMdSpeedometer } from 'react-icons/io';
import { FaYinYang, FaTrashAlt, FaStepBackward, FaStepForward, FaCaretLeft, FaCaretRight, FaPause, FaPlay, FaImages, FaKey, FaExclamationTriangle } from 'react-icons/fa';
import { GiSoundWaves } from 'react-icons/gi';
// import useTraceUpdate from 'use-trace-update';
import invariant from 'tiny-invariant';

import { primaryTextColor, primaryColor, darkModeTransition, dangerColor } from './colors';
import SegmentCutpointButton from './components/SegmentCutpointButton';
import SetCutpointButton from './components/SetCutpointButton';
import ExportButton from './components/ExportButton';
import ToggleExportConfirm from './components/ToggleExportConfirm';
import CaptureFormatButton from './components/CaptureFormatButton';
import Select from './components/Select';

import SimpleModeButton from './components/SimpleModeButton';
import { withBlur, mirrorTransform } from './util';
import getSwal from './swal';
import { getSegColor as getSegColorRaw } from './util/colors';
import { useSegColors } from './contexts';
import { isExactDurationMatch } from './util/duration';
import useUserSettings from './hooks/useUserSettings';
import useActionTitle from './hooks/useActionTitle';
import { askForPlaybackRate, checkAppPath } from './dialogs';
import type { FormatTimecode, GetFrameCount, ParseTimecode, PlaybackMode, SegmentColorIndex, SegmentToExport, StateSegment } from './types';
import type { WaveformMode } from '../../common/types';
import type { Frame } from './ffmpeg';
import mainApi from './mainApi';


const zoomOptions = Array.from({ length: 13 }).fill(undefined).map((_unused, z) => 2 ** z);

const leftRightWidth = 100;

const timeWrapperStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  position: 'absolute',
  inset: 0,
  marginLeft: '1.5em',
  pointerEvents: 'none',
};

// eslint-disable-next-line react/display-name
const InvertCutModeButton = memo(({ invertCutSegments, setInvertCutSegments }: { invertCutSegments: boolean, setInvertCutSegments: Dispatch<SetStateAction<boolean>> }) => {
  const { t } = useTranslation();

  const onYinYangClick = useCallback(() => {
    setInvertCutSegments((v) => {
      const newVal = !v;
      getSwal().toast.fire({
        title: newVal
          ? t('When you export, selected segments on the timeline will be REMOVED - the surrounding areas will be KEPT')
          : t('When you export, selected segments on the timeline will be KEPT - the surrounding areas will be REMOVED.'),
      });
      return newVal;
    });
  }, [setInvertCutSegments, t]);

  return (
    <div>
      <motion.div
        animate={{ rotateX: invertCutSegments ? 0 : 180 }}
        transition={{ duration: 0.3 }}
      >
        <FaYinYang
          role="button"
          title={invertCutSegments ? t('Discard selected segments') : t('Keep selected segments')}
          style={{ display: 'block', fontSize: '1.5em', color: invertCutSegments ? dangerColor : undefined }}
          onClick={onYinYangClick}
        />
      </motion.div>
    </div>
  );
});


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

  const [cutTimeManual, setCutTimeManual] = useState<string>();
  const [error, setError] = useState<boolean>(false);

  // Clear manual overrides if upstream cut time has changed
  useEffect(() => {
    // todo
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCutTimeManual(undefined);
    setError(false);
  }, [setCutTimeManual, currentCutSeg?.start, currentCutSeg?.end]);

  const isCutTimeManualSet = useCallback(() => cutTimeManual !== undefined, [cutTimeManual]);

  const border = useMemo(() => {
    const segColor = getSegColor(currentCutSeg);
    return `.1em solid ${darkMode ? segColor.desaturate(0.4).lightness(50).string() : segColor.desaturate(0.2).lightness(60).string()}`;
  }, [currentCutSeg, darkMode, getSegColor]);

  const setTime = useCallback((timeWithOffset: number | undefined) => {
    // Note: If we get an error from setCutTime, remain in the editing state (cutTimeManual)
    // https://github.com/mifi/lossless-cut/issues/988

    if (timeWithOffset == null) { // clear time
      invariant(!isStart);
      setCutTime('end', undefined);
      setCutTimeManual(undefined);
      setError(false);
      return;
    }

    const timeWithoutOffset = Math.max(timeWithOffset - startTimeOffset, 0);
    setCutTime(isStart ? 'start' : 'end', timeWithoutOffset);
    seekAbs(timeWithoutOffset);
    setCutTimeManual(undefined);
    setError(false);
  }, [isStart, seekAbs, setCutTime, startTimeOffset]);

  const isEmptyEndTime = useCallback((v: string | undefined) => !isStart && v?.trim() === '', [isStart]);

  const handleSubmit = useCallback((e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      if (isEmptyEndTime(cutTimeManual)) {
        setTime(undefined); // clear time
        return;
      }

      // Don't proceed if not a valid time value
      const timeWithOffset = cutTimeManual != null ? parseTimecode(cutTimeManual) : undefined;
      if (timeWithOffset === undefined) return;

      setTime(timeWithOffset);
    } catch (err) {
      console.warn('Cannot submit cut time', err);
    }
  }, [cutTimeManual, isEmptyEndTime, parseTimecode, setTime]);

  const parseAndSetCutTime = useCallback((text: string) => {
    if (isEmptyEndTime(text)) {
      setTime(undefined); // clear time
      return;
    }

    // Don't proceed if not a valid time value
    const timeWithOffset = parseTimecode(text);
    if (timeWithOffset === undefined) return;

    setTime(timeWithOffset);
  }, [isEmptyEndTime, parseTimecode, setTime]);

  const handleCutTimeInput = useCallback((text: string) => {
    try {
      if (isExactDurationMatch(text) || isEmptyEndTime(text)) {
        parseAndSetCutTime(text);
        return;
      }
    } catch (err) {
      console.warn(err);
      setError(true);
    }

    // else or if error, just set manual value, to make sure it doesn't jump to end https://github.com/mifi/lossless-cut/issues/988#issuecomment-3475870072
    setCutTimeManual(text);
  }, [isEmptyEndTime, parseAndSetCutTime]);

  const handleInputBlur = useCallback(() => {
    setCutTimeManual(undefined);
    setError(false);
  }, []);

  const handleCutTimePaste = useCallback((e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();

    try {
      const clipboardData = e.clipboardData.getData('Text');
      setCutTimeManual(clipboardData);
      parseAndSetCutTime(clipboardData);
      setError(false);
    } catch (err) {
      console.warn(err);
      setError(true);
    }
  }, [parseAndSetCutTime]);

  const handleContextMenu = useCallback(async () => {
    const text = await mainApi.readClipboardText();
    if (text) {
      try {
        setCutTimeManual(text);
        parseAndSetCutTime(text);
        setError(false);
      } catch (err) {
        console.warn(err);
        setError(true);
      }
    }
  }, [parseAndSetCutTime]);

  const style = useMemo<CSSProperties>(() => ({
    border,
    borderRadius: 5,
    backgroundColor: 'var(--gray-5)',
    transition: darkModeTransition,
    fontSize: 13,
    textAlign: 'center',
    padding: '1px 3px',
    marginTop: 0,
    marginBottom: 0,
    marginLeft: isStart ? 0 : 5,
    marginRight: isStart ? 5 : 0,
    boxSizing: 'border-box',
    fontFamily: 'monospace',
    letterSpacing: '-.05em',
    width: 94,
    outline: 'none',
    color: error ? dangerColor : (isCutTimeManualSet() ? 'var(--gray-12)' : 'var(--gray-11)'),
  }), [border, error, isCutTimeManualSet, isStart]);

  function renderValue() {
    if (isCutTimeManualSet()) return cutTimeManual;
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
        onContextMenu={handleContextMenu}
        value={renderValue()}
      />
    </form>
  );
});

function BottomBar({
  zoom, setZoom, timelineToggleComfortZoom,
  isRotationSet, rotation, areWeCutting, increaseRotation, cleanupFilesDialog,
  captureSnapshot, onExportPress, segmentsToExport, hasVideo,
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
  areWeCutting: boolean,
  increaseRotation: () => void,
  cleanupFilesDialog: () => void,
  captureSnapshot: () => void,
  onExportPress: () => void,
  segmentsToExport: SegmentToExport[],
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

  const playStyle = useMemo<CSSProperties>(() => ({
    paddingLeft: playing ? 0 : '.1em',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '2.3em',
    height: '2.3em',
    borderRadius: '50%',
    boxSizing: 'border-box',
  }), [playing]);

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
      ...playStyle,
      fontSize: '.7em',
      backgroundOffset: 30,
      background: `linear-gradient(90deg, ${gradientColors})`,
      border: '1px solid var(--gray-10)',
    };
  }, [playStyle, selectedSegments]);

  const keyframeStyle = useMemo(() => ({
    color: currentFrame != null && currentFrame.keyframe ? primaryTextColor : undefined,
  }), [currentFrame]);

  const { invertCutSegments, setInvertCutSegments, simpleMode, toggleSimpleMode, exportConfirmEnabled } = useUserSettings();
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
    playbackRateRef.current?.animate([{ transform: 'scale(2)', color: 'var(--gray-12)', backgroundColor: playbackRate === 1 ? 'var(--cyan-10)' : (playbackRate < 1 ? 'var(--yellow-8)' : 'var(--orange-10)') }, {}], { duration: 200 });
  }, [playbackRate]);

  function renderJumpCutpointButton(direction: number) {
    const newIndex = currentSegIndexSafe + direction;
    const seg = cutSegments[newIndex];

    const backgroundColor = seg && getSegColor(seg).desaturate(0.6).lightness(darkMode ? 35 : 55).string();
    const opacity = seg ? undefined : 0.5;
    const text = seg ? `${newIndex + 1}` : '-';
    const segButtonStyle: CSSProperties = {
      backgroundColor, opacity, padding: '6px 0', borderRadius: 10, color: seg ? 'white' : undefined, fontSize: text.length === 1 ? 14 : (text.length === 2 ? 12 : 10), width: 20, boxSizing: 'border-box', letterSpacing: -1, lineHeight: '10px', fontWeight: 'bold', margin: '0 6px', whiteSpace: 'nowrap', textAlign: 'center',
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
  const PlayPauseMode = playing && (playbackMode === 'play-selected-segments' || playbackMode === 'loop-selected-segments') ? FaPause : FaPlay;

  const currentCutSegOrDefault = useMemo(() => currentCutSeg ?? { segColorIndex: 0 }, [currentCutSeg]);

  const displayTimeFrameCount = useMemo(() => getFrameCount(displayTime), [displayTime, getFrameCount]);

  return (
    <>
      <div className="no-user-select" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: isFileOpened ? 1 : 0.5 }}>
        <div style={{ display: 'flex', alignItems: 'center', flexBasis: leftRightWidth }}>
          {!simpleMode && (
            <>
              {hasAudio && (
                <GiSoundWaves
                  style={{ fontSize: '1.6em', padding: '0 .1em', color: waveformMode != null ? primaryTextColor : undefined }}
                  role="button"
                  title={actionTitle(t('Show waveform'), 'toggleWaveformMode')}
                  onClick={() => toggleWaveformMode()}
                />
              )}
              {hasVideo && (
                <>
                  <FaImages
                    style={{ fontSize: '1.1em', padding: '0 .2em', color: showThumbnails ? primaryTextColor : undefined }}
                    role="button"
                    title={actionTitle(t('Show thumbnails'), 'toggleShowThumbnails')}
                    onClick={toggleShowThumbnails}
                  />

                  <FaKey
                    style={{ fontSize: '1em', padding: '0 .2em', color: keyframesEnabled ? primaryTextColor : undefined }}
                    role="button"
                    title={actionTitle(t('Show keyframes'), 'toggleShowKeyframes')}
                    onClick={toggleShowKeyframes}
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
              title={actionTitle(t('Jump to start of video'), 'jumpTimelineStart')}
              role="button"
              onClick={jumpTimelineStart}
            />

            {renderJumpCutpointButton(-1)}

            <SegmentCutpointButton currentCutSeg={currentCutSeg} side="start" Icon={FaStepBackward} onClick={jumpCutStart} title={actionTitle(t('Jump to current segment\'s start time'), 'jumpCutStart')} style={{ marginRight: 5 }} />
          </>
        )}

        <SetCutpointButton currentCutSeg={currentCutSegOrDefault} side="start" onClick={setCutStart} title={actionTitle(t('Start current segment at current time'), 'setCutStart')} style={{ marginRight: 5 }} />

        {!simpleMode && <CutTimeInput disabled={!isFileOpened} darkMode={darkMode} currentCutSeg={currentCutSeg} startTimeOffset={startTimeOffset} seekAbs={seekAbs} cutTime={currentCutSeg?.start} setCutTime={setCutTime} isStart formatTimecode={formatTimecode} parseTimecode={parseTimecode} />}

        {keyframesEnabled && (
          <IoMdKey
            size={25}
            role="button"
            title={actionTitle(t('Seek previous keyframe'), 'seekBackwardsKeyframe')}
            style={{ flexShrink: 0, marginRight: 2, transform: mirrorTransform, ...keyframeStyle }}
            onClick={() => seekClosestKeyframe(-1)}
          />
        )}

        {!simpleMode && (
          <FaCaretLeft
            style={{ flexShrink: 0, marginLeft: -6, marginRight: -4 }}
            size={28}
            role="button"
            title={actionTitle(t('One frame back'), 'seekPreviousFrame')}
            onClick={() => shortStep(-1)}
          />
        )}

        <div title={actionTitle(t('Play/pause'), 'togglePlayResetSpeed')} role="button" onClick={() => togglePlay()} style={{ ...playStyle, margin: '.1em .1em 0 .2em', background: primaryColor }}>
          <PlayPause style={{ fontSize: '.9em' }} />
        </div>

        {!simpleMode && (
          <FaCaretRight
            style={{ flexShrink: 0, marginRight: -6, marginLeft: -4 }}
            size={28}
            role="button"
            title={actionTitle(t('One frame forward'), 'seekNextFrame')}
            onClick={() => shortStep(1)}
          />
        )}

        {keyframesEnabled && (
          <IoMdKey
            style={{ flexShrink: 0, marginLeft: 2, ...keyframeStyle }}
            size={25}
            role="button"
            title={actionTitle(t('Seek next keyframe'), 'seekForwardsKeyframe')}
            onClick={() => seekClosestKeyframe(1)}
          />
        )}

        {!simpleMode && <CutTimeInput disabled={!isFileOpened} darkMode={darkMode} currentCutSeg={currentCutSeg} startTimeOffset={startTimeOffset} seekAbs={seekAbs} cutTime={currentCutSeg?.end} setCutTime={setCutTime} formatTimecode={formatTimecode} parseTimecode={parseTimecode} />}

        <SetCutpointButton currentCutSeg={currentCutSeg} side="end" onClick={setCutEnd} title={actionTitle(t('End current segment at current time'), 'setCutEnd')} style={{ marginLeft: 5 }} />

        {!simpleMode && (
          <>
            <SegmentCutpointButton currentCutSeg={currentCutSeg} side="end" Icon={FaStepForward} onClick={jumpCutEnd} title={actionTitle(t('Jump to current segment\'s end time'), 'jumpCutEnd')} style={{ marginLeft: 5 }} />

            {renderJumpCutpointButton(1)}

            <FaStepForward
              size={16}
              style={{ flexShrink: 0 }}
              title={actionTitle(t('Jump to end of video'), 'jumpTimelineEnd')}
              role="button"
              onClick={jumpTimelineEnd}
            />
          </>
        )}

        <div style={{ flexGrow: 1 }} />

        <div style={{ flexBasis: leftRightWidth }} />
      </div>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.1em .3em', gap: '.5em', height: '2em' }}>
        <InvertCutModeButton invertCutSegments={invertCutSegments} setInvertCutSegments={setInvertCutSegments} />

        <div style={{ display: 'flex', alignItems: 'center' }}>
          <SimpleModeButton />

          {simpleMode && (
            <div role="button" onClick={toggleSimpleMode} style={{ fontSize: '.8em', marginLeft: '.2em' }}>{t('Toggle advanced view')}</div>
          )}
        </div>

        {isFileOpened && !simpleMode && (
          <>
            <div role="button" title={t('Zoom')} onClick={timelineToggleComfortZoom}>{Math.floor(zoom)}x</div>

            <Select style={{ width: '4.5em' }} value={zoomOptions.includes(zoom) ? zoom.toString() : ''} title={t('Zoom')} onChange={withBlur((e) => setZoom(() => parseInt(e.target.value, 10)))}>
              <option key="" value="" disabled>{t('Zoom')}</option>
              {zoomOptions.map((val) => (
                <option key={val} value={String(val)}>{t('Zoom')} {val}x</option>
              ))}
            </Select>

            <div ref={playbackRateRef} title={t('Playback rate')} style={{ color: 'var(--gray-11)', fontSize: '.7em', borderRadius: '.5em' }}>{playbackRate.toFixed(1)}</div>

            <div style={{ whiteSpace: 'nowrap' }}>
              <IoMdSpeedometer title={t('Change FPS')} style={{ fontSize: '1.3em', verticalAlign: 'middle' }} role="button" onClick={handleChangePlaybackRateClick} />

              {detectedFps != null && (
                <span title={t('Video FPS')} role="button" onClick={handleChangePlaybackRateClick} style={{ color: 'var(--gray-11)', fontSize: '.7em', marginLeft: '.3em' }}>{(detectedFps * outputPlaybackRate).toFixed(3)}</span>
              )}
            </div>
          </>
        )}

        {isFileOpened && !simpleMode && hasVideo && (
          <div onClick={increaseRotation} role="button" style={{ whiteSpace: 'nowrap' }}>
            <MdRotate90DegreesCcw
              style={{ fontSize: '1.3em', verticalAlign: 'middle', color: isRotationSet ? primaryTextColor : undefined }}
              title={actionTitle(`${t('Set output rotation. Current: ')} ${isRotationSet ? rotationStr : t('Don\'t modify')}`, 'increaseRotation')}
            />
            <span style={{ textAlign: 'right', display: 'inline-block', fontSize: '.8em', marginLeft: '.1em' }}>{isRotationSet && rotationStr}</span>
          </div>
        )}

        <div style={{ flexGrow: 1 }} />

        <div style={timeWrapperStyle}>
          <div style={{ fontFamily: 'monospace', letterSpacing: '-0.08em', pointerEvents: 'auto' }}>
            {formatTimecode({ seconds: displayTime })}
            <span style={{ display: 'inline-block', minWidth: '3.5em', marginLeft: '.5em' }}>
              {displayTimeFrameCount ?? 0}<span style={{ opacity: 0.5, userSelect: 'none' }}>f</span>
              {isZoomed && <span style={{ marginLeft: '.5em' }}>{Math.round((displayTime / fileDurationNonZero) * 100)}<span style={{ opacity: 0.5, userSelect: 'none' }}>%</span></span>}
            </span>
          </div>
        </div>

        {!simpleMode && isFileOpened && (
          <FaTrashAlt
            title={actionTitle(t('Close file and clean up'), 'cleanupFilesDialog')}
            style={{ fontSize: '1em', color: dangerColor }}
            onClick={cleanupFilesDialog}
            role="button"
          />
        )}

        {hasVideo && (
          <div style={{ whiteSpace: 'nowrap' }}>
            <IoIosCamera
              role="button"
              style={{ fontSize: '1.9em', verticalAlign: 'middle' }}
              title={actionTitle(t('Capture frame'), 'captureSnapshot')}
              onClick={captureSnapshot}
            />

            {!simpleMode && <CaptureFormatButton style={{ width: '3.7em', textAlign: 'center', marginLeft: '.1em' }} />}
          </div>
        )}

        {isFileOpened && (
          <div role="button" onClick={toggleLoopSelectedSegments} title={actionTitle(t('Play selected segments in order'), 'toggleLoopSelectedSegments')} style={loopSelectedSegmentsButtonStyle}>
            <PlayPauseMode />
          </div>
        )}

        {!exportConfirmEnabled && (<FaExclamationTriangle style={{ color: dangerColor, marginLeft: '.4em' }} title={t('Export options screen is disabled, and you will not see any important notices or warnings.')} />)}
        {(!simpleMode || !exportConfirmEnabled) && <ToggleExportConfirm style={{ marginLeft: exportConfirmEnabled ? '.4em' : undefined }} />}

        {isFileOpened && (
          <ExportButton segmentsToExport={segmentsToExport} areWeCutting={areWeCutting} onClick={withBlur(onExportPress)} />
        )}
      </div>
    </>
  );
}

export default memo(BottomBar);
