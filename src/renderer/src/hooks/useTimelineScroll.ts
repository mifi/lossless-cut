import type { WheelEventHandler } from 'react';
import { useCallback } from 'react';
import { t } from 'i18next';

import normalizeWheel from './normalizeWheel';
import type { ModifierKey } from '../../../common/types';
import { getMetaKeyName } from '../util';
import { getTimelineWheelAction } from '../timelineWheel';

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
    const { ctrlKey, shiftKey, altKey, metaKey } = wheelEvent;

    const action = getTimelineWheelAction({ pixelX, pixelY, modifiers: { ctrlKey, shiftKey, altKey, metaKey }, wheelSensitivity, mouseWheelZoomModifierKey, mouseWheelFrameSeekModifierKey, mouseWheelKeyframeSeekModifierKey, invertTimelineScroll });

    switch (action.type) {
      case 'zoom': { zoomRel(action.amount); break; }
      case 'frameSeek': { shortStep(action.direction); break; }
      case 'keyframeSeek': { seekClosestKeyframe(action.direction); break; }
      case 'seek': { seekRel(action.amount); break; }
      default: { const exhaustive: never = action; throw new Error(`Unknown wheel action ${JSON.stringify(exhaustive)}`); }
    }
  }, [invertTimelineScroll, mouseWheelZoomModifierKey, mouseWheelFrameSeekModifierKey, mouseWheelKeyframeSeekModifierKey, zoomRel, wheelSensitivity, shortStep, seekClosestKeyframe, seekRel]);

  return onWheel;
}

export default useTimelineScroll;
