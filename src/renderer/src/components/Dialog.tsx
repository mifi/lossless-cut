import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';

import styles from './Dialog.module.css';
import { withClass } from './util';
import CloseButtonRaw from './CloseButton';
import { dialogButtonOrder } from '../util';

export * from '@radix-ui/react-dialog';

export const Overlay = withClass(Dialog.Overlay, styles['DialogOverlay']!);

export const Content = withClass(Dialog.Content, styles['DialogContent']!);

export const Description = withClass(Dialog.Description, styles['DialogDescription']!);

export const Title = withClass(Dialog.Title, styles['DialogTitle']!);

// eslint-disable-next-line react/jsx-props-no-spreading
export const Portal = (props: Dialog.DialogPortalProps) => <Dialog.Portal container={document.getElementById('app-root')!} {...props} />;

export const CloseButton = () => (
  <Dialog.Close asChild>
    <CloseButtonRaw style={{ top: 0, right: 0 }} />
  </Dialog.Close>
);

export function ButtonRow({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '.5em', justifyContent: dialogButtonOrder === 'rtl' ? 'flex-start' : 'flex-end', marginTop: '1em', direction: dialogButtonOrder }}>
      {children}
    </div>
  );
}
