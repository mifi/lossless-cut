import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Heading } from 'evergreen-ui';

import CopyClipboardButton from './components/CopyClipboardButton';
import Sheet from './components/Sheet';

const LastCommandsSheet = memo(({ visible, onTogglePress, ffmpegCommandLog }) => {
  const { t } = useTranslation();

  return (
    <Sheet visible={visible} onClosePress={onTogglePress} style={{ paddingTop: '2em' }}>
      <Heading color="white">{t('Last ffmpeg commands')}</Heading>

      {ffmpegCommandLog.length > 0 ? (
        <div>
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
    </Sheet>
  );
});

export default LastCommandsSheet;
