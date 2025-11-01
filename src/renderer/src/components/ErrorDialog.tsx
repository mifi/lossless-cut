import { useTranslation } from 'react-i18next';

import * as Dialog from './Dialog';
import { DialogButton } from './Button';


export interface GenericError {
  err?: unknown | undefined;
  title?: string | undefined;
}

/**
 * We need to be able to show errors from anywhere in the app, also while dialogs are open. Also originating from keyboard actions
 */
export default function ErrorDialog({ error, onOpenChange }: {
  error: GenericError | undefined,
  onOpenChange: (open: boolean) => void,
}) {
  const { t } = useTranslation();

  return (
    <Dialog.Root open={error != null} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content aria-describedby={t('An error has occurred.')} style={{ width: '40em' }}>
          {error != null && (
            <>
              <Dialog.Title>
                {error.title ?? t('Error')}
              </Dialog.Title>

              <div style={{ overflow: 'auto', maxHeight: '50vh', whiteSpace: 'pre-wrap' }}>
                {error.err instanceof Error ? error.err.message : String(error.err)}
              </div>
            </>
          )}

          <Dialog.ButtonRow>
            <DialogButton primary>{t('OK')}</DialogButton>
          </Dialog.ButtonRow>

          <Dialog.CloseButton />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
