import type { CSSProperties, HTMLAttributes } from 'react';
import { memo } from 'react';

import { primaryTextColor } from '../colors';
import styles from './HighlightedText.module.css';

export const highlightedTextStyle: CSSProperties = { textDecorationColor: primaryTextColor };

function HighlightedText({ children, style, ...props }: HTMLAttributes<HTMLButtonElement>) {
  // eslint-disable-next-line react/jsx-props-no-spreading
  return <button type="button" {...props} className={styles['button']} style={{ ...highlightedTextStyle, ...style }}>{children}</button>;
}

export default memo(HighlightedText);
