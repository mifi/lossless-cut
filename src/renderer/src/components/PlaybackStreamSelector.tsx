import { memo, useState, useCallback, useRef, useEffect, ChangeEventHandler, ChangeEvent } from 'react';
import { MdSubtitles } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import Select from './Select';
import Switch from './Switch';
import styles from './PlaybackStreamSelector.module.css';
import { FFprobeStream } from '../../../../ffprobe';


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
        <motion.div className={styles['wrapper']} initial={{ opacity: 0, transform: 'translateX(100%)' }} animate={{ opacity: 1, transform: 'translateX(0%)' }}>
          {subtitleStreams.length > 0 && (
            <div style={{ margin: '0 .5em' }}>
              <div style={{ marginBottom: '.3em' }}>{t('Subtitle')}</div>

              <Select
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
            <div style={{ margin: '0 .5em' }}>
              <div style={{ marginBottom: '.3em' }}>{t('Video track')}</div>

              <Select
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
            <div style={{ margin: '0 .5em' }}>
              <div style={{ marginBottom: '.3em' }}>{t('Audio track')}</div>

              {audioStreams.map((audioStream, i) => (
                <div key={audioStream.index}>
                  <Switch
                    style={{ verticalAlign: 'middle', marginRight: '.4em' }}
                    checked={activeAudioStreamIndexes.has(audioStream.index)}
                    onClick={(e) => e.currentTarget.blur()}
                    onCheckedChange={(checked) => handleActiveAudioStreamsChange(audioStream.index, checked)}
                  />
                  <span style={{ verticalAlign: 'middle', marginRight: '.1em' }}>
                    #{i + 1} <span style={{ opacity: 0.5 }}>(id {audioStream.index + 1}) {audioStream.codec_name} {audioStream.tags?.language}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      <MdSubtitles
        size={30}
        role="button"
        style={{ margin: '0 7px', color: 'var(--gray12)', opacity: 0.7 }}
        onClick={onIconClick}
      />
    </>
  );
}

export default memo(PlaybackStreamSelector);
