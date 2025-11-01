import React, { MouseEventHandler, ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import invariant from 'tiny-invariant';

import * as Dialog from './Dialog';
import * as AlertDialog from './AlertDialog';
import { DialogButton } from './Button';


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

        {dialog?.content}
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

  return {
    genericDialog,
    closeGenericDialog,
    showGenericDialog,
    confirmDialog,
  };
}
