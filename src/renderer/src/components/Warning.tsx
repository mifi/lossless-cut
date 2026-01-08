import type { DetailedHTMLProps, HTMLAttributes } from 'react';
import { useMemo } from 'react';
import { warningColor } from '../colors';


export default function Warning({ style, ...props }: DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>) {
  const mergedStyle = useMemo(() => ({ color: warningColor, ...style }), [style]);
  // eslint-disable-next-line react/jsx-props-no-spreading
  return <div style={mergedStyle} {...props} />;
}
