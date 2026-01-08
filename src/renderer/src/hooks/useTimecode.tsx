import type { FormEventHandler } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { FormatTimecode, ParseTimecode } from '../types';
import { getFrameCountRaw } from '../edlFormats';
import { getFrameDuration } from '../util';
import type { TimecodeFormat } from '../../../common/types';
import { formatDuration, parseDuration } from '../util/duration';
import type { ShowGenericDialog } from '../components/GenericDialog';
import { useGenericDialogContext } from '../components/GenericDialog';
import * as Dialog from '../components/Dialog';
import TextInput from '../components/TextInput';
import { ButtonRow } from '../components/Dialog';
import { DialogButton } from '../components/Button';
import { dangerColor } from '../colors';


export default ({ detectedFps, timecodeFormat, showGenericDialog }: {
  detectedFps: number | undefined,
  timecodeFormat: TimecodeFormat,
  showGenericDialog: ShowGenericDialog,
}) => {
  const getFrameCount = useCallback((sec: number) => getFrameCountRaw(detectedFps, sec), [detectedFps]);
  const frameCountToDuration = useCallback((frames: number) => getFrameDuration(detectedFps) * frames, [detectedFps]);

  const formatTimecode = useCallback<FormatTimecode>(({ seconds, shorten, fileNameFriendly }) => {
    if (timecodeFormat === 'frameCount') {
      const frameCount = getFrameCount(seconds);
      return frameCount != null ? String(frameCount) : '';
    }
    if (timecodeFormat === 'seconds') {
      return seconds.toFixed(3);
    }
    if (timecodeFormat === 'timecodeWithFramesFraction') {
      return formatDuration({ seconds, shorten, fileNameFriendly, fps: detectedFps });
    }
    return formatDuration({ seconds, shorten, fileNameFriendly });
  }, [detectedFps, timecodeFormat, getFrameCount]);

  const timecodePlaceholder = useMemo(() => formatTimecode({ seconds: 0, shorten: false }), [formatTimecode]);

  const parseTimecode = useCallback<ParseTimecode>((val: string) => {
    if (timecodeFormat === 'frameCount') {
      const parsed = parseInt(val, 10);
      return frameCountToDuration(parsed);
    }
    if (timecodeFormat === 'seconds') {
      return parseFloat(val);
    }
    if (timecodeFormat === 'timecodeWithFramesFraction') {
      return parseDuration(val, detectedFps);
    }
    return parseDuration(val);
  }, [detectedFps, frameCountToDuration, timecodeFormat]);

  const formatTimeAndFrames = useCallback((seconds: number) => {
    const frameCount = getFrameCount(seconds);

    const timeStr = timecodeFormat === 'timecodeWithFramesFraction'
      ? formatDuration({ seconds, fps: detectedFps })
      : formatDuration({ seconds });

    return `${timeStr} (${frameCount ?? '0'})`;
  }, [detectedFps, timecodeFormat, getFrameCount]);

  const promptTimecode = useCallback(async ({ initialValue, title, description, inputPlaceholder, allowRelative = false }: {
    initialValue?: string | undefined,
    title: string,
    description?: string | undefined,
    inputPlaceholder: string,
    allowRelative?: boolean,
  }) => new Promise<{ duration: number, relDirection: number | undefined } | undefined>((resolve) => {
    function TimecodeDialog() {
      const { t } = useTranslation();
      const [value, setValue] = useState(initialValue ?? '');
      const [error, setError] = useState<string | undefined>();

      const { onOpenChange } = useGenericDialogContext();

      const handleSubmit = useCallback<FormEventHandler<HTMLFormElement>>(async (e) => {
        e.preventDefault();

        let relDirection: number | undefined;
        if (allowRelative) {
          if (value.startsWith('-')) relDirection = -1;
          else if (value.startsWith('+')) relDirection = 1;
        }

        const withoutPrefix = allowRelative ? value.replace(/^[+-]/, '') : value;

        const duration = parseTimecode(withoutPrefix);

        setError(duration == null ? t('Invalid timecode format') : undefined);

        if (duration != null) {
          resolve({ duration, relDirection });
          onOpenChange(false);
        }
      }, [onOpenChange, t, value]);

      return (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <Dialog.Content aria-describedby={undefined} style={{ width: '80vw' }}>
          <Dialog.Title>{title}</Dialog.Title>

          {description && <Dialog.Description>{description}</Dialog.Description>}

          <form onSubmit={handleSubmit}>
            <TextInput
              value={value}
              placeholder={inputPlaceholder}
              onChange={(e) => setValue(e.target.value)}
              style={{ margin: '1em 0', width: '100%', boxSizing: 'border-box' }}
            />

            {error != null && (
              <div style={{ color: dangerColor, fontWeight: 'bold' }}>
                {error}
              </div>
            )}

            <ButtonRow>
              <Dialog.Close asChild>
                <DialogButton>{t('Cancel')}</DialogButton>
              </Dialog.Close>

              <DialogButton type="submit" primary>{t('Go')}</DialogButton>
            </ButtonRow>
          </form>
        </Dialog.Content>
      );
    }

    showGenericDialog({
      render: () => <TimecodeDialog />,
      onClose: () => resolve(undefined),
    });
  }), [parseTimecode, showGenericDialog]);

  return {
    parseTimecode,
    formatTimecode,
    formatTimeAndFrames,
    timecodePlaceholder,
    getFrameCount,
    promptTimecode,
  };
};
