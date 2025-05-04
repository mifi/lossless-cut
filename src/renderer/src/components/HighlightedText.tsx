import { CSSProperties, HTMLAttributes, memo } from 'react';

import { primaryTextColor } from '../colors';

export const highlightedTextStyle: CSSProperties = { textDecoration: 'underline', textUnderlineOffset: '.2em', textDecorationColor: primaryTextColor, color: 'var(--gray-12)', borderRadius: '.4em' };

function HighlightedText({ children, style, ...props }: HTMLAttributes<HTMLSpanElement>) {
  // eslint-disable-next-line react/jsx-props-no-spreading
  return <span {...props} style={{ ...highlightedTextStyle, ...style }}>{children}</span>;
}

export default memo(HighlightedText);
