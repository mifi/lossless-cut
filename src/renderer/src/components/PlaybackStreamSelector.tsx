import type { ChangeEventHandler, ChangeEvent } from 'react';
import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { MdSubtitles } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';

import Select from './Select';
import Switch from './Switch';
import { PlayerIconButton, PlayerOverlayPopover } from './PlayerChrome';
import styles from './PlaybackStreamSelector.module.css';
import type { FFprobeStream } from '../../../common/ffprobe';


function PlaybackStreamSelector({
  subtitleStreams,
  videoStreams,
  audioStreams,
  activeSubtitleStreamIndex,
  activeVideoStreamIndex,
  activeAudioStreamIndexes,
  onActiveSubtitleChange,
  onActiveVideoStreamChange,
  onActiveAudioStreamsChange,
}: {
  subtitleStreams: FFprobeStream[],
  videoStreams: FFprobeStream[],
  audioStreams: FFprobeStream[],
  activeSubtitleStreamIndex?: number | undefined,
  activeVideoStreamIndex?: number | undefined,
  activeAudioStreamIndexes: Set<number>,
  onActiveSubtitleChange: (a?: number | undefined) => void,
  onActiveVideoStreamChange: (a?: number | undefined) => void,
  onActiveAudioStreamsChange: (a: Set<number>) => void,
}) {
  const [controlVisible, setControlVisible] = useState(false);
  const timeoutRef = useRef<number>();

  const { t } = useTranslation();

  const resetTimer = useCallback(() => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setControlVisible(false), 10000);
  }, []);

  const onChange = useCallback((e: ChangeEvent<HTMLSelectElement>, fn: (a: number | undefined) => void) => {
    resetTimer();
    const index = e.target.value ? parseInt(e.target.value, 10) : undefined;
    fn(index);
    e.target.blur();
  }, [resetTimer]);

  const onActiveSubtitleChange2 = useCallback<ChangeEventHandler<HTMLSelectElement>>((e) => onChange(e, onActiveSubtitleChange), [onActiveSubtitleChange, onChange]);
  const onActiveVideoStreamChange2 = useCallback<ChangeEventHandler<HTMLSelectElement>>((e) => onChange(e, onActiveVideoStreamChange), [onActiveVideoStreamChange, onChange]);
  const handleActiveAudioStreamsChange = useCallback((index: number, checked: boolean) => {
    resetTimer();
    const newActiveAudioStreamIndexes = new Set(activeAudioStreamIndexes);
    if (checked) newActiveAudioStreamIndexes.add(index);
    else newActiveAudioStreamIndexes.delete(index);
    onActiveAudioStreamsChange(newActiveAudioStreamIndexes);
  }, [activeAudioStreamIndexes, onActiveAudioStreamsChange, resetTimer]);

  const onIconClick = useCallback(() => {
    resetTimer();
    setControlVisible((v) => !v);
  }, [resetTimer]);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  return (
    <>
      {controlVisible && (
        <PlayerOverlayPopover>
          <motion.div className={styles['panel']} initial={{ opacity: 0, transform: 'translateX(100%)' }} animate={{ opacity: 1, transform: 'translateX(0%)' }}>
          {subtitleStreams.length > 0 && (
            <div className={styles['section']}>
              <div className={styles['sectionTitle']}>{t('Subtitle')}</div>

              <Select
                className={styles['select']}
                value={activeSubtitleStreamIndex ?? ''}
                onChange={onActiveSubtitleChange2}
                onMouseMove={resetTimer}
              >
                <option value="">{t('Default')}</option>
                {subtitleStreams.map((stream, i) => (
                  <option key={stream.index} value={stream.index}>#{i + 1} (id {stream.index + 1}) {stream.tags?.language}</option>
                ))}
              </Select>
            </div>
          )}

          {videoStreams.length > 0 && (
            <div className={styles['section']}>
              <div className={styles['sectionTitle']}>{t('Video track')}</div>

              <Select
                className={styles['select']}
                value={activeVideoStreamIndex ?? ''}
                onChange={onActiveVideoStreamChange2}
                onMouseMove={resetTimer}
              >
                <option value="">{t('Default')}</option>
                {videoStreams.map((stream, i) => (
                  <option key={stream.index} value={stream.index}>#{i + 1} (id {stream.index + 1}) {stream.codec_name}</option>
                ))}
              </Select>
            </div>
          )}

          {audioStreams.length > 0 && (
            <div className={styles['section']}>
              <div className={styles['sectionTitle']}>{t('Audio track')}</div>

              <div className={styles['audioList']}>
                {audioStreams.map((audioStream, i) => (
                  <div key={audioStream.index} className={styles['audioRow']}>
                  <Switch
                    style={{ verticalAlign: 'middle' }}
                    checked={activeAudioStreamIndexes.has(audioStream.index)}
                    onClick={(e) => e.currentTarget.blur()}
                    onCheckedChange={(checked) => handleActiveAudioStreamsChange(audioStream.index, checked)}
                  />
                  <span className={styles['audioMeta']}>
                    <span>#{i + 1}</span>
                    <span className={styles['audioHint']}>(id {audioStream.index + 1}) {audioStream.codec_name} {audioStream.tags?.language}</span>
                  </span>
                </div>
                ))}
              </div>
            </div>
          )}
          </motion.div>
        </PlayerOverlayPopover>
      )}

      <PlayerIconButton title={t('Subtitle')} active={controlVisible} onClick={onIconClick}>
        <MdSubtitles size={18} />
      </PlayerIconButton>
    </>
  );
}

export default memo(PlaybackStreamSelector);
