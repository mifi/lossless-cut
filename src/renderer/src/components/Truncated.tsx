import type { CSSProperties, DetailedHTMLProps, HTMLAttributes } from 'react';

export default function Truncated({ maxWidth, style, ...props }: DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & { maxWidth: CSSProperties['maxWidth'] }) {
  return (
    <div
      title={props.title ?? (typeof props.children === 'string' ? props.children : undefined)}
      style={{
        maxWidth,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        ...style,
      }}
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...props}
    />
  );
}
