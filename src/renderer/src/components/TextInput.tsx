import { forwardRef, type CSSProperties, type InputHTMLAttributes } from 'react';

import styles from './TextInput.module.css';


type Props = InputHTMLAttributes<HTMLInputElement> & { style?: CSSProperties };

// eslint-disable-next-line react/display-name
const TextInput = forwardRef<HTMLInputElement, Props>(({ className, ...props }, forwardedRef) => (
  // eslint-disable-next-line react/jsx-props-no-spreading
  <input type="text" ref={forwardedRef} className={[styles['input'], ...(className ? [className] : [])].join(' ')} {...props} />
));

export default TextInput;
