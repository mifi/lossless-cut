import type { ModifierKey } from '../../common/types';

export const keyMap = {
  ctrl: 'ctrlKey',
  shift: 'shiftKey',
  alt: 'altKey',
  meta: 'metaKey',
} as const;

export type WheelAction =
  | { type: 'zoom', amount: number }
  | { type: 'frameSeek', direction: number }
  | { type: 'keyframeSeek', direction: number }
  | { type: 'seek', amount: number };

export function getTimelineWheelAction({ pixelX, pixelY, modifiers, wheelSensitivity, mouseWheelZoomModifierKey, mouseWheelFrameSeekModifierKey, mouseWheelKeyframeSeekModifierKey, invertTimelineScroll }: {
  pixelX: number,
  pixelY: number,
  modifiers: Record<typeof keyMap[ModifierKey], boolean>,
  wheelSensitivity: number,
  mouseWheelZoomModifierKey: ModifierKey,
  mouseWheelFrameSeekModifierKey: ModifierKey,
  mouseWheelKeyframeSeekModifierKey: ModifierKey,
  invertTimelineScroll?: boolean | undefined,
}): WheelAction {
  const isPressed = (key: ModifierKey) => modifiers[keyMap[key]];

  // Wheel up / pinch out (negative delta) zooms in, like ctrl+wheel in browsers. Not affected by invertTimelineScroll, which is for seeking only.
  // https://github.com/mifi/lossless-cut/issues/2703 https://github.com/mifi/lossless-cut/issues/2962
  const getZoomAction = (delta: number): WheelAction => ({ type: 'zoom', amount: -delta * wheelSensitivity * 0.4 });

  if (isPressed(mouseWheelZoomModifierKey)) return getZoomAction(pixelY);

  const delta = pixelX + pixelY;

  const direction = invertTimelineScroll ? 1 : -1;
  const unit = direction * delta > 0 ? 1 : -1;

  if (isPressed(mouseWheelFrameSeekModifierKey)) return { type: 'frameSeek', direction: unit };
  if (isPressed(mouseWheelKeyframeSeekModifierKey)) return { type: 'keyframeSeek', direction: unit };
  return { type: 'seek', amount: direction * delta * wheelSensitivity * 0.2 };
}
