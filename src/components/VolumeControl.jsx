import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import { FaVolumeMute, FaVolumeUp } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

const VolumeControl = memo(({ playbackVolume, setPlaybackVolume, usingDummyVideo }) => {
  const [volumeControlVisible, setVolumeControlVisible] = useState(false);
  const timeoutRef = useRef();
  const { t } = useTranslation();

  useEffect(() => {
    const clear = () => clearTimeout(timeoutRef.current);
    clear();
    timeoutRef.current = setTimeout(() => setVolumeControlVisible(false), 5000);
    return () => clear();
  }, [playbackVolume, volumeControlVisible]);

  const onVolumeChange = useCallback((e) => {
    e.target.blur();
    setPlaybackVolume(e.target.value / 100);
  }, [setPlaybackVolume]);

  const onVolumeIconClick = useCallback(() => {
    if (volumeControlVisible) {
      if (playbackVolume === 0) setPlaybackVolume(1);
      if (playbackVolume === 1) setPlaybackVolume(0);
    } else {
      setVolumeControlVisible(true);
    }
  }, [volumeControlVisible, setPlaybackVolume, playbackVolume]);

  // TODO fastest-audio currently shows as muted
  const VolumeIcon = playbackVolume === 0 || usingDummyVideo ? FaVolumeMute : FaVolumeUp;

  return (
    <>
      {volumeControlVisible && (
        <input
          type="range"
          min={0}
          max={100}
          value={playbackVolume * 100}
          onChange={onVolumeChange}
        />
      )}

      <VolumeIcon
        title={t('Mute preview? (will not affect output)')}
        size={30}
        role="button"
        style={{ margin: '0 7px' }}
        onClick={onVolumeIconClick}
      />
    </>
  );
});

export default VolumeControl;
