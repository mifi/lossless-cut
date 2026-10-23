import { describe, expect, it } from 'vitest';

import { getBatchProjectPaths, getBatchProjectSegments } from './batchProjects';
import type { LlcProject } from './types';

const project = (cutSegments: LlcProject['cutSegments']): LlcProject => ({ version: 2, mediaFileName: 'source.webm', cutSegments });

describe('batch projects', () => {
  it('keeps project order, accepts uppercase extensions, and excludes ordinary videos and duplicates', () => {
    expect(getBatchProjectPaths(['/a/one.llc', '/a/video.mp4', '/b/TWO.LLC', '/a/one.llc'].map((path) => ({ path })))).toEqual(['/a/one.llc', '/b/TWO.LLC']);
  });

  it('exports selected cuts with original indices and labels, excluding unchecked cuts and markers', () => {
    const result = getBatchProjectSegments(project([
      { start: 1, end: 2, name: 'unchecked', selected: false },
      { start: 3, name: 'marker' },
      { start: 4, end: 7, name: 'keep', tags: { subject: 'test' } },
    ]), 10, false);
    expect(result).toEqual([{ start: 4, end: 7, name: 'keep', tags: { subject: 'test' }, originalIndex: 2 }]);
  });

  it.each([{ segments: [] }, { segments: [{ start: 1, name: 'marker' }] }, { segments: [{ start: 1, end: 2, name: 'unchecked', selected: false }] }])('does not substitute the whole video when no cuts are selected', ({ segments }) => {
    expect(getBatchProjectSegments(project(segments), 10, false)).toEqual([]);
  });

  it('clips saved ranges to this media duration and skips ranges beyond EOF', () => {
    const cuts = getBatchProjectSegments(project([{ start: 8, end: 12, name: 'tail' }, { start: 15, end: 20, name: 'outside' }]), 10, false);
    expect(cuts.map(({ start, end }) => ({ start, end }))).toEqual([{ start: 8, end: 10 }]);
  });

  it('inverts all saved cuts in chronological order like the editor, including unchecked cuts', () => {
    const cuts = getBatchProjectSegments(project([{ start: 5, end: 7, name: 'second' }, { start: 1, end: 3, name: 'first', selected: false }]), 10, true);
    expect(cuts.map(({ start, end }) => ({ start, end }))).toEqual([{ start: 0, end: 1 }, { start: 3, end: 5 }, { start: 7, end: 10 }]);
  });

  it('rejects invalid cuts and overlapping inverse cuts instead of exporting unrelated footage', () => {
    expect(() => getBatchProjectSegments(project([{ start: 4, end: 2, name: '' }]), 10, false)).toThrow('Invalid segment');
    expect(() => getBatchProjectSegments(project([{ start: 1, end: 4, name: '' }, { start: 3, end: 5, name: '' }]), 10, true)).toThrow('Overlapping');
    expect(() => getBatchProjectSegments(project([]), Number.NaN, false)).toThrow('duration');
  });
});
