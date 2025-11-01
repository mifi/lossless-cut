import { Dispatch, memo, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { DateTime } from 'luxon';
import sortBy from 'lodash/sortBy.js';

import CopyClipboardButton from './components/CopyClipboardButton';
import { FfmpegCommandLog } from './types';
import Button from './components/Button';
import * as Dialog from './components/Dialog';

function LastCommands({ visible, onTogglePress, ffmpegCommandLog, setFfmpegCommandLog }: {
  visible: boolean,
  onTogglePress: () => void,
  ffmpegCommandLog: FfmpegCommandLog,
  setFfmpegCommandLog: Dispatch<SetStateAction<FfmpegCommandLog>>,
}) {
  const { t } = useTranslation();

  return (
    <Dialog.Root open={visible} onOpenChange={onTogglePress}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content style={{ width: '200em' }}>
          <Dialog.Title>{t('Last ffmpeg commands')}</Dialog.Title>
          <Dialog.Description>{t('The last executed ffmpeg commands will show up here after you run operations. You can copy them to clipboard and modify them to your needs before running on your command line.')}</Dialog.Description>

          {ffmpegCommandLog.length > 0 && (
            <div>
              <Button onClick={() => setFfmpegCommandLog([])} style={{ fontSize: '1em', marginBottom: '.5em' }}>{t('Clear')}</Button>

              {sortBy(ffmpegCommandLog, (l) => -l.time).map(({ command, time }, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <div key={i} style={{ whiteSpace: 'pre', padding: '.3em 0', fontFamily: 'monospace', overflow: 'scroll' }}>
                  <CopyClipboardButton text={command} style={{ marginRight: '.5em', verticalAlign: 'middle' }} />
                  <span style={{ opacity: 0.5, marginRight: '.5em' }}>{DateTime.fromJSDate(time).toLocaleString(DateTime.TIME_WITH_SECONDS)}</span>
                  {command}
                </div>
              ))}
            </div>
          )}

          <Dialog.CloseButton />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default memo(LastCommands);
