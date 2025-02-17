import React from 'react';

// https://stackoverflow.com/questions/64997362/how-do-i-see-what-props-have-changed-in-react
export default function useWhatChanged(props: Record<string, unknown>) {
  // cache the last set of props
  const prev = React.useRef(props);

  React.useEffect(() => {
    // check each prop to see if it has changed
    const changed = Object.entries(props).reduce((a, [key, prop]) => {
      if (prev.current[key] === prop) return a;
      return {
        ...a,
        [key]: {
          prev: prev.current[key],
          next: prop,
        },
      };
    }, {});

    if (Object.keys(changed).length > 0) {
      console.group('Props That Changed');
      console.log(changed);
      console.groupEnd();
    }

    prev.current = props;
  }, [props]);
}
