import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import CopyClipboardButton from './components/CopyClipboardButton';
import Sheet from './components/Sheet';
import { FfmpegCommandLog } from './types';

function LastCommandsSheet({ visible, onTogglePress, ffmpegCommandLog }: {
  visible: boolean, onTogglePress: () => void, ffmpegCommandLog: FfmpegCommandLog,
}) {
  const { t } = useTranslation();

  return (
    <Sheet visible={visible} onClosePress={onTogglePress} style={{ padding: '0 1em' }}>
      <h2>{t('Last ffmpeg commands')}</h2>

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
}

export default memo(LastCommandsSheet);
