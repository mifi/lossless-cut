import { useCallback } from 'react';
import { t } from 'i18next';

import normalizeWheel from './normalizeWheel';

export const keyMap = {
  ctrl: 'ctrlKey',
  shift: 'shiftKey',
  alt: 'altKey',
  meta: 'metaKey',
};

export const getModifierKeyNames = () => ({
  ctrl: [t('Ctrl')],
  shift: [t('Shift')],
  alt: [t('Alt')],
  meta: [t('⌘ Cmd'), t('⊞ Win')],
});

export const getModifier = (key) => getModifierKeyNames()[key];

function useTimelineScroll({ wheelSensitivity, mouseWheelZoomModifierKey, invertTimelineScroll, zoomRel, seekRel }) {
  const onWheel = useCallback((e) => {
    const { pixelX, pixelY } = normalizeWheel(e);
    // console.log({ spinX, spinY, pixelX, pixelY });

    const direction = invertTimelineScroll ? 1 : -1;

    const modifierKey = keyMap[mouseWheelZoomModifierKey];
    if (e[modifierKey]) {
      zoomRel(direction * (pixelY) * wheelSensitivity * 0.4);
    } else {
      seekRel(direction * (pixelX + pixelY) * wheelSensitivity * 0.2);
    }
  }, [invertTimelineScroll, mouseWheelZoomModifierKey, zoomRel, wheelSensitivity, seekRel]);

  return onWheel;
}

export default useTimelineScroll;
