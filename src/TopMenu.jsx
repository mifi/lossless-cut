import React, { memo, useCallback } from 'react';
import { IoIosSettings } from 'react-icons/io';
import { FaLock, FaUnlock } from 'react-icons/fa';
import { IconButton, Button, CrossIcon, ListIcon, VolumeUpIcon, VolumeOffIcon } from 'evergreen-ui';
import { useTranslation } from 'react-i18next';

import ExportModeButton from './components/ExportModeButton';

import { withBlur } from './util';
import { primaryTextColor, controlsBackground, darkModeTransition } from './colors';
import useUserSettings from './hooks/useUserSettings';


const TopMenu = memo(({
  filePath, fileFormat, copyAnyAudioTrack, toggleStripAudio,
  renderOutFmt, numStreamsToCopy, numStreamsTotal, setStreamsSelectorShown, toggleSettings,
  selectedSegments, isCustomFormatSelected, clearOutDir,
}) => {
  const { t } = useTranslation();
  const { customOutDir, changeOutDir, simpleMode, outFormatLocked, setOutFormatLocked } = useUserSettings();

  const onOutFormatLockedClick = useCallback(() => setOutFormatLocked((v) => (v ? undefined : fileFormat)), [fileFormat, setOutFormatLocked]);

  const showClearWorkingDirButton = !!customOutDir;

  function renderFormatLock() {
    const Icon = outFormatLocked ? FaLock : FaUnlock;
    return <Icon onClick={onOutFormatLockedClick} title={t('Lock/unlock output format')} size={14} style={{ marginRight: 7, marginLeft: 2, color: outFormatLocked ? primaryTextColor : undefined }} />;
  }

  return (
    <div
      className="no-user-select"
      style={{ background: controlsBackground, transition: darkModeTransition, display: 'flex', alignItems: 'center', padding: '3px 5px', justifyContent: 'space-between', flexWrap: 'wrap' }}
    >
      {filePath && (
        <>
          <Button height={20} iconBefore={ListIcon} onClick={withBlur(() => setStreamsSelectorShown(true))}>
            {t('Tracks')} ({numStreamsToCopy}/{numStreamsTotal})
          </Button>

          <Button
            iconBefore={copyAnyAudioTrack ? VolumeUpIcon : VolumeOffIcon}
            height={20}
            title={`${t('Discard audio? Current:')} ${copyAnyAudioTrack ? t('Keep audio tracks') : t('Discard audio tracks')}`}
            onClick={withBlur(toggleStripAudio)}
          >
            {copyAnyAudioTrack ? t('Keep audio') : t('Discard audio')}
          </Button>
        </>
      )}

      <div style={{ flexGrow: 1 }} />

      {showClearWorkingDirButton && (
        <IconButton
          intent="danger"
          icon={CrossIcon}
          height={20}
          onClick={withBlur(clearOutDir)}
          title={t('Clear working directory')}
        />
      )}

      <Button
        height={20}
        onClick={withBlur(changeOutDir)}
        title={customOutDir}
        paddingLeft={showClearWorkingDirButton ? 4 : undefined}
      >
        {customOutDir ? t('Working dir set') : t('Working dir unset')}
      </Button>

      {filePath && (
        <>
          {renderOutFmt({ height: 20, maxWidth: 100 })}

          {!simpleMode && (isCustomFormatSelected || outFormatLocked) && renderFormatLock()}

          <ExportModeButton selectedSegments={selectedSegments} style={{ flexGrow: 0, flexBasis: 140 }} />
        </>
      )}

      <IoIosSettings size={24} role="button" onClick={toggleSettings} style={{ verticalAlign: 'middle', marginLeft: 5 }} />
    </div>
  );
});

export default TopMenu;
