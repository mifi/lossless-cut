import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { FaVolumeMute, FaVolumeUp } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';


function VolumeControl({ playbackVolume, setPlaybackVolume, onToggleMutedClick }: { playbackVolume: number, setPlaybackVolume: (a: number) => void, onToggleMutedClick: () => void }) {
  const [volumeControlVisible, setVolumeControlVisible] = useState(false);
  const timeoutRef = useRef<number>();
  const { t } = useTranslation();

  useEffect(() => {
    const clear = () => clearTimeout(timeoutRef.current);
    clear();
    timeoutRef.current = window.setTimeout(() => setVolumeControlVisible(false), 4000);
    return () => clear();
  }, [playbackVolume, volumeControlVisible]);

  const onVolumeChange = useCallback((e) => {
    e.target.blur();
    setPlaybackVolume(e.target.value / 100);
  }, [setPlaybackVolume]);

  const onVolumeIconClick = useCallback(() => {
    if (volumeControlVisible) {
      onToggleMutedClick();
    } else {
      setVolumeControlVisible(true);
    }
  }, [onToggleMutedClick, volumeControlVisible]);

  const VolumeIcon = playbackVolume === 0 ? FaVolumeMute : FaVolumeUp;

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
        style={{ margin: '0 7px', color: 'var(--gray12)', opacity: 0.7 }}
        onClick={onVolumeIconClick}
      />
    </>
  );
}

export default memo(VolumeControl);
