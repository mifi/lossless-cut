import React from 'react';


// eslint-disable-next-line import/prefer-default-export
export function withClass<P extends { className?: string | undefined }>(Component: React.ForwardRefExoticComponent<P>, cls: string) {
  // eslint-disable-next-line react/display-name,@typescript-eslint/no-explicit-any
  return React.forwardRef<React.ForwardRefExoticComponent<P>, P>((props, ref) => {
    const { className, ...rest } = props ?? {};
    // @ts-expect-error dunno how to type this
    // eslint-disable-next-line react/jsx-props-no-spreading
    return <Component ref={ref} className={[cls, className].filter(Boolean).join(' ')} {...rest} />;
  });
}
