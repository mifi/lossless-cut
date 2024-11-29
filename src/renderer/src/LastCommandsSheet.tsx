import { Dispatch, memo, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { DateTime } from 'luxon';
import sortBy from 'lodash/sortBy.js';

import CopyClipboardButton from './components/CopyClipboardButton';
import Sheet from './components/Sheet';
import { FfmpegCommandLog } from './types';
import Button from './components/Button';

function LastCommandsSheet({ visible, onTogglePress, ffmpegCommandLog, setFfmpegCommandLog }: {
  visible: boolean,
  onTogglePress: () => void,
  ffmpegCommandLog: FfmpegCommandLog,
  setFfmpegCommandLog: Dispatch<SetStateAction<FfmpegCommandLog>>,
}) {
  const { t } = useTranslation();

  return (
    <Sheet visible={visible} onClosePress={onTogglePress} style={{ padding: '0 1em' }} maxWidth={2000}>
      <h2>{t('Last ffmpeg commands')}</h2>

      {ffmpegCommandLog.length > 0 ? (
        <div>
          <Button onClick={() => setFfmpegCommandLog([])} style={{ fontSize: '1em', marginBottom: '.5em' }}>{t('Clear')}</Button>

          {sortBy(ffmpegCommandLog, (l) => -l.time).map(({ command, time }, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={i} style={{ whiteSpace: 'pre', margin: '5px 0', fontFamily: 'monospace' }}>
              <CopyClipboardButton text={command} style={{ marginRight: '.5em', verticalAlign: 'middle' }} />
              <span style={{ opacity: 0.5, marginRight: '.5em' }}>{DateTime.fromJSDate(time).toLocaleString(DateTime.TIME_WITH_SECONDS)}</span>
              {command}
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
