import React, { memo, useCallback } from 'react';
import { IoIosSettings } from 'react-icons/io';
import { FaLock, FaUnlock } from 'react-icons/fa';
import { CrossIcon, ListIcon, VolumeUpIcon, VolumeOffIcon } from 'evergreen-ui';
import { useTranslation } from 'react-i18next';
import Button from './components/Button';

import ExportModeButton from './components/ExportModeButton';

import { withBlur } from './util';
import { primaryTextColor, controlsBackground, darkModeTransition } from './colors';
import useUserSettings from './hooks/useUserSettings';


const outFmtStyle = { height: 20, maxWidth: 100 };
const exportModeStyle = { flexGrow: 0, flexBasis: 140 };

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
          <Button onClick={withBlur(() => setStreamsSelectorShown(true))}>
            <ListIcon size="1em" verticalAlign="middle" marginRight=".3em" />
            {t('Tracks')} ({numStreamsToCopy}/{numStreamsTotal})
          </Button>

          <Button
            title={copyAnyAudioTrack ? t('Keep audio tracks') : t('Discard audio tracks')}
            onClick={withBlur(toggleStripAudio)}
          >
            {copyAnyAudioTrack ? (
              <><VolumeUpIcon size="1em" verticalAlign="middle" marginRight=".3em" />{t('Keep audio')}</>
            ) : (
              <><VolumeOffIcon size="1em" verticalAlign="middle" marginRight=".3em" />{t('Discard audio')}</>
            )}
          </Button>
        </>
      )}

      <div style={{ flexGrow: 1 }} />

      {showClearWorkingDirButton && (
        <CrossIcon
          role="button"
          tabIndex={0}
          style={{ width: 20 }}
          onClick={withBlur(clearOutDir)}
          title={t('Clear working directory')}
        />
      )}

      <Button
        onClick={withBlur(changeOutDir)}
        title={customOutDir}
        style={{ paddingLeft: showClearWorkingDirButton ? 4 : undefined }}
      >
        {customOutDir ? t('Working dir set') : t('Working dir unset')}
      </Button>

      {filePath && (
        <>
          {renderOutFmt(outFmtStyle)}

          {!simpleMode && (isCustomFormatSelected || outFormatLocked) && renderFormatLock()}

          <ExportModeButton selectedSegments={selectedSegments} style={exportModeStyle} />
        </>
      )}

      <IoIosSettings size={24} role="button" onClick={toggleSettings} style={{ marginLeft: 5 }} />
    </div>
  );
});

export default TopMenu;
