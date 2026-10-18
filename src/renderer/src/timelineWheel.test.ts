import { describe, expect, test } from 'vitest';

import { getTimelineWheelAction } from './timelineWheel';
import type { ModifierKey } from '../../common/types';

const noModifiers = { ctrlKey: false, shiftKey: false, altKey: false, metaKey: false };

function getAction({ pixelX = 0, pixelY = 0, modifiers = {}, isPinch = false, invertTimelineScroll = false, zoomKey = 'ctrl', frameSeekKey = 'alt', keyframeSeekKey = 'shift' }: {
  pixelX?: number,
  pixelY?: number,
  modifiers?: Partial<typeof noModifiers>,
  isPinch?: boolean,
  invertTimelineScroll?: boolean,
  zoomKey?: ModifierKey,
  frameSeekKey?: ModifierKey,
  keyframeSeekKey?: ModifierKey,
}) {
  return getTimelineWheelAction({
    pixelX,
    pixelY,
    modifiers: { ...noModifiers, ...modifiers },
    isPinch,
    wheelSensitivity: 1,
    mouseWheelZoomModifierKey: zoomKey,
    mouseWheelFrameSeekModifierKey: frameSeekKey,
    mouseWheelKeyframeSeekModifierKey: keyframeSeekKey,
    invertTimelineScroll,
  });
}

// deltaY < 0 means wheel up (or trackpad pinch out)
describe('zoom', () => {
  test.each([false, true])('ctrl+wheel up zooms in, down zooms out, regardless of invertTimelineScroll=%s', (invertTimelineScroll) => {
    expect(getAction({ pixelY: -100, modifiers: { ctrlKey: true }, invertTimelineScroll })).toEqual({ type: 'zoom', amount: 40 });
    expect(getAction({ pixelY: 100, modifiers: { ctrlKey: true }, invertTimelineScroll })).toEqual({ type: 'zoom', amount: -40 });
  });

  test('custom zoom modifier', () => {
    expect(getAction({ pixelY: -100, modifiers: { metaKey: true }, zoomKey: 'meta' })).toEqual({ type: 'zoom', amount: 40 });
  });

  test('trackpad pinch zooms with higher sensitivity, also if zoom modifier is not ctrl', () => {
    expect(getAction({ pixelY: -10, modifiers: { ctrlKey: true }, isPinch: true })).toEqual({ type: 'zoom', amount: 20 });
    expect(getAction({ pixelY: -10, modifiers: { ctrlKey: true }, isPinch: true, zoomKey: 'meta', frameSeekKey: 'ctrl' })).toEqual({ type: 'zoom', amount: 20 });
  });

  test('ctrl actually held with other zoom modifier seeks, as before', () => {
    expect(getAction({ pixelY: -100, modifiers: { ctrlKey: true }, zoomKey: 'meta' })).toEqual({ type: 'seek', amount: 20 });
    expect(getAction({ pixelY: -100, modifiers: { ctrlKey: true }, zoomKey: 'meta', frameSeekKey: 'ctrl' })).toEqual({ type: 'frameSeek', direction: 1 });
  });

  test('shift as zoom modifier, where shift+wheel arrives as horizontal scroll', () => {
    expect(getAction({ pixelX: -100, modifiers: { shiftKey: true }, zoomKey: 'shift', keyframeSeekKey: 'meta' })).toEqual({ type: 'zoom', amount: 40 });
  });
});

describe('seek', () => {
  test('wheel up seeks forward, inverted with invertTimelineScroll', () => {
    expect(getAction({ pixelY: -100 })).toEqual({ type: 'seek', amount: 20 });
    expect(getAction({ pixelY: -100, invertTimelineScroll: true })).toEqual({ type: 'seek', amount: -20 });
  });

  test('frame and keyframe seek follow invertTimelineScroll', () => {
    expect(getAction({ pixelY: -100, modifiers: { altKey: true } })).toEqual({ type: 'frameSeek', direction: 1 });
    expect(getAction({ pixelY: -100, modifiers: { altKey: true }, invertTimelineScroll: true })).toEqual({ type: 'frameSeek', direction: -1 });
    expect(getAction({ pixelX: -100, modifiers: { shiftKey: true } })).toEqual({ type: 'keyframeSeek', direction: 1 });
    expect(getAction({ pixelX: -100, modifiers: { shiftKey: true }, invertTimelineScroll: true })).toEqual({ type: 'keyframeSeek', direction: -1 });
  });
});
