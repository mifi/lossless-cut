import { nanoid } from 'nanoid';
import sortBy from 'lodash/sortBy';
import minBy from 'lodash/minBy';
import maxBy from 'lodash/maxBy';
import { ApparentSegmentBase, InverseSegment, PlaybackMode, SegmentBase } from './types';


export const isDurationValid = (duration?: number): duration is number => duration != null && Number.isFinite(duration) && duration > 0;

export const createSegment = (props?: { start?: number, end?: number, name?: string, tags?: unknown, segColorIndex?: number }) => ({
  start: props?.start,
  end: props?.end,
  name: props?.name || '',
  segId: nanoid(),
  segColorIndex: props?.segColorIndex,

  // `tags` is an optional object (key-value). Values must always be string
  // See https://github.com/mifi/lossless-cut/issues/879
  tags: props?.tags != null && typeof props.tags === 'object'
    ? Object.fromEntries(Object.entries(props.tags).map(([key, value]) => [key, String(value)]))
    : undefined,
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

export const getCleanCutSegments = (cs) => cs.map((seg) => ({
  start: seg.start,
  end: seg.end,
  name: seg.name,
  tags: seg.tags,
}));

export function findSegmentsAtCursor(apparentSegments, currentTime) {
  const indexes: number[] = [];
  apparentSegments.forEach((segment, index) => {
    if (segment.start <= currentTime && segment.end >= currentTime) indexes.push(index);
  });
  return indexes;
}

export const getSegmentTags = (segment) => (segment.tags || {});

export const sortSegments = <T>(segments: T[]) => sortBy(segments, 'start');

// https://stackoverflow.com/a/30472982/6519037
export function partitionIntoOverlappingRanges(array, getSegmentStart = (seg) => seg.start, getSegmentEnd = (seg) => seg.end) {
  function getMaxEnd(array2) {
    // note: this also mutates array2
    array2.sort((a, b) => {
      if (getSegmentEnd(a) < getSegmentEnd(b)) return 1;
      if (getSegmentEnd(a) > getSegmentEnd(b)) return -1;
      return 0;
    });
    return getSegmentEnd(array2[0]);
  }

  const ret: SegmentBase[][] = [];
  let g = 0;
  ret[g] = [array[0]];

  for (let i = 1; i < array.length; i += 1) {
    if (getSegmentStart(array[i]) >= getSegmentStart(array[i - 1]) && getSegmentStart(array[i]) < getMaxEnd(ret[g])) {
      ret[g]!.push(array[i]);
    } else {
      g += 1;
      ret[g] = [array[i]];
    }
  }

  return ret.filter((group) => group.length > 1).map((group) => sortBy(group, (seg) => getSegmentStart(seg)));
}

export function combineOverlappingSegments(existingSegments, getSegApparentEnd2) {
  const partitionedSegments = partitionIntoOverlappingRanges(existingSegments, getSegApparentStart, getSegApparentEnd2);

  return existingSegments.map((existingSegment) => {
    const partOfPartition = partitionedSegments.find((partition) => partition.includes(existingSegment));
    if (partOfPartition == null) return existingSegment; // this is not an overlapping segment, pass it through

    const index = partOfPartition.indexOf(existingSegment);
    // The first segment is the one with the lowest "start" value, so we use its start value
    if (index === 0) {
      return {
        ...existingSegment,
        // but use the segment with the highest "end" value as the end value.
        end: sortBy(partOfPartition, (segment) => segment.end)[partOfPartition.length - 1]!.end,
      };
    }
    return undefined; // then remove all other segments in this partition group
  }).filter(Boolean);
}

export function combineSelectedSegments<T extends SegmentBase>(existingSegments: T[], getSegApparentEnd2, isSegmentSelected) {
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

export function hasAnySegmentOverlap(sortedSegments) {
  if (sortedSegments.length === 0) return false;

  const overlappingGroups = partitionIntoOverlappingRanges(sortedSegments);
  return overlappingGroups.length > 0;
}

export function invertSegments(sortedCutSegments, includeFirstSegment: boolean, includeLastSegment: boolean, duration?: number) {
  if (sortedCutSegments.length === 0) return undefined;

  if (hasAnySegmentOverlap(sortedCutSegments)) return undefined;

  const ret: InverseSegment[] = [];

  if (includeFirstSegment) {
    const firstSeg = sortedCutSegments[0];
    if (firstSeg.start > 0) {
      ret.push({
        start: 0,
        end: firstSeg.start,
        ...(firstSeg.segId != null ? { segId: `start-${firstSeg.segId}` } : {}),
      });
    }
  }

  sortedCutSegments.forEach((cutSegment, i) => {
    if (i === 0) return;
    const previousSeg = sortedCutSegments[i - 1];
    const inverted: InverseSegment = {
      start: previousSeg.end,
      end: cutSegment.start,
    };
    if (previousSeg.segId != null && cutSegment.segId != null) inverted.segId = `${previousSeg.segId}-${cutSegment.segId}`;
    ret.push(inverted);
  });

  if (includeLastSegment) {
    const lastSeg = sortedCutSegments.at(-1);
    if (duration == null || lastSeg.end < duration) {
      const inverted: InverseSegment = {
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
export function convertSegmentsToChapters(sortedSegments) {
  if (sortedSegments.length === 0) return [];
  if (hasAnySegmentOverlap(sortedSegments)) throw new Error('Segments cannot overlap');

  sortedSegments.map((segment) => ({ start: segment.start, end: segment.end, name: segment.name }));
  const invertedSegments = invertSegments(sortedSegments, true, false);

  // inverted segments will be "gap" segments. Merge together with normal segments
  return sortSegments([...sortedSegments, ...(invertedSegments ?? [])]);
}

export function playOnlyCurrentSegment({ playbackMode, currentTime, playingSegment }: { playbackMode: PlaybackMode, currentTime: number, playingSegment: ApparentSegmentBase }) {
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

  return {};
}

export const getNumDigits = (value) => Math.floor(value > 0 ? Math.log10(value) : 0) + 1;

export function formatSegNum(segIndex, numSegments, minLength = 0) {
  const numDigits = getNumDigits(numSegments);
  return `${segIndex + 1}`.padStart(Math.max(numDigits, minLength), '0');
}
