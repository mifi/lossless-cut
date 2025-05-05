import { DetailedHTMLProps, HTMLAttributes, useMemo } from 'react';


export default function Warning({ style, ...props }: DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>) {
  const mergedStyle = useMemo(() => ({ color: 'var(--orange-8)', ...style }), [style]);
  // eslint-disable-next-line react/jsx-props-no-spreading
  return <div style={mergedStyle} {...props} />;
}
