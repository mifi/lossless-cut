import type { FormEventHandler, MouseEventHandler, ReactNode } from 'react';
import React, { useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import invariant from 'tiny-invariant';
import { FaCheckCircle, FaInfoCircle } from 'react-icons/fa';
import { TextField } from '@radix-ui/themes';

import * as Dialog from './Dialog';
import * as AlertDialog from './AlertDialog';
import { DialogButton } from './Button';
import { showItemInFolder } from '../util';
import type { CleanupChoice, CleanupChoicesType } from '../dialogs';
import { ListItem, Notices, OutputIncorrectSeeHelpMenu, UnorderedList, Warnings } from '../dialogs';
import Checkbox from './Checkbox';
import { saveColor, warningColor } from '../colors';


export interface GenericDialogParams {
  isAlert?: boolean;
  render: () => React.ReactNode;
  onClose?: () => void;
}

export type ShowGenericDialog = (dialog: GenericDialogParams) => void;

interface GenericDialogContextValue {
  onOpenChange: (open: boolean) => void,
}

const GenericDialogContext = React.createContext<GenericDialogContextValue | undefined>(undefined);

export function useGenericDialogContext() {
  const context = useContext(GenericDialogContext);
  invariant(context);
  return context;
}

export default function GenericDialog({ dialog, onOpenChange }: {
  dialog: GenericDialogParams | undefined,
  onOpenChange: (open: boolean) => void,
}) {
  const context = useMemo(() => ({ onOpenChange }), [onOpenChange]);

  return (
    <>
      {/* Non-alert dialog */ }
      <Dialog.Root open={dialog != null && !dialog.isAlert} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay />

          <GenericDialogContext.Provider value={context}>
            {dialog != null && !dialog.isAlert && dialog.render()}
          </GenericDialogContext.Provider>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Alert dialog */ }
      <AlertDialog.Root open={dialog != null && !!dialog.isAlert} onOpenChange={onOpenChange}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay />

          <GenericDialogContext.Provider value={context}>
            {dialog != null && dialog.isAlert && dialog.render()}
          </GenericDialogContext.Provider>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}

export function useDialog() {
  const { t } = useTranslation();
  const [genericDialog, setGenericDialog] = useState<GenericDialogParams | undefined>();
  const genericDialogRef = useRef(genericDialog);

  const showGenericDialog = useCallback<ShowGenericDialog>((dialog) => {
    if (genericDialogRef.current) {
      throw new Error('A dialog is already open, cannot open another one');
    }
    genericDialogRef.current = dialog;
    setGenericDialog(dialog);
  }, []);

  const closeGenericDialog = useCallback(() => {
    genericDialogRef.current?.onClose?.();
    genericDialogRef.current = undefined;
    setGenericDialog(undefined);
  }, []);

  const confirmDialog = useCallback(({ title = t('Please confirm'), description, confirmButtonText = t('Confirm'), cancelButtonText = t('Cancel'), focusConfirm = false }: {
    title?: ReactNode,
    description?: string,
    confirmButtonText?: string,
    cancelButtonText?: string,
    focusConfirm?: boolean,
  }) => new Promise<boolean>((resolve) => {
    function ConfirmDialog() {
      const { onOpenChange } = useGenericDialogContext();
      const confirmRef = useRef<HTMLButtonElement>(null);

      const handleConfirmClick = useCallback<MouseEventHandler<HTMLButtonElement>>((e) => {
        e.preventDefault();
        resolve(true);
        onOpenChange(false);
      }, [onOpenChange]);

      const handleOpenAutoFocus = useCallback((e: Event) => {
        if (focusConfirm && confirmRef.current) {
          e.preventDefault();
          confirmRef.current.focus();
        }
      }, []);

      return (
        <AlertDialog.Content aria-describedby={description} style={{ width: '40vw' }} onOpenAutoFocus={handleOpenAutoFocus}>
          <AlertDialog.Title>{title}</AlertDialog.Title>

          {description && <AlertDialog.Description>{description}</AlertDialog.Description>}

          <Dialog.ButtonRow>
            <AlertDialog.Cancel asChild>
              <DialogButton>{cancelButtonText}</DialogButton>
            </AlertDialog.Cancel>

            <DialogButton primary onClick={handleConfirmClick} ref={confirmRef}>{confirmButtonText}</DialogButton>
          </Dialog.ButtonRow>
        </AlertDialog.Content>
      );
    }

    showGenericDialog({
      isAlert: true,
      render: () => <ConfirmDialog />,
      onClose: () => resolve(false),
    });
  }), [showGenericDialog, t]);

  const openExportFinishedDialog = useCallback(async ({ filePath, children, width }: {
    filePath: string,
    children: ReactNode,
    width?: string,
  }) => {
    const response = await new Promise<boolean>((resolve) => {
      function ExportFinishedDialog() {
        const { onOpenChange } = useGenericDialogContext();

        const handleConfirmClick = useCallback<MouseEventHandler<HTMLButtonElement>>((e) => {
          e.preventDefault();
          resolve(true);
          onOpenChange(false);
        }, [onOpenChange]);

        return (
          <Dialog.Content aria-describedby={undefined} style={{ width }}>
            <Dialog.Title>{t('Success!')}</Dialog.Title>

            {children}

            <Dialog.ButtonRow>
              <Dialog.Close asChild>
                <DialogButton>{t('Close')}</DialogButton>
              </Dialog.Close>

              <DialogButton primary onClick={handleConfirmClick}>{t('Show')}</DialogButton>
            </Dialog.ButtonRow>
          </Dialog.Content>
        );
      }

      showGenericDialog({
        render: () => <ExportFinishedDialog />,
        onClose: () => resolve(false),
      });
    });

    if (response) {
      showItemInFolder(filePath);
    }
  }, [showGenericDialog, t]);

  const openCutFinishedDialog = useCallback(async ({ filePath, warnings, notices }: { filePath: string, warnings: string[], notices: string[] }) => {
    const hasWarnings = warnings.length > 0;

    // https://github.com/mifi/lossless-cut/issues/2048
    await openExportFinishedDialog({
      filePath,
      width: '60em',
      children: (
        <UnorderedList>
          <ListItem icon={<FaCheckCircle />} iconColor={hasWarnings ? warningColor : saveColor} style={{ fontWeight: 'bold' }}>{hasWarnings ? t('Export finished with warning(s)', { count: warnings.length }) : t('Export is done!')}</ListItem>
          <Warnings warnings={warnings} />
          <ListItem icon={<FaInfoCircle />}>{t('Please test the output file in your desired player/editor before you delete the source file.')}</ListItem>
          <OutputIncorrectSeeHelpMenu />
          <Notices notices={notices} />
        </UnorderedList>
      ),
    });
  }, [openExportFinishedDialog, t]);

  const openConcatFinishedDialog = useCallback(async ({ filePath, warnings, notices }: { filePath: string, warnings: string[], notices: string[] }) => {
    const hasWarnings = warnings.length > 0;

    await openExportFinishedDialog({
      filePath,
      width: '60em',
      children: (
        <UnorderedList>
          <ListItem icon={<FaCheckCircle />} iconColor={hasWarnings ? 'warning' : 'success'} style={{ fontWeight: 'bold' }}>{hasWarnings ? t('Files merged with warning(s)', { count: warnings.length }) : t('Files merged!')}</ListItem>
          <Warnings warnings={warnings} />
          <ListItem icon={<FaInfoCircle />}>{t('Please test the output files in your desired player/editor before you delete the source files.')}</ListItem>
          <OutputIncorrectSeeHelpMenu />
          <Notices notices={notices} />
        </UnorderedList>
      ),
    });
  }, [openExportFinishedDialog, t]);

  async function openCleanupFilesDialog(cleanupChoicesInitial: CleanupChoicesType) {
    return new Promise<CleanupChoicesType | undefined>((resolve) => {
      function CleanupChoices() {
        const [choices, setChoices] = useState(cleanupChoicesInitial);

        const getVal = (key: CleanupChoice) => !!choices[key];

        const onChange = (key: CleanupChoice, val: boolean | string) => setChoices((oldChoices) => {
          const newChoices = { ...oldChoices, [key]: Boolean(val) };
          if ((newChoices.trashSourceFile || newChoices.trashTmpFiles) && !newChoices.closeFile) {
            newChoices.closeFile = true;
          }
          return newChoices;
        });

        const trashTmpFiles = getVal('trashTmpFiles');
        const trashSourceFile = getVal('trashSourceFile');
        const trashProjectFile = getVal('trashProjectFile');
        const deleteIfTrashFails = getVal('deleteIfTrashFails');
        const closeFile = getVal('closeFile');
        const askForCleanup = getVal('askForCleanup');
        const cleanupAfterExport = getVal('cleanupAfterExport');

        const { onOpenChange } = useGenericDialogContext();

        const handleOkClick = useCallback(() => {
          resolve(choices);
          onOpenChange(false);
        }, [choices, onOpenChange]);

        // for convenience, focus confirm button when opening dialog
        // they probably just want to use current options
        // https://github.com/mifi/lossless-cut/issues/2622
        const confirmRef = useRef<HTMLButtonElement>(null);

        const handleOpenAutoFocus = useCallback((e: Event) => {
          if (confirmRef.current) {
            e.preventDefault();
            confirmRef.current.focus();
          }
        }, []);

        return (
          <Dialog.Content aria-describedby={undefined} style={{ width: '80vw' }} onOpenAutoFocus={handleOpenAutoFocus}>
            <Dialog.Title>
              {t('Cleanup files?')}
            </Dialog.Title>

            <Dialog.Description>
              {t('What do you want to do after exporting a file or when pressing the "delete source file" button?')}
            </Dialog.Description>

            <Checkbox label={t('Close currently opened file')} checked={closeFile} disabled={trashSourceFile || trashTmpFiles} onCheckedChange={(checked) => onChange('closeFile', checked)} />

            <div style={{ marginBottom: '2em' }}>
              <Checkbox label={t('Trash auto-generated files')} checked={trashTmpFiles} onCheckedChange={(checked) => onChange('trashTmpFiles', checked)} />
              <Checkbox label={t('Trash original source file')} checked={trashSourceFile} onCheckedChange={(checked) => onChange('trashSourceFile', checked)} />
              <Checkbox label={t('Trash project LLC file')} checked={trashProjectFile} onCheckedChange={(checked) => onChange('trashProjectFile', checked)} />
              <Checkbox label={t('Permanently delete the files if trash fails?')} disabled={!(trashTmpFiles || trashProjectFile || trashSourceFile)} checked={deleteIfTrashFails} onCheckedChange={(checked) => onChange('deleteIfTrashFails', checked)} />
            </div>

            <div style={{ marginBottom: '2em' }}>
              <Checkbox label={t('Show this dialog every time?')} checked={askForCleanup} onCheckedChange={(checked) => onChange('askForCleanup', checked)} />
              <Checkbox label={t('Do all of this automatically after exporting a file?')} checked={cleanupAfterExport} onCheckedChange={(checked) => onChange('cleanupAfterExport', checked)} />
            </div>

            <Dialog.ButtonRow>
              <Dialog.Close asChild>
                <DialogButton>{t('Cancel')}</DialogButton>
              </Dialog.Close>

              <DialogButton ref={confirmRef} onClick={handleOkClick} primary>{t('Confirm')}</DialogButton>
            </Dialog.ButtonRow>
          </Dialog.Content>
        );
      }

      showGenericDialog({
        render: () => <CleanupChoices />,
        onClose: () => resolve(undefined),
      });
    });
  }

  const openShiftSegmentsDialog = useCallback(({ inputPlaceholder, parseTimecode }: {
    inputPlaceholder: string,
    parseTimecode: (s: string) => number | undefined,
  }) => new Promise<{ startShift?: number, endShift?: number } | undefined>((resolve) => {
    function ShiftDialog() {
      const { onOpenChange } = useGenericDialogContext();
      const [startValue, setStartValue] = useState('');
      const [endValue, setEndValue] = useState('');

      const parseValue = useCallback((value: string) => {
        let parseableValue = value.trim();
        if (!parseableValue) return undefined;
        let sign = 1;
        if (parseableValue[0] === '-') {
          sign = -1;
          parseableValue = parseableValue.slice(1);
        }

        const duration = parseTimecode(parseableValue);
        invariant(duration != null);
        if (duration === 0) return undefined;
        return duration * sign;
      }, []);

      const handleSubmit = useCallback<FormEventHandler<HTMLFormElement>>((e) => {
        e.preventDefault();
        try {
          const start = parseValue(startValue);
          const end = parseValue(endValue);
          // require at least one of them to be set
          invariant(start != null || end != null);
          const out: { startShift?: number, endShift?: number } = {};
          if (start != null) out.startShift = start;
          if (end != null) out.endShift = end;
          resolve(out);
          onOpenChange(false);
        } catch (err) {
          console.warn(err);
        }
      }, [parseValue, startValue, endValue, onOpenChange]);

      return (
        <Dialog.Content aria-describedby={undefined} style={{ width: '50vw' }}>
          <Dialog.Title>{t('Shift segments')}</Dialog.Title>

          <Dialog.Description>{t('Shift all segments on the timeline by this amount. Negative values will be shifted back, while positive value will be shifted forward in time.')}</Dialog.Description>

          <form onSubmit={handleSubmit}>
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label style={{ display: 'block', marginBottom: '.3em' }}>
              {t('Shift start by')}<br />
              <TextField.Root value={startValue} placeholder={inputPlaceholder} onChange={(e) => setStartValue(e.target.value)} />
            </label>
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label style={{ display: 'block', marginBottom: '.3em' }}>
              {t('Shift end by')}<br />
              <TextField.Root value={endValue} placeholder={inputPlaceholder} onChange={(e) => setEndValue(e.target.value)} />
            </label>

            <Dialog.ButtonRow>
              <Dialog.Close asChild>
                <DialogButton>{t('Cancel')}</DialogButton>
              </Dialog.Close>

              <DialogButton type="submit" primary>{t('Confirm')}</DialogButton>
            </Dialog.ButtonRow>
          </form>
        </Dialog.Content>
      );
    }

    showGenericDialog({
      render: () => <ShiftDialog />,
      onClose: () => resolve(undefined),
    });
  }), [showGenericDialog, t]);

  const openDecimateDialog = useCallback(() => new Promise<{ n: number, fps: number } | undefined>((resolve) => {
    function DecimateDialog() {
      const { onOpenChange } = useGenericDialogContext();
      const [fpsStr, setFps] = useState('20');
      const [nStr, setN] = useState('1');

      const handleSubmit = useCallback<FormEventHandler<HTMLFormElement>>((e) => {
        e.preventDefault();
        try {
          const n = Number(nStr);
          const fps = Number(fpsStr);
          invariant(!Number.isNaN(n) && n > 0);
          invariant(!Number.isNaN(fps) && fps > 0);
          resolve({ n, fps });
          onOpenChange(false);
        } catch (err) {
          console.warn(err);
        }
      }, [fpsStr, nStr, onOpenChange]);

      return (
        <Dialog.Content aria-describedby={undefined} style={{ width: '50vw' }}>
          <Dialog.Title>{t('Decimate video')}</Dialog.Title>

          <Dialog.Description>{t('Decimate allows you to losslessly extract only the keyframes from a video, discarding all non-keyframes. You can also optionally drop some of the keyframes. This can dramatically speed up playback and is useful for shortening long videos with little motion, such as creating time-lapse videos.')}</Dialog.Description>

          <form onSubmit={handleSubmit}>
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label style={{ display: 'block', marginBottom: '.5em' }}>
              {t('Keep every nth keyframe. Use the value "1" to keep all keyframes')}<br />
              <TextField.Root value={nStr} placeholder="n" onChange={(e) => setN(e.target.value)} />
            </label>
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label style={{ display: 'block', marginBottom: '.5em' }}>
              {t('Output video frame rate (frames per second)')}<br />
              <TextField.Root value={fpsStr} onChange={(e) => setFps(e.target.value)} />
            </label>

            <Dialog.ButtonRow>
              <Dialog.Close asChild>
                <DialogButton>{t('Cancel')}</DialogButton>
              </Dialog.Close>

              <DialogButton type="submit" primary>{t('Confirm')}</DialogButton>
            </Dialog.ButtonRow>
          </form>
        </Dialog.Content>
      );
    }

    showGenericDialog({
      render: () => <DecimateDialog />,
      onClose: () => resolve(undefined),
    });
  }), [showGenericDialog, t]);

  return {
    genericDialog,
    closeGenericDialog,
    showGenericDialog,
    confirmDialog,
    openExportFinishedDialog,
    openCutFinishedDialog,
    openConcatFinishedDialog,
    openCleanupFilesDialog,
    openShiftSegmentsDialog,
    openDecimateDialog,
  };
}

export type ConfirmDialog = ReturnType<typeof useDialog>['confirmDialog'];
