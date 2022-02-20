import React, { memo } from 'react';
import { FaKeyboard } from 'react-icons/fa';
import { useTranslation, Trans } from 'react-i18next';
import { Button } from 'evergreen-ui';

import CopyClipboardButton from './components/CopyClipboardButton';
import { primaryTextColor } from './colors';
import Sheet from './Sheet';

const electron = window.require('electron');

const { githubLink } = electron.remote.require('./constants');

const HelpSheet = memo(({ visible, onTogglePress, ffmpegCommandLog, onKeyboardShortcutsDialogRequested }) => {
  const { t } = useTranslation();

  return (
    <Sheet visible={visible} onClosePress={onTogglePress} style={{ background: '#6b6b6b', color: 'white' }}>
      <div className="help-sheet">
        <h1>{t('Common problems')}</h1>
        <p>
          {t('Lossless cutting is not an exact science. For some codecs and files it just works. For others you may need to trial and error depending on the codec, keyframes etc to get the best cut.')}
        </p>
        <ol>
          <li><Trans>Try both <b>Normal cut</b> and <b>Keyframe cut</b></Trans></li>
          <li><Trans>Try to set the <b>start-</b>cutpoint a <b>few frames before or after</b> the nearest keyframe (may also solve audio sync issues)</Trans></li>
          <li><Trans>Disable unnecessary <b>Tracks</b></Trans></li>
          <li><Trans>Select a different output <b>Format</b> (<b>matroska</b> and <b>mp4</b> support most codecs)</Trans></li>
          <li><Trans>Try to enable the <b>Experimental Flag</b> in Settings</Trans></li>
        </ol>

        <p style={{ fontWeight: 'bold' }}>
          {t('For more help and issues, please go to:')}<br />
          <span style={{ color: primaryTextColor, cursor: 'pointer' }} role="button" onClick={() => electron.shell.openExternal(githubLink)}>{githubLink}</span>
        </p>

        <Button iconBefore={() => <FaKeyboard />} onClick={onKeyboardShortcutsDialogRequested}>{t('Keyboard & mouse shortcuts')}</Button>

        <p style={{ fontWeight: 'bold' }}>{t('Hover mouse over buttons in the main interface to see which function they have')}</p>

        <h1 style={{ marginTop: 40 }}>{t('Last ffmpeg commands')}</h1>
        {ffmpegCommandLog.length > 0 ? (
          <div style={{ overflowY: 'scroll', height: 200 }}>
            {ffmpegCommandLog.reverse().map(({ command }, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={i} style={{ whiteSpace: 'pre', margin: '5px 0' }}>
                <CopyClipboardButton text={command} /> {command}
              </div>
            ))}
          </div>
        ) : (
          <p>{t('The last executed ffmpeg commands will show up here after you run operations. You can copy them to clipboard and modify them to your needs before running on your command line.')}</p>
        )}
      </div>
    </Sheet>
  );
});

export default HelpSheet;
