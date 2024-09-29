import { memo, useState, useCallback, useRef, useEffect, ChangeEventHandler, ChangeEvent } from 'react';
import { MdSubtitles } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import Select from './Select';

import { FFprobeStream } from '../../../../ffprobe';

function PlaybackStreamSelector({
  subtitleStreams,
  videoStreams,
  audioStreams,
  activeSubtitleStreamIndex,
  activeVideoStreamIndex,
  activeAudioStreamIndex,
  onActiveSubtitleChange,
  onActiveVideoStreamChange,
  onActiveAudioStreamChange,
}: {
  subtitleStreams: FFprobeStream[],
  videoStreams: FFprobeStream[],
  audioStreams: FFprobeStream[],
  activeSubtitleStreamIndex?: number | undefined,
  activeVideoStreamIndex?: number | undefined,
  activeAudioStreamIndex?: number | undefined,
  onActiveSubtitleChange: (a?: number | undefined) => void,
  onActiveVideoStreamChange: (a?: number | undefined) => void,
  onActiveAudioStreamChange: (a?: number | undefined) => void,
}) {
  const [controlVisible, setControlVisible] = useState(false);
  const timeoutRef = useRef<number>();

  const { t } = useTranslation();

  const resetTimer = useCallback(() => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setControlVisible(false), 7000);
  }, []);

  const onChange = useCallback((e: ChangeEvent<HTMLSelectElement>, fn: (a: number | undefined) => void) => {
    resetTimer();
    const index = e.target.value ? parseInt(e.target.value, 10) : undefined;
    fn(index);
    e.target.blur();
  }, [resetTimer]);

  const onActiveSubtitleChange2 = useCallback<ChangeEventHandler<HTMLSelectElement>>((e) => onChange(e, onActiveSubtitleChange), [onActiveSubtitleChange, onChange]);
  const onActiveVideoStreamChange2 = useCallback<ChangeEventHandler<HTMLSelectElement>>((e) => onChange(e, onActiveVideoStreamChange), [onActiveVideoStreamChange, onChange]);
  const onActiveAudioStreamChange2 = useCallback<ChangeEventHandler<HTMLSelectElement>>((e) => onChange(e, onActiveAudioStreamChange), [onActiveAudioStreamChange, onChange]);

  const onIconClick = useCallback(() => {
    resetTimer();
    setControlVisible((v) => !v);
  }, [resetTimer]);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  return (
    <>
      {controlVisible && (
        <>
          {subtitleStreams.length > 0 && (
            <Select
              value={activeSubtitleStreamIndex ?? ''}
              onChange={onActiveSubtitleChange2}
              onMouseMove={resetTimer}
            >
              <option value="">{t('Subtitle')}</option>
              {subtitleStreams.map((stream, i) => (
                <option key={stream.index} value={stream.index}>#{i + 1} (id {stream.index}) {stream.tags?.language}</option>
              ))}
            </Select>
          )}

          {videoStreams.length > 0 && (
            <Select
              value={activeVideoStreamIndex ?? ''}
              onChange={onActiveVideoStreamChange2}
              onMouseMove={resetTimer}
            >
              <option value="">{t('Video track')}</option>
              {videoStreams.map((stream, i) => (
                <option key={stream.index} value={stream.index}>#{i + 1} (id {stream.index + 1}) {stream.codec_name}</option>
              ))}
            </Select>
          )}

          {audioStreams.length > 0 && (
            <Select
              value={activeAudioStreamIndex ?? ''}
              onChange={onActiveAudioStreamChange2}
              onMouseMove={resetTimer}
            >
              <option value="">{t('Audio track')}</option>
              {audioStreams.map((stream, i) => (
                <option key={stream.index} value={stream.index}>#{i + 1} (id {stream.index + 1}) {stream.codec_name} - {stream.tags?.language}</option>
              ))}
            </Select>
          )}
        </>
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
