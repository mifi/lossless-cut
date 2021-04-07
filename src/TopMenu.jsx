import React, { memo } from 'react';
import { IoIosHelpCircle, IoIosSettings } from 'react-icons/io';
import { FaLock, FaUnlock } from 'react-icons/fa';
import { Button } from 'evergreen-ui';
import { useTranslation } from 'react-i18next';

import MergeExportButton from './components/MergeExportButton';

import { withBlur } from './util';
import { primaryTextColor } from './colors';


const TopMenu = memo(({
  filePath, copyAnyAudioTrack, toggleStripAudio, customOutDir, changeOutDir,
  renderOutFmt, toggleHelp, numStreamsToCopy, numStreamsTotal, setStreamsSelectorShown, toggleSettings,
  enabledOutSegments, autoMerge, setAutoMerge, autoDeleteMergedSegments, setAutoDeleteMergedSegments, isCustomFormatSelected, onOutFormatLockedClick, simpleMode, outFormatLocked,
}) => {
  const { t } = useTranslation();

  function renderFormatLock() {
    const Icon = outFormatLocked ? FaLock : FaUnlock;
    return <Icon onClick={onOutFormatLockedClick} title={t('Lock/unlock output format')} size={14} style={{ marginRight: 7, marginLeft: 2, color: outFormatLocked ? primaryTextColor : undefined }} />;
  }

  return (
    <>
      {filePath && (
        <>
          <Button height={20} iconBefore="list" onClick={withBlur(() => setStreamsSelectorShown(true))}>
            {t('Tracks')} ({numStreamsToCopy}/{numStreamsTotal})
          </Button>

          <Button
            iconBefore={copyAnyAudioTrack ? 'volume-up' : 'volume-off'}
            height={20}
            title={`${t('Discard audio? Current:')} ${copyAnyAudioTrack ? t('Keep audio tracks') : t('Discard audio tracks')}`}
            onClick={withBlur(toggleStripAudio)}
          >
            {copyAnyAudioTrack ? t('Keep audio') : t('Discard audio')}
          </Button>
        </>
      )}

      <div style={{ flexGrow: 1 }} />

      <Button
        iconBefore={customOutDir ? 'folder-open' : undefined}
        height={20}
        onClick={withBlur(changeOutDir)}
        title={customOutDir}
      >
        {customOutDir ? t('Working dir set') : t('Working dir unset')}
      </Button>

      {filePath && (
        <>
          {renderOutFmt({ height: 20, maxWidth: 100 })}

          {!simpleMode && (isCustomFormatSelected || outFormatLocked) && renderFormatLock()}

          <MergeExportButton autoMerge={autoMerge} enabledOutSegments={enabledOutSegments} setAutoMerge={setAutoMerge} autoDeleteMergedSegments={autoDeleteMergedSegments} setAutoDeleteMergedSegments={setAutoDeleteMergedSegments} />
        </>
      )}

      <IoIosHelpCircle size={24} role="button" onClick={toggleHelp} style={{ verticalAlign: 'middle', marginLeft: 5 }} />
      <IoIosSettings size={24} role="button" onClick={toggleSettings} style={{ verticalAlign: 'middle', marginLeft: 5 }} />
    </>
  );
});

export default TopMenu;
