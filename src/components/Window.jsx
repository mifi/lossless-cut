import { memo, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

// todo https://github.com/JakeGinnivan/react-popout/blob/master/lib/react-popout.jsx

// https://github.com/mifi/lossless-cut/issues/726
const Window = memo(({ children, features, onClose }) => {
  const windowRef = useRef();
  const [windowOpen, setWindowOpen] = useState(false);

  useEffect(() => {
    windowRef.current = window.open(undefined, undefined, features);
    setWindowOpen(true);

    return () => {
      windowRef.current.close();
    };
  }, [features]);

  useEffect(() => {
    windowRef.current.addEventListener('unload', onClose);
    return () => windowRef.current.removeEventListener('unload', onClose);
  }, [onClose]);

  if (!windowOpen) return null;

  return ReactDOM.createPortal(children, windowRef.current.document.body);
});

export default Window;
