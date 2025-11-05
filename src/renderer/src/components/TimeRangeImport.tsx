import { memo, useCallback, useState, FormEventHandler, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FaScissors } from 'react-icons/fa';
import * as Dialog from './Dialog';
import Button, { DialogButton } from './Button';
import TextInput from './TextInput';
import { dangerColor, successColor } from '../colors';
import { parseDuration } from '../util/duration';

interface TimeRange {
  start: number;
  end: number;
}

/**
 * Parse time range string in format: HH:MM:SS-HH:MM:SS|MM:SS-MM:SS|...
 * Examples:
 *   03:05-03:10
 *   40:05-40:10
 *   1:03:05-1:04:05
 *   03:05-03:10|40:05-40:10|1:03:05-1:04:05
 */
function parseTimeRanges(input: string): TimeRange[] | null {
  if (!input || !input.trim()) {
    return null;
  }

  const ranges: TimeRange[] = [];
  const segments = input.split('|').map(s => s.trim()).filter(s => s);

  for (const segment of segments) {
    const parts = segment.split('-').map(p => p.trim());

    if (parts.length !== 2) {
      return null; // Invalid format
    }

    const [startStr, endStr] = parts;
    const start = parseDuration(startStr);
    const end = parseDuration(endStr);

    if (start == null || end == null) {
      return null; // Invalid time format
    }

    if (start >= end) {
      return null; // Start must be before end
    }

    ranges.push({ start, end });
  }

  return ranges.length > 0 ? ranges : null;
}

function TimeRangeImport({ isShown, onHide, onImport }: {
  isShown: boolean;
  onHide: () => void;
  onImport: (ranges: TimeRange[]) => void;
}) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [previewRanges, setPreviewRanges] = useState<TimeRange[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isShown) {
      inputRef.current?.focus();
    }
  }, [isShown]);

  // Preview the parsed ranges as user types
  useEffect(() => {
    if (!input.trim()) {
      setPreviewRanges(null);
      setError(undefined);
      return;
    }

    const ranges = parseTimeRanges(input);
    if (ranges) {
      setPreviewRanges(ranges);
      setError(undefined);
    } else {
      setPreviewRanges(null);
      // Don't show error while typing, only on submit
    }
  }, [input]);

  const handleSubmit = useCallback<FormEventHandler<HTMLFormElement>>((e) => {
    e.preventDefault();

    const ranges = parseTimeRanges(input);

    if (!ranges) {
      setError(t('Invalid time range format. Please use format: HH:MM:SS-HH:MM:SS|HH:MM:SS-HH:MM:SS'));
      return;
    }

    onImport(ranges);
    setInput('');
    setError(undefined);
    setPreviewRanges(null);
    onHide();
  }, [input, onImport, onHide, t]);

  const handleCancel = useCallback(() => {
    setInput('');
    setError(undefined);
    setPreviewRanges(null);
    onHide();
  }, [onHide]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  };

  const getTotalDuration = () => {
    if (!previewRanges) return 0;
    return previewRanges.reduce((sum, range) => sum + (range.end - range.start), 0);
  };

  return (
    <Dialog.Root open={isShown} onOpenChange={(open) => !open && handleCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content style={{ width: '50em', maxWidth: '90vw' }}>
          <Dialog.Title>
            <FaScissors style={{ marginRight: '.5em', verticalAlign: 'middle' }} />
            {t('Import Time Ranges')}
          </Dialog.Title>
          <Dialog.Description>
            {t('Enter time ranges to cut and concatenate from your video')}
          </Dialog.Description>

          <form onSubmit={handleSubmit}>
            <div style={{ marginTop: '1em', marginBottom: '1em' }}>
              <label htmlFor="timeRangeInput" style={{ display: 'block', marginBottom: '.5em', fontWeight: 'bold' }}>
                {t('Time Range Format')}:
              </label>
              <div style={{ marginBottom: '.5em', fontSize: '.9em', opacity: 0.8 }}>
                {t('Format')}: <code>HH:MM:SS-HH:MM:SS|MM:SS-MM:SS|...</code>
                <br />
                {t('Example')}: <code>03:05-03:10|40:05-40:10|1:03:05-1:04:05</code>
              </div>
              <TextInput
                id="timeRangeInput"
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="03:05-03:10|40:05-40:10|1:03:05-1:04:05"
                style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'monospace' }}
              />
            </div>

            {error && (
              <div style={{ color: dangerColor, fontWeight: 'bold', marginBottom: '1em' }}>
                {error}
              </div>
            )}

            {previewRanges && previewRanges.length > 0 && (
              <div style={{ marginBottom: '1em', padding: '1em', backgroundColor: 'var(--gray-2)', borderRadius: '.5em' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '.5em', color: successColor }}>
                  {t('Preview')}: {previewRanges.length} {t('segment(s)')}
                </div>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {previewRanges.map((range, index) => (
                    <div key={index} style={{ marginBottom: '.3em', fontSize: '.9em' }}>
                      <strong>{t('Segment')} {index + 1}:</strong>{' '}
                      {formatTime(range.start)} → {formatTime(range.end)}{' '}
                      <span style={{ opacity: 0.7 }}>
                        ({formatTime(range.end - range.start)})
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '.5em', paddingTop: '.5em', borderTop: '1px solid var(--gray-4)', fontWeight: 'bold' }}>
                  {t('Total duration')}: {formatTime(getTotalDuration())}
                </div>
              </div>
            )}

            <Dialog.ButtonRow>
              <Button onClick={handleCancel} type="button">
                {t('Cancel')}
              </Button>
              <DialogButton type="submit" primary disabled={!previewRanges || previewRanges.length === 0}>
                {t('Import Segments')}
              </DialogButton>
            </Dialog.ButtonRow>
          </form>

          <Dialog.CloseButton />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default memo(TimeRangeImport);
export type { TimeRange };
