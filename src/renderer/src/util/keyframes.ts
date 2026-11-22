export interface ScannedInterval {
  from: number,
  to: number,
  createdAt: Date,
}

/**
 * Returns true if the whole range [from, to] is covered by the union of the given intervals,
 * i.e. we have actually read all packets in that range, so we know every keyframe in it.
 */
export function isRangeScanned(intervals: Pick<ScannedInterval, 'from' | 'to'>[], from: number, to: number) {
  const start = Math.min(from, to);
  const end = Math.max(from, to);

  let reached = start;
  const sorted = [...intervals].sort((a, b) => a.from - b.from);
  for (const interval of sorted) {
    if (interval.from > reached) break; // gap
    if (interval.to > reached) reached = interval.to;
    if (reached >= end) return true;
  }
  return reached >= end;
}
