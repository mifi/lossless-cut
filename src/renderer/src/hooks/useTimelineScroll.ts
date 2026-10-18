import type { WheelEventHandler } from 'react';
import { useCallback, useEffect, useRef } from 'react';
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

// Chromium sends trackpad pinch as a wheel event with ctrlKey, even though ctrl is not held.
// So we track whether ctrl is actually held, using events that carry the real modifier state.
// undefined means unknown (e.g. before any event, or after the window lost focus while ctrl may still be held)
function useIsCtrlHeldRef() {
  const isCtrlHeldRef = useRef<boolean | undefined>(undefined);

  useEffect(() => {
    const onEvent = (e: KeyboardEvent | PointerEvent) => { isCtrlHeldRef.current = e.ctrlKey; };
    const onBlur = () => { isCtrlHeldRef.current = undefined; };
    window.addEventListener('keydown', onEvent, true);
    window.addEventListener('keyup', onEvent, true);
    window.addEventListener('pointermove', onEvent, true);
    window.addEventListener('pointerdown', onEvent, true);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onEvent, true);
      window.removeEventListener('keyup', onEvent, true);
      window.removeEventListener('pointermove', onEvent, true);
      window.removeEventListener('pointerdown', onEvent, true);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  return isCtrlHeldRef;
}

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
  const isCtrlHeldRef = useIsCtrlHeldRef();

  const onWheel = useCallback<WheelEventHandler<Element>>((wheelEvent) => {
    const { pixelX, pixelY } = normalizeWheel(wheelEvent);
    const { ctrlKey, shiftKey, altKey, metaKey } = wheelEvent;
    // if unknown, assume ctrl is really held (not a pinch)
    const isPinch = ctrlKey && isCtrlHeldRef.current === false;

    const action = getTimelineWheelAction({ pixelX, pixelY, modifiers: { ctrlKey, shiftKey, altKey, metaKey }, isPinch, wheelSensitivity, mouseWheelZoomModifierKey, mouseWheelFrameSeekModifierKey, mouseWheelKeyframeSeekModifierKey, invertTimelineScroll });

    switch (action.type) {
      case 'zoom': { zoomRel(action.amount); break; }
      case 'frameSeek': { shortStep(action.direction); break; }
      case 'keyframeSeek': { seekClosestKeyframe(action.direction); break; }
      case 'seek': { seekRel(action.amount); break; }
      default: { const exhaustive: never = action; throw new Error(`Unknown wheel action ${JSON.stringify(exhaustive)}`); }
    }
  }, [isCtrlHeldRef, invertTimelineScroll, mouseWheelZoomModifierKey, mouseWheelFrameSeekModifierKey, mouseWheelKeyframeSeekModifierKey, zoomRel, wheelSensitivity, shortStep, seekClosestKeyframe, seekRel]);

  return onWheel;
}

export default useTimelineScroll;
