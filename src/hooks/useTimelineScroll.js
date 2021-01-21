import { useCallback } from 'react';

import normalizeWheel from './normalizeWheel';

function useTimelineScroll({ wheelSensitivity, invertTimelineScroll, zoomRel, seekRel }) {
  const onWheel = useCallback((e) => {
    const { pixelX, pixelY } = normalizeWheel(e);
    // console.log({ spinX, spinY, pixelX, pixelY });

    const direction = invertTimelineScroll ? 1 : -1;

    if (e.ctrlKey) {
      zoomRel(direction * (pixelY) * wheelSensitivity * 0.4);
    } else {
      seekRel(direction * (pixelX + pixelY) * wheelSensitivity * 0.2);
    }
  }, [seekRel, zoomRel, wheelSensitivity, invertTimelineScroll]);

  return onWheel;
}

export default useTimelineScroll;
