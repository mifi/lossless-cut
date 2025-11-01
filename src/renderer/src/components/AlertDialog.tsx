import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useTranslation } from 'react-i18next';

import styles from './AlertDialog.module.css';
import { withClass } from './util';
import { DialogButton } from './Button';

export * from '@radix-ui/react-alert-dialog';

export const Overlay = withClass(AlertDialog.Overlay, styles['AlertDialogOverlay']!);

export const Content = withClass(AlertDialog.Content, styles['AlertDialogContent']!);

export const Title = withClass(AlertDialog.Title, styles['AlertDialogTitle']!);

export const Description = withClass(AlertDialog.Description, styles['AlertDialogDescription']!);

// eslint-disable-next-line react/jsx-props-no-spreading
export const Portal = (props: AlertDialog.AlertDialogPortalProps) => <AlertDialog.Portal container={document.getElementById('app-root')!} {...props} />;

export function CancelButton() {
  const { t } = useTranslation();
  return (
    <AlertDialog.Cancel asChild>
      <DialogButton>{t('Cancel')}</DialogButton>
    </AlertDialog.Cancel>
  );
}

export function OkButton() {
  const { t } = useTranslation();
  return (
    <AlertDialog.Action asChild>
      <DialogButton primary>{t('OK')}</DialogButton>
    </AlertDialog.Action>
  );
}
