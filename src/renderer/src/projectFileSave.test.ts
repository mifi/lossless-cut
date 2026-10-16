import { describe, expect, it } from 'vitest';

import { getProjectFileSaveAction } from './projectFileSave';
import type { StateSegment } from './types';

function makeSegment(overrides: Partial<StateSegment> = {}): StateSegment {
  return {
    segId: 'seg1',
    start: 10,
    end: 20,
    name: 'label',
    selected: true,
    segColorIndex: 0,
    ...overrides,
  };
}

const projectFileSavePath = '/videos/video-proj.llc';

describe('getProjectFileSaveAction', () => {
  it('deletes the stale project file when all segments were deleted after a save (issue #1294)', () => {
    expect(getProjectFileSaveAction({
      lastSavedProjectFileSavePath: projectFileSavePath,
      projectFileSavePath,
      cutSegments: [],
    })).toBe('delete-stale');
  });

  it('does not create a project file when there were no segments yet', () => {
    expect(getProjectFileSaveAction({
      lastSavedProjectFileSavePath: undefined,
      projectFileSavePath,
      cutSegments: [],
    })).toBe('skip');
  });

  it("does not touch another file's project file when segments are empty", () => {
    expect(getProjectFileSaveAction({
      lastSavedProjectFileSavePath: '/videos/other-proj.llc',
      projectFileSavePath,
      cutSegments: [],
    })).toBe('skip');
  });

  it('does not save when there is only the untouched initial segment (issue #2745)', () => {
    expect(getProjectFileSaveAction({
      lastSavedProjectFileSavePath: undefined,
      projectFileSavePath,
      cutSegments: [makeSegment({ start: 0, end: 60, initial: true, selected: true })],
    })).toBe('skip');
  });

  it('saves when segments exist', () => {
    expect(getProjectFileSaveAction({
      lastSavedProjectFileSavePath: undefined,
      projectFileSavePath,
      cutSegments: [makeSegment()],
    })).toBe('save');
  });

  it('saves when the initial segment was deselected', () => {
    expect(getProjectFileSaveAction({
      lastSavedProjectFileSavePath: undefined,
      projectFileSavePath,
      cutSegments: [makeSegment({ start: 0, end: 60, initial: true, selected: false })],
    })).toBe('save');
  });
});
