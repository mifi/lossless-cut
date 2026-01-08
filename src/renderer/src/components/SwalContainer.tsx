import type { HTMLAttributes } from 'react';
import { swalContainerWrapperId } from '../swal';

export default function SwalContainer({ darkMode, ...props }: HTMLAttributes<HTMLDivElement> & { darkMode: boolean }) {
  return (
    <div
      id={swalContainerWrapperId}
      className={darkMode ? 'dark-theme' : undefined}
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...props}
    />
  );
}
