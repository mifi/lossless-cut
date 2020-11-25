import React, { Fragment, memo } from 'react';
import { IoIosHelpCircle, IoIosSettings } from 'react-icons/io';
import { Button } from 'evergreen-ui';
import { useTranslation } from 'react-i18next';

import { withBlur } from './util';


const TopMenu = memo(({
  filePath, copyAnyAudioTrack, toggleStripAudio, customOutDir, changeOutDir,
  renderOutFmt, toggleHelp, numStreamsToCopy, numStreamsTotal, setStreamsSelectorShown, toggleSettings,
}) => {
  const { t } = useTranslation();

  return (
    <Fragment>
      {filePath && (
        <Fragment>
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
        </Fragment>
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
        <Fragment>
          {renderOutFmt({ height: 20, maxWidth: 100 })}
        </Fragment>
      )}

      <IoIosHelpCircle size={24} role="button" onClick={toggleHelp} style={{ verticalAlign: 'middle', marginLeft: 5 }} />
      <IoIosSettings size={24} role="button" onClick={toggleSettings} style={{ verticalAlign: 'middle', marginLeft: 5 }} />
    </Fragment>
  );
});

export default TopMenu;
