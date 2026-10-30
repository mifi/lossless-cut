import React from 'react';


export function withClass<P extends { className?: string | undefined }>(Component: React.ForwardRefExoticComponent<P>, cls: string) {
  return React.forwardRef<React.ForwardRefExoticComponent<P>, P>((props, ref) => {
    const { className, ...rest } = props ?? {};
    // @ts-expect-error dunno how to type this
    return <Component ref={ref} className={[cls, className].filter(Boolean).join(' ')} {...rest} />;
  });
}
