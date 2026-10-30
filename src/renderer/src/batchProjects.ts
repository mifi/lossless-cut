import { hasAnySegmentOverlap, invertSegments, isDurationValid, sortSegments } from './segments';
import type { LlcProject, SegmentToExport } from './types';

export const getBatchProjectPaths = (files: readonly { path: string }[]) => [...new Set(files.map((f) => f.path).filter((p) => p.toLowerCase().endsWith('.llc')))];

export function getBatchProjectSegments(project: LlcProject, duration: number, inverted: boolean): SegmentToExport[] {
  if (!isDurationValid(duration)) throw new Error('The media file does not have a valid duration');
  const segments = project.cutSegments.flatMap((seg, originalIndex) => {
    // A marker, or an explicitly unchecked segment, must never turn into a
    // whole-file export through getGuaranteedSegments' empty-list fallback.
    if (seg.end == null || (!inverted && seg.selected === false)) return [];
    if (!Number.isFinite(seg.start) || !Number.isFinite(seg.end) || seg.start < 0 || seg.end <= seg.start) throw new Error('Invalid segment times');
    const start = Math.min(seg.start, duration);
    const end = Math.min(seg.end, duration);
    return end > start ? [{ start, end, name: seg.name, tags: seg.tags, originalIndex }] : [];
  });
  if (!inverted || segments.length === 0) return segments;
  const sorted = sortSegments(segments);
  if (hasAnySegmentOverlap(sorted)) throw new Error('Overlapping segments cannot be inverted');
  return invertSegments(sorted, true, true, duration).flatMap((seg, originalIndex) => (seg.end != null ? [{ start: seg.start, end: seg.end, name: seg.name, originalIndex }] : []));
}
