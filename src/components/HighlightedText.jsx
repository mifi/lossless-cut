import { memo } from 'react';

import { primaryTextColor } from '../colors';

export const highlightedTextStyle = { textDecoration: 'underline', textUnderlineOffset: '.2em', textDecorationColor: primaryTextColor, color: 'var(--gray12)', borderRadius: '.4em' };

// eslint-disable-next-line react/jsx-props-no-spreading
const HighlightedText = memo(({ children, style, ...props }) => <span {...props} style={{ ...highlightedTextStyle, ...style }}>{children}</span>);

export default HighlightedText;
