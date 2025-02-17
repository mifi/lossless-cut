import { nanoid } from 'nanoid';
import sortBy from 'lodash/sortBy';
import minBy from 'lodash/minBy';
import maxBy from 'lodash/maxBy';
import invariant from 'tiny-invariant';

import { PlaybackMode, SegmentBase, SegmentTags, StateSegment } from './types';


export const isDurationValid = (duration?: number): duration is number => duration != null && Number.isFinite(duration) && duration > 0;

export const createSegment = (props?: { start?: number | undefined, end?: number | undefined, name?: string | undefined, tags?: unknown | undefined }): Omit<StateSegment, 'segColorIndex'> => ({
  start: props?.start,
  end: props?.end,
  name: props?.name || '',
  segId: nanoid(),

  // `tags` is an optional object (key-value). Values must always be string
  // See https://github.com/mifi/lossless-cut/issues/879
  tags: props?.tags != null && typeof props.tags === 'object'
    ? Object.fromEntries(Object.entries(props.tags).map(([key, value]) => [key, String(value)]))
    : undefined,
});

export const addSegmentColorIndex = (segment: Omit<StateSegment, 'segColorIndex'>, segColorIndex: number): StateSegment => ({
  ...segment,
  segColorIndex,
});

// Because segments could have undefined start / end
// (meaning extend to start of timeline or end duration)
export function getSegApparentStart(seg: SegmentBase) {
  const time = seg.start;
  return time !== undefined ? time : 0;
}

export function getSegApparentEnd(seg: SegmentBase, duration?: number) {
  const time = seg.end;
  if (time !== undefined) return time;
  if (isDurationValid(duration)) return duration;
  return 0; // Haven't gotten duration yet - what do to ¯\_(ツ)_/¯
}

export const getCleanCutSegments = (cs: Pick<StateSegment, 'start' | 'end' | 'name' | 'tags'>[]) => cs.map((seg) => ({
  start: seg.start,
  end: seg.end,
  name: seg.name,
  tags: seg.tags,
}));

export function findSegmentsAtCursor(segments: SegmentBase[], currentTime: number) {
  const indexes: number[] = [];
  segments.forEach((segment, index) => {
    if ((segment.start == null || segment.start <= currentTime) && (segment.end == null || segment.end >= currentTime)) indexes.push(index);
  });
  return indexes;
}

// in the past we had non-string tags
export const getSegmentTags = (segment: { tags?: SegmentTags | undefined }) => (
  Object.fromEntries(Object.entries(segment.tags || {}).flatMap(([tag, value]) => (value != null ? [[tag, String(value)]] : [])))
);

export const sortSegments = <T extends { start: number }>(segments: T[]) => sortBy(segments, 'start');

// https://stackoverflow.com/a/30472982/6519037
export function partitionIntoOverlappingRanges<T extends SegmentBase>(
  array: T[],
  getSegmentStart = getSegApparentStart,
  getSegmentEnd = (seg: T) => {
    if (seg.end == null) throw new Error('Unknown end of segment');
    return seg.end;
  },
) {
  const [firstItem] = array;
  if (firstItem == null) throw new Error('No segments');

  const ret: T[][] = [
    [firstItem],
  ];

  const getMaxEnd = (array2: T[]) => {
    // note: this also mutates array2
    array2.sort((a, b) => {
      if (getSegmentEnd(a) < getSegmentEnd(b)) return 1;
      if (getSegmentEnd(a) > getSegmentEnd(b)) return -1;
      return 0;
    });
    if (array2[0] == null) throw new Error();
    return getSegmentEnd(array2[0]);
  };

  for (let i = 1, g = 0; i < array.length; i += 1) {
    const item = array[i]!;
    const start = getSegmentStart(item);
    const prevStart = getSegmentStart(array[i - 1]!);
    if (start == null || prevStart == null) throw new Error();
    if (start >= prevStart && start < getMaxEnd(ret[g]!)) {
      ret[g]!.push(item);
    } else {
      g += 1;
      ret[g] = [item];
    }
  }

  return ret.filter((group) => group.length > 1).map((group) => sortBy(group, (seg) => getSegmentStart(seg)));
}

export function combineOverlappingSegments<T extends SegmentBase>(existingSegments: T[], getSegApparentEnd2: (seg: SegmentBase) => number) {
  const partitionedSegments = partitionIntoOverlappingRanges(existingSegments, getSegApparentStart, getSegApparentEnd2);

  return existingSegments.flatMap((existingSegment) => {
    const partOfPartition = partitionedSegments.find((partition) => partition.includes(existingSegment));
    if (partOfPartition == null) {
      return [existingSegment]; // this is not an overlapping segment, pass it through
    }

    const index = partOfPartition.indexOf(existingSegment);
    // The first segment is the one with the lowest "start" value, so we use its start value
    if (index === 0) {
      return [{
        ...existingSegment,
        // but use the segment with the highest "end" value as the end value.
        end: sortBy(partOfPartition, (segment) => segment.end)[partOfPartition.length - 1]!.end,
      }];
    }

    return []; // then remove all other segments in this partition group
  });
}

export function combineSelectedSegments(existingSegments: StateSegment[], getSegApparentEnd2: (seg: StateSegment) => number, isSegmentSelected: (seg: StateSegment) => boolean) {
  const selectedSegments = existingSegments.filter((segment) => isSegmentSelected(segment));
  const firstSegment = minBy(selectedSegments, (seg) => getSegApparentStart(seg));
  const lastSegment = maxBy(selectedSegments, (seg) => getSegApparentEnd2(seg));

  return existingSegments.flatMap((existingSegment) => {
    if (existingSegment === firstSegment) {
      return [{
        ...firstSegment,
        start: firstSegment.start,
        end: lastSegment!.end,
      }];
    }

    if (isSegmentSelected(existingSegment)) return []; // remove other selected segments

    return [existingSegment];
  });
}

export function hasAnySegmentOverlap(sortedSegments: SegmentBase[]) {
  if (sortedSegments.length === 0) return false;

  const overlappingGroups = partitionIntoOverlappingRanges(sortedSegments);
  return overlappingGroups.length > 0;
}

// eslint-disable-next-line space-before-function-paren
export function invertSegments(sortedCutSegments: (SegmentBase & { segId?: string | undefined })[], includeFirstSegment: boolean, includeLastSegment: boolean, duration?: number) {
  if (sortedCutSegments.length === 0) return [];

  if (hasAnySegmentOverlap(sortedCutSegments)) return [];

  const ret: typeof sortedCutSegments = [];

  if (includeFirstSegment) {
    const firstSeg = sortedCutSegments[0]!;
    if (firstSeg.start != null && firstSeg.start > 0) {
      ret.push({
        start: 0,
        end: firstSeg.start,
        ...(firstSeg.segId != null ? { segId: `start-${firstSeg.segId}` } : {}),
      });
    }
  }

  sortedCutSegments.forEach((cutSegment, i) => {
    if (i === 0) return;
    const previousSeg = sortedCutSegments[i - 1]!;
    const inverted: typeof sortedCutSegments[number] = {
      start: previousSeg.end,
      end: cutSegment.start,
    };
    if (previousSeg.segId != null && cutSegment.segId != null) inverted.segId = `${previousSeg.segId}-${cutSegment.segId}`;
    ret.push(inverted);
  });

  if (includeLastSegment) {
    const lastSeg = sortedCutSegments.at(-1)!;
    if (duration == null || (lastSeg.end != null && lastSeg.end < duration)) {
      const inverted: typeof sortedCutSegments[number] = {
        start: lastSeg.end,
        end: duration,
      };
      if (lastSeg.segId != null) inverted.segId = `${lastSeg.segId}-end`;
      ret.push(inverted);
    }
  }

  // Filter out zero length resulting segments
  // https://github.com/mifi/lossless-cut/issues/909
  return ret.filter(({ start, end }) => end == null || start == null || end > start);
}

// because chapters need to be contiguous, we need to insert gaps in-between
export function convertSegmentsToChapters(sortedSegments: { start: number, end: number, name?: string | undefined }[]) {
  if (sortedSegments.length === 0) return [];
  if (hasAnySegmentOverlap(sortedSegments)) throw new Error('Segments cannot overlap');

  const invertedSegments = invertSegments(sortedSegments, true, false).map(({ start, end, ...seg }) => {
    invariant(start != null && end != null); // to please typescript
    return { ...seg, start, end };
  });

  // inverted segments will be "gap" segments. Merge together with normal segments
  return sortSegments([...sortedSegments, ...invertedSegments]);
}

export function getPlaybackMode({ playbackMode, currentTime, playingSegment }: {
  playbackMode: PlaybackMode,
  currentTime: number,
  playingSegment: { start: number, end: number },
}) {
  switch (playbackMode) {
    case 'loop-segment-start-end': {
      const maxSec = 3; // max time each side (start/end)
      const sec = Math.min(maxSec, (playingSegment.end - playingSegment.start) / 3) * 2;

      const startWindowEnd = playingSegment.start + sec / 2;
      const endWindowStart = playingSegment.end - sec / 2;

      if (currentTime >= playingSegment.end) {
        return { seekTo: playingSegment.start };
      }
      if (currentTime < endWindowStart && currentTime >= startWindowEnd) {
        return { seekTo: endWindowStart };
      }
      break;
    }

    case 'loop-segment': {
      if (currentTime >= playingSegment.end) {
        return { seekTo: playingSegment.start };
      }
      break;
    }

    case 'play-segment-once': {
      if (currentTime >= playingSegment.end) {
        return { seekTo: playingSegment.end, exit: true };
      }
      break;
    }

    case 'loop-selected-segments': {
      if (currentTime >= playingSegment.end) {
        return { nextSegment: true };
      }
      break;
    }

    default:
  }

  return undefined; // no action
}

export const getNumDigits = (value: number) => Math.floor(value > 0 ? Math.log10(value) : 0) + 1;

export function formatSegNum(segIndex: number, numSegments: number, minLength = 0) {
  const numDigits = getNumDigits(numSegments);
  return `${segIndex + 1}`.padStart(Math.max(numDigits, minLength), '0');
}
