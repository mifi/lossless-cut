import type { CSSProperties } from 'react';
import { forwardRef } from 'react';


const inputStyle: CSSProperties = { borderRadius: '.4em', flexGrow: 1, fontFamily: 'inherit', fontSize: '.8em', backgroundColor: 'var(--gray-3)', color: 'var(--gray-12)', border: '1px solid var(--gray-7)', appearance: 'none' };

// eslint-disable-next-line react/display-name
const TextInput = forwardRef<HTMLInputElement, JSX.IntrinsicElements['input']>(({ style, ...props }, forwardedRef) => (
  // eslint-disable-next-line react/jsx-props-no-spreading
  <input type="text" ref={forwardedRef} style={{ ...inputStyle, ...style }} {...props} />
));

export default TextInput;
