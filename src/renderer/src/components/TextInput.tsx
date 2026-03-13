import type { CSSProperties } from 'react';
import { forwardRef } from 'react';


const inputStyle: CSSProperties = {
  minHeight: '2.5rem',
  borderRadius: '0.9rem',
  flexGrow: 1,
  fontFamily: 'inherit',
  fontSize: '0.92rem',
  padding: '0 0.8rem',
  background: 'linear-gradient(180deg, var(--player-button-top), var(--player-button-bottom))',
  color: 'var(--player-text-primary)',
  border: '1px solid var(--player-border-subtle)',
  boxShadow: 'var(--player-shadow-button)',
  appearance: 'none',
};

// eslint-disable-next-line react/display-name
const TextInput = forwardRef<HTMLInputElement, JSX.IntrinsicElements['input']>(({ style, ...props }, forwardedRef) => (
  // eslint-disable-next-line react/jsx-props-no-spreading
  <input type="text" ref={forwardedRef} style={{ ...inputStyle, ...style }} {...props} />
));

export default TextInput;
