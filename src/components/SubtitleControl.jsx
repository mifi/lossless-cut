import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import { MdSubtitles } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import Select from './Select';

const SubtitleControl = memo(({ subtitleStreams, activeSubtitleStreamIndex, onActiveSubtitleChange }) => {
  const [controlVisible, setControlVisible] = useState(false);
  const timeoutRef = useRef();

  const { t } = useTranslation();

  const resetTimer = useCallback(() => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setControlVisible(false), 7000);
  }, []);

  const onChange = useCallback((e) => {
    resetTimer();
    const index = e.target.value ? parseInt(e.target.value, 10) : undefined;
    onActiveSubtitleChange(index);
    e.target.blur();
  }, [onActiveSubtitleChange, resetTimer]);

  const onIconClick = useCallback(() => {
    resetTimer();
    setControlVisible((v) => !v);
  }, [resetTimer]);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  return (
    <>
      {controlVisible && (
        <Select
          value={activeSubtitleStreamIndex}
          onChange={onChange}
        >
          <option value="">{t('Subtitle')}</option>
          {subtitleStreams.map((stream) => (
            <option key={stream.index} value={stream.index}>{(stream.tags && stream.tags.language) || stream.index}</option>
          ))}
        </Select>
      )}

      <MdSubtitles
        size={30}
        role="button"
        style={{ margin: '0 7px', color: 'var(--gray12)', opacity: 0.7 }}
        onClick={onIconClick}
      />
    </>
  );
});

export default SubtitleControl;
