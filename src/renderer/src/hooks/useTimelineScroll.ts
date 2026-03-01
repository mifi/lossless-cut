import type { WheelEventHandler } from 'react';
import { useCallback } from 'react';
import { t } from 'i18next';

import normalizeWheel from './normalizeWheel';
import type { ModifierKey } from '../../../common/types';
import { getMetaKeyName } from '../util';

export const keyMap = {
  ctrl: 'ctrlKey',
  shift: 'shiftKey',
  alt: 'altKey',
  meta: 'metaKey',
} as const;

export const getModifierKeyNames = () => ({
  ctrl: t('Ctrl'),
  shift: t('Shift'),
  alt: t('Alt'),
  meta: getMetaKeyName(),
});

export const getModifier = (key: ModifierKey) => getModifierKeyNames()[key];

function useTimelineScroll({ wheelSensitivity, mouseWheelZoomModifierKey, mouseWheelFrameSeekModifierKey, mouseWheelKeyframeSeekModifierKey, invertTimelineScroll, zoomRel, seekRel, shortStep, seekClosestKeyframe }: {
  wheelSensitivity: number,
  mouseWheelZoomModifierKey: ModifierKey,
  mouseWheelFrameSeekModifierKey: ModifierKey,
  mouseWheelKeyframeSeekModifierKey: ModifierKey,
  invertTimelineScroll?: boolean | undefined,
  zoomRel: (a: number) => void,
  seekRel: (a: number) => void,
  shortStep: (a: number) => void,
  seekClosestKeyframe: (a: number) => void,
}) {
  const onWheel = useCallback<WheelEventHandler<Element>>((wheelEvent) => {
    const { pixelX, pixelY } = normalizeWheel(wheelEvent);
    // console.log({ spinX, spinY, pixelX, pixelY });

    const direction = invertTimelineScroll ? 1 : -1;

    const makeUnit = (v: number) => ((direction * v) > 0 ? 1 : -1);

    if (wheelEvent[keyMap[mouseWheelZoomModifierKey]]) {
      // see discussion https://github.com/mifi/lossless-cut/issues/2703
      zoomRel(pixelY * wheelSensitivity * 0.4);
    } else if (wheelEvent[keyMap[mouseWheelFrameSeekModifierKey]]) {
      shortStep(makeUnit(pixelX + pixelY));
    } else if (wheelEvent[keyMap[mouseWheelKeyframeSeekModifierKey]]) {
      seekClosestKeyframe(makeUnit(pixelX + pixelY));
    } else {
      seekRel(direction * (pixelX + pixelY) * wheelSensitivity * 0.2);
    }
  }, [invertTimelineScroll, mouseWheelZoomModifierKey, mouseWheelFrameSeekModifierKey, mouseWheelKeyframeSeekModifierKey, zoomRel, wheelSensitivity, shortStep, seekClosestKeyframe, seekRel]);

  return onWheel;
}

export default useTimelineScroll;
