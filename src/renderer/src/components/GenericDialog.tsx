import React, { MouseEventHandler, ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import invariant from 'tiny-invariant';
import { FaCheckCircle, FaInfoCircle } from 'react-icons/fa';

import * as Dialog from './Dialog';
import * as AlertDialog from './AlertDialog';
import { DialogButton } from './Button';
import { showItemInFolder } from '../util';
import { CleanupChoice, CleanupChoicesType, ListItem, Notices, OutputIncorrectSeeHelpMenu, UnorderedList, Warnings } from '../dialogs';
import Checkbox from './Checkbox';
import { saveColor, warningColor } from '../colors';


export interface GenericDialogParams {
  isAlert?: boolean;
  content: React.ReactNode;
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

  if (dialog == null) {
    return null;
  }

  if (dialog.isAlert) {
    return (
      <AlertDialog.Root open={dialog != null} onOpenChange={onOpenChange}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay />

          <GenericDialogContext.Provider value={context}>
            {dialog.content}
          </GenericDialogContext.Provider>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    );
  }

  return (
    <Dialog.Root open={dialog != null} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />

        <GenericDialogContext.Provider value={context}>
          {dialog?.content}
        </GenericDialogContext.Provider>
      </Dialog.Portal>
    </Dialog.Root>
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

  const confirmDialog = useCallback(({ title = t('Please confirm'), description, confirmButtonText = t('Confirm'), cancelButtonText = t('Cancel') }: {
    title?: ReactNode,
    description?: string,
    confirmButtonText?: string,
    cancelButtonText?: string,
  }) => new Promise<boolean>((resolve) => {
    function ConfirmDialog() {
      const { onOpenChange } = useGenericDialogContext();

      const handleConfirmClick = useCallback<MouseEventHandler<HTMLButtonElement>>((e) => {
        e.preventDefault();
        resolve(true);
        onOpenChange(false);
      }, [onOpenChange]);

      return (
        <AlertDialog.Content aria-describedby={description} style={{ width: '40vw' }}>
          <AlertDialog.Title>{title}</AlertDialog.Title>

          {description && <AlertDialog.Description>{description}</AlertDialog.Description>}

          <Dialog.ButtonRow>
            <AlertDialog.Cancel asChild>
              <DialogButton>{cancelButtonText}</DialogButton>
            </AlertDialog.Cancel>

            <DialogButton primary onClick={handleConfirmClick}>{confirmButtonText}</DialogButton>
          </Dialog.ButtonRow>
        </AlertDialog.Content>
      );
    }

    showGenericDialog({
      isAlert: true,
      content: <ConfirmDialog />,
      onClose: () => resolve(false),
    });
  }), [showGenericDialog, t]);

  const openExportFinishedDialog = useCallback(async ({ filePath, children, width = '30em' }: { filePath: string, children: ReactNode, width?: string }) => {
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
        content: <ExportFinishedDialog />,
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

        return (
          <AlertDialog.Content aria-describedby={undefined} style={{ width: '80vw' }}>
            <AlertDialog.Title>
              {t('Cleanup files?')}
            </AlertDialog.Title>

            <AlertDialog.Description>
              {t('What do you want to do after exporting a file or when pressing the "delete source file" button?')}
            </AlertDialog.Description>

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
              <AlertDialog.Cancel asChild>
                <DialogButton>{t('Cancel')}</DialogButton>
              </AlertDialog.Cancel>

              <DialogButton onClick={handleOkClick} primary>{t('Confirm')}</DialogButton>
            </Dialog.ButtonRow>
          </AlertDialog.Content>
        );
      }

      showGenericDialog({
        isAlert: true,
        content: <CleanupChoices />,
        onClose: () => resolve(undefined),
      });
    });
  }

  return {
    genericDialog,
    closeGenericDialog,
    showGenericDialog,
    confirmDialog,
    openExportFinishedDialog,
    openCutFinishedDialog,
    openConcatFinishedDialog,
    openCleanupFilesDialog,
  };
}
