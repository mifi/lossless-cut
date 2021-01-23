import React, { memo } from 'react';

// eslint-disable-next-line react/jsx-props-no-spreading
const HighlightedText = memo(({ children, style, ...props }) => <span {...props} style={{ background: 'rgb(193, 98, 0)', borderRadius: '.4em', padding: '0 .3em', ...style }}>{children}</span>);

export default HighlightedText;
