import type { CSSProperties, ClipboardEvent, Dispatch, FormEvent, SetStateAction } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { MdEventNote } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { IoIosCamera, IoMdKey, IoMdSpeedometer } from 'react-icons/io';
import { FaBaby, FaYinYang, FaTrashAlt, FaStepBackward, FaStepForward, FaCaretLeft, FaCaretRight, FaPause, FaPlay, FaImages, FaKey, FaExclamationTriangle } from 'react-icons/fa';
import { GiSoundWaves } from 'react-icons/gi';
// import useTraceUpdate from 'use-trace-update';
import invariant from 'tiny-invariant';

import { primaryTextColor } from './colors';
import SegmentCutpointButton from './components/SegmentCutpointButton';
import SetCutpointButton from './components/SetCutpointButton';
import ExportButton from './components/ExportButton';
import CaptureFormatButton from './components/CaptureFormatButton';
import Select from './components/Select';

import {
  PlayerChipInput,
  PlayerIconButton,
  PlayerPillButton,
  PlayerSegmentBadgeButton,
  PlayerSegmentBadgeText,
  PlayerStat,
  PlayerSurfaceGroup,
  PlayerTransportButton,
} from './components/PlayerChrome';
import { withBlur, mirrorTransform } from './util';
import getSwal from './swal';
import { getSegColor as getSegColorRaw } from './util/colors';
import { useSegColors } from './contexts';
import { isExactDurationMatch } from './util/duration';
import useUserSettings from './hooks/useUserSettings';
import { askForPlaybackRate, checkAppPath } from './dialogs';
import type { FormatTimecode, ParseTimecode, PlaybackMode, SegmentColorIndex, SegmentToExport, StateSegment } from './types';
import type { WaveformMode } from '../../common/types';
import type { Frame } from './ffmpeg';
import styles from './BottomBar.module.css';

const { clipboard } = window.require('electron');


const zoomOptions = Array.from({ length: 13 }).fill(undefined).map((_unused, z) => 2 ** z);

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
    <PlayerPillButton
      active={invertCutSegments}
      danger={invertCutSegments}
      title={invertCutSegments ? t('Discard selected segments') : t('Keep selected segments')}
      onClick={onYinYangClick}
      label={invertCutSegments ? t('Discard') : t('Keep')}
    >
      <motion.span
        animate={{ rotateX: invertCutSegments ? 0 : 180 }}
        transition={{ duration: 0.3 }}
      >
        <FaYinYang style={{ display: 'block', fontSize: '1.05rem' }} />
      </motion.span>
    </PlayerPillButton>
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

  const accentColor = useMemo(() => {
    const segColor = getSegColor(currentCutSeg);
    return darkMode ? segColor.desaturate(0.25).lightness(62).alpha(0.85).string() : segColor.desaturate(0.1).lightness(48).alpha(0.9).string();
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

  const handleContextMenu = useCallback(() => {
    const text = clipboard.readText();
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

  function renderValue() {
    if (isCutTimeManualSet()) return cutTimeManual;
    if (cutTime == null) return formatTimecode({ seconds: 0 }); // marker, see https://github.com/mifi/lossless-cut/issues/2590
    return formatTimecode({ seconds: cutTime + startTimeOffset });
  }

  return (
    <form onSubmit={handleSubmit}>
      <PlayerChipInput
        disabled={disabled}
        wrapperClassName={styles['cutInput']}
        type="text"
        invalid={error}
        manual={isCutTimeManualSet()}
        accentColor={accentColor}
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
  currentFrame, playbackMode,
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
}) {
  const { t } = useTranslation();
  const { getSegColor } = useSegColors();

  // Blend selected segment colors into the loop action so the control reflects the current selection.
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
      background: `linear-gradient(90deg, ${gradientColors})`,
      borderWidth: 0,
      color: 'white',
      boxShadow: 'var(--player-accent-shadow)',
    };
  }, [selectedSegments]);

  const keyframeActive = currentFrame != null && currentFrame.keyframe;

  const { invertCutSegments, setInvertCutSegments, simpleMode, toggleSimpleMode, exportConfirmEnabled, toggleExportConfirmEnabled } = useUserSettings();

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
    playbackRateRef.current?.animate([{ transform: 'scale(1.7)', color: 'var(--gray-12)' }, {}], { duration: 200 });
  }, [playbackRate]);

  function renderJumpCutpointButton(direction: number) {
    const newIndex = currentSegIndexSafe + direction;
    const seg = cutSegments[newIndex];
    const text = seg ? `${newIndex + 1}` : '-';
    const accentColor = seg ? getSegColor(seg).desaturate(0.35).lightness(darkMode ? 60 : 42).alpha(0.85).string() : undefined;

    return (
      <PlayerSegmentBadgeButton
        empty={seg == null}
        accentColor={accentColor}
        title={`${direction > 0 ? t('Select next segment') : t('Select previous segment')} (${newIndex + 1})`}
        onClick={() => seg && setCurrentSegIndex(newIndex)}
      >
        <PlayerSegmentBadgeText text={text} empty={seg == null} />
      </PlayerSegmentBadgeButton>
    );
  }

  const PlayPause = playing ? FaPause : FaPlay;
  const PlayPauseMode = playing && (playbackMode === 'play-selected-segments' || playbackMode === 'loop-selected-segments') ? FaPause : FaPlay;

  const currentCutSegOrDefault = useMemo(() => currentCutSeg ?? { segColorIndex: 0 }, [currentCutSeg]);

  return (
    <div className={[styles['root'], 'no-user-select'].join(' ')}>
      <div className={[styles['row'], styles['rowCenter']].join(' ')} style={{ opacity: isFileOpened ? 1 : 0.55 }}>
        <div className={styles['sideTools']}>
          {!simpleMode && (
            <PlayerSurfaceGroup compact className={styles['utilityGroup']}>
              {hasAudio && (
                <PlayerIconButton active={waveformMode != null} title={t('Show waveform')} onClick={() => toggleWaveformMode()}>
                  <GiSoundWaves className={styles['toolbarIcon']} />
                </PlayerIconButton>
              )}

              {hasVideo && (
                <>
                  <PlayerIconButton active={showThumbnails} title={t('Show thumbnails')} onClick={toggleShowThumbnails}>
                    <FaImages className={styles['toolbarIconSm']} />
                  </PlayerIconButton>

                  <PlayerIconButton active={keyframesEnabled} title={t('Show keyframes')} onClick={toggleShowKeyframes}>
                    <FaKey className={styles['toolbarIconSm']} />
                  </PlayerIconButton>
                </>
              )}
            </PlayerSurfaceGroup>
          )}
        </div>

        <div className={styles['centerCluster']}>
          {!simpleMode && (
            <PlayerSurfaceGroup compact className={styles['navGroup']}>
              <PlayerIconButton title={t('Jump to start of video')} onClick={jumpTimelineStart}>
                <FaStepBackward className={styles['toolbarIconSm']} />
              </PlayerIconButton>

              {renderJumpCutpointButton(-1)}

              <SegmentCutpointButton currentCutSeg={currentCutSeg} side="start" Icon={FaStepBackward} onClick={jumpCutStart} title={t('Jump to current segment\'s start time')} />
            </PlayerSurfaceGroup>
          )}

          <PlayerSurfaceGroup className={styles['transportGroup']}>
            <SetCutpointButton currentCutSeg={currentCutSegOrDefault} side="start" onClick={setCutStart} title={t('Start current segment at current time')} />

            {!simpleMode && <CutTimeInput disabled={!isFileOpened} darkMode={darkMode} currentCutSeg={currentCutSeg} startTimeOffset={startTimeOffset} seekAbs={seekAbs} cutTime={currentCutSeg?.start} setCutTime={setCutTime} isStart formatTimecode={formatTimecode} parseTimecode={parseTimecode} />}

            {keyframesEnabled && (
              <PlayerIconButton active={keyframeActive} title={t('Seek previous keyframe')} onClick={() => seekClosestKeyframe(-1)}>
                <IoMdKey className={styles['toolbarIcon']} style={{ transform: mirrorTransform, color: keyframeActive ? primaryTextColor : undefined }} />
              </PlayerIconButton>
            )}

            {!simpleMode && (
              <PlayerIconButton title={t('One frame back')} onClick={() => shortStep(-1)}>
                <FaCaretLeft className={styles['toolbarIcon']} />
              </PlayerIconButton>
            )}

            <PlayerTransportButton title={playing ? t('Pause') : t('Play')} onClick={() => togglePlay()}>
              <PlayPause className={styles['transportIcon']} />
            </PlayerTransportButton>

            {!simpleMode && (
              <PlayerIconButton title={t('One frame forward')} onClick={() => shortStep(1)}>
                <FaCaretRight className={styles['toolbarIcon']} />
              </PlayerIconButton>
            )}

            {keyframesEnabled && (
              <PlayerIconButton active={keyframeActive} title={t('Seek next keyframe')} onClick={() => seekClosestKeyframe(1)}>
                <IoMdKey className={styles['toolbarIcon']} style={{ color: keyframeActive ? primaryTextColor : undefined }} />
              </PlayerIconButton>
            )}

            {!simpleMode && <CutTimeInput disabled={!isFileOpened} darkMode={darkMode} currentCutSeg={currentCutSeg} startTimeOffset={startTimeOffset} seekAbs={seekAbs} cutTime={currentCutSeg?.end} setCutTime={setCutTime} formatTimecode={formatTimecode} parseTimecode={parseTimecode} />}

            <SetCutpointButton currentCutSeg={currentCutSeg} side="end" onClick={setCutEnd} title={t('End current segment at current time')} />
          </PlayerSurfaceGroup>

          {!simpleMode && (
            <PlayerSurfaceGroup compact className={styles['navGroup']}>
              <SegmentCutpointButton currentCutSeg={currentCutSeg} side="end" Icon={FaStepForward} onClick={jumpCutEnd} title={t('Jump to current segment\'s end time')} />

              {renderJumpCutpointButton(1)}

              <PlayerIconButton title={t('Jump to end of video')} onClick={jumpTimelineEnd}>
                <FaStepForward className={styles['toolbarIconSm']} />
              </PlayerIconButton>
            </PlayerSurfaceGroup>
          )}
        </div>

        <div className={styles['sideTools']} />
      </div>

      <div className={styles['row']}>
        <PlayerSurfaceGroup compact className={styles['metaGroup']}>
          <InvertCutModeButton invertCutSegments={invertCutSegments} setInvertCutSegments={setInvertCutSegments} />

          <PlayerPillButton active={!simpleMode} title={t('Toggle advanced view')} onClick={toggleSimpleMode}>
            <FaBaby className={styles['toolbarIconSm']} />
          </PlayerPillButton>
        </PlayerSurfaceGroup>

        {isFileOpened && !simpleMode && (
          <PlayerSurfaceGroup compact className={styles['metaGroup']}>
            <PlayerStat className={styles['statButton']} role="button" title={t('Zoom')} onClick={timelineToggleComfortZoom} label={t('Zoom')} value={`${Math.floor(zoom)}x`} />

            <Select className={styles['zoomSelect']} value={zoomOptions.includes(zoom) ? zoom.toString() : ''} title={t('Zoom')} onChange={withBlur((e) => setZoom(() => parseInt(e.target.value, 10)))}>
              <option key="" value="" disabled>{t('Zoom')}</option>
              {zoomOptions.map((val) => (
                <option key={val} value={String(val)}>{t('Zoom')} {val}x</option>
              ))}
            </Select>

            <div ref={playbackRateRef}>
              <PlayerStat title={t('Playback rate')} label={t('Playback rate')} value={playbackRate.toFixed(1)} />
            </div>

            <PlayerIconButton title={t('Change FPS')} onClick={handleChangePlaybackRateClick}>
              <IoMdSpeedometer className={styles['toolbarIcon']} />
            </PlayerIconButton>

            {detectedFps != null && (
              <PlayerStat className={styles['statButton']} role="button" title={t('Video FPS')} onClick={handleChangePlaybackRateClick} label={t('FPS')} value={(detectedFps * outputPlaybackRate).toFixed(3)} />
            )}

            {hasVideo && (
              <PlayerStat className={styles['statButton']} role="button" title={`${t('Set output rotation. Current: ')} ${isRotationSet ? rotationStr : t('Don\'t modify')}`} onClick={increaseRotation} label={t('Rotation')} value={isRotationSet ? rotationStr : '0°'} />
            )}
          </PlayerSurfaceGroup>
        )}

        <div className={styles['stretch']} />

        <PlayerSurfaceGroup compact className={styles['actionGroup']}>
          {!simpleMode && isFileOpened && (
            <PlayerIconButton danger title={t('Close file and clean up')} onClick={cleanupFilesDialog}>
              <FaTrashAlt className={styles['toolbarIconSm']} />
            </PlayerIconButton>
          )}

          {hasVideo && (
            <div className={styles['cameraGroup']}>
              <PlayerIconButton large className={styles['heroActionButton']} title={t('Capture frame')} onClick={captureSnapshot}>
                <IoIosCamera className={styles['toolbarIcon']} />
              </PlayerIconButton>

              {!simpleMode && <CaptureFormatButton className={styles['captureFormatButton']} style={{ minHeight: '2.875rem', height: '2.875rem', paddingLeft: '0.95rem', paddingRight: '0.95rem', borderRadius: '1rem' }} />}
            </div>
          )}

          {isFileOpened && (
            <PlayerPillButton className={styles['heroActionButton']} title={t('Play selected segments in order')} onClick={toggleLoopSelectedSegments} style={{ minWidth: '2.875rem', width: '2.875rem', height: '2.875rem', padding: 0, borderRadius: '1rem', ...loopSelectedSegmentsButtonStyle }}>
              <PlayPauseMode className={styles['playAllIcon']} />
            </PlayerPillButton>
          )}

          {(!simpleMode || !exportConfirmEnabled) && (
            <PlayerPillButton className={styles['heroToggleButton']} active={exportConfirmEnabled} danger={!exportConfirmEnabled} title={t('Show export options screen before exporting?')} onClick={toggleExportConfirmEnabled} style={{ minWidth: '2.875rem', width: '2.875rem', height: '2.875rem', padding: 0, borderRadius: '1rem' }}>
              <MdEventNote className={styles['toolbarIconSm']} />
            </PlayerPillButton>
          )}

          {!exportConfirmEnabled && (
            <FaExclamationTriangle className={styles['exportWarning']} title={t('Export options screen is disabled, and you will not see any important notices or warnings.')} />
          )}

          {isFileOpened && (
            <ExportButton className={styles['heroExportButton']} segmentsToExport={segmentsToExport} areWeCutting={areWeCutting} onClick={withBlur(onExportPress)} />
          )}
        </PlayerSurfaceGroup>
      </div>
    </div>
  );
}

export default memo(BottomBar);
