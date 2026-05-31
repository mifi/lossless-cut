import type { CSSProperties, HTMLAttributes } from 'react';
import { memo, forwardRef } from 'react';

import { primaryTextColor } from '../colors';
import styles from './HighlightedText.module.css';

export const highlightedTextStyle: CSSProperties = { textDecorationColor: primaryTextColor };

// eslint-disable-next-line react/display-name
const HighlightedText = forwardRef<HTMLButtonElement, HTMLAttributes<HTMLButtonElement>>(({ children, style, ...props }, ref) => (
  // eslint-disable-next-line react/jsx-props-no-spreading
  <button ref={ref} type="button" {...props} className={styles['button']} style={{ ...highlightedTextStyle, ...style }}>{children}</button>
));

export default memo(HighlightedText);
