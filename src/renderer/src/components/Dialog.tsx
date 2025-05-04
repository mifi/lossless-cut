import { FaTimes } from 'react-icons/fa';
import { DetailedHTMLProps, DialogHTMLAttributes, useCallback, useEffect, forwardRef } from 'react';

import styles from './Dialog.module.css';
import Button, { ButtonProps } from './Button';
import i18n from '../i18n';


type Props = Omit<DetailedHTMLProps<DialogHTMLAttributes<HTMLDialogElement>, HTMLDialogElement>, 'open'> & {
  autoOpen?: boolean | undefined,
};

// eslint-disable-next-line react/display-name
const Dialog = forwardRef<HTMLDialogElement, Props>(({ children, autoOpen, onClose, onClick, ...props }, ref) => {
  useEffect(() => {
    // eslint-disable-next-line react/destructuring-assignment
    if (autoOpen) (ref as React.RefObject<HTMLDialogElement>).current?.showModal();
    // eslint-disable-next-line react/destructuring-assignment
    else (ref as React.RefObject<HTMLDialogElement>).current?.close();
  }, [autoOpen, ref]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDialogElement>) => {
    if (!(ref != null && 'current' in ref && ref.current != null)) return;
    const dialogDimensions = ref.current.getBoundingClientRect();
    if (e.clientX < dialogDimensions.left
      || e.clientX > dialogDimensions.right
      || e.clientY < dialogDimensions.top
      || e.clientY > dialogDimensions.bottom) {
      onClose?.(e);
    }
    onClick?.(e);
  }, [onClick, onClose, ref]);

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, react/jsx-props-no-spreading
    <dialog {...props} ref={ref} onClose={onClose} onClick={handleClick}>
      {children}

      <form method="dialog">
        <Button type="submit" className={styles['close']} aria-label={i18n.t('Close')}>
          <FaTimes />
        </Button>
      </form>
    </dialog>
  );
});

export const ConfirmButton = ({ style, ...props }: ButtonProps) => (
  // eslint-disable-next-line react/jsx-props-no-spreading
  <Button style={{ fontSize: '1.2em', ...style }} {...props} />
);


export default Dialog;
