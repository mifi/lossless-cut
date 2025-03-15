import { nanoid } from 'nanoid';
import sortBy from 'lodash/sortBy';
import minBy from 'lodash/minBy';
import maxBy from 'lodash/maxBy';
import invariant from 'tiny-invariant';

import { PlaybackMode, SegmentBase, SegmentTags, StateSegment } from './types';


export const isDurationValid = (duration?: number): duration is number => duration != null && Number.isFinite(duration) && duration > 0;

export const createSegment = (props?: {
  start?: number | undefined,
  end?: number | undefined,
  name?: string | undefined,
  tags?: unknown | undefined,
  initial?: true,
  selected?: boolean,
}): Omit<StateSegment, 'segColorIndex'> => ({
  start: props?.start ?? 0,
  end: props?.end,
  name: props?.name || '',
  segId: nanoid(),
  selected: props?.selected ?? true,

  // `tags` is an optional object (key-value). Values must always be string
  // See https://github.com/mifi/lossless-cut/issues/879
  tags: props?.tags != null && typeof props.tags === 'object'
    ? Object.fromEntries(Object.entries(props.tags).map(([key, value]) => [key, String(value)]))
    : undefined,

  ...(props?.initial && { initial: true }),
});

export const addSegmentColorIndex = (segment: Omit<StateSegment, 'segColorIndex'>, segColorIndex: number): StateSegment => ({
  ...segment,
  segColorIndex,
});

export const mapSaveableSegments = (segments: StateSegment[]) => segments.map(({
  start, end, name, tags, selected,
}) => ({
  start, end, name, tags, selected,
}));

// in the past we had non-string tags
export const getSegmentTags = (segment: { tags?: SegmentTags | undefined }) => (
  Object.fromEntries(Object.entries(segment.tags || {}).flatMap(([tag, value]) => (value != null ? [[tag, String(value)]] : [])))
);

export const sortSegments = <T extends { start: number }>(segments: T[]) => sortBy(segments, 'start');

// https://stackoverflow.com/a/30472982/6519037
export function partitionIntoOverlappingRanges<T extends SegmentBase>(array: T[]) {
  const [firstItem] = array;
  if (firstItem == null) throw new Error('No segments');

  const ret: T[][] = [
    [firstItem],
  ];

  const getSegmentEnd = (s: T) => s.end ?? s.start; // assume markers have a length of 0;

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
    const { start } = item;
    const prevStart = array[i - 1]!.start;
    if (start >= prevStart && start < getMaxEnd(ret[g]!)) {
      ret[g]!.push(item);
    } else {
      g += 1;
      ret[g] = [item];
    }
  }

  return ret.filter((group) => group.length > 1).map((group) => sortBy(group, (seg) => seg.start));
}

export function combineSelectedSegments(existingSegments: StateSegment[]) {
  const selectedSegments = existingSegments.filter((segment) => segment.selected);
  const firstSegment = minBy(selectedSegments, (seg) => seg.start);
  const lastSegment = maxBy(selectedSegments, (seg) => seg.end ?? seg.start);

  return existingSegments.flatMap((existingSegment) => {
    invariant(lastSegment != null);
    if (existingSegment === firstSegment) {
      return [{
        ...firstSegment,
        start: firstSegment.start,
        end: lastSegment.end ?? lastSegment.start, // for markers use their start
      }];
    }

    if (existingSegment.selected) {
      return []; // remove other selected segments
    }

    return [existingSegment];
  });
}

// Made by ChatGPT
export function combineOverlappingSegments(existingSegments: StateSegment[]): StateSegment[] {
  if (existingSegments.length === 0) return [];

  // Sort segments by start time
  const sortedSegments = [...existingSegments];
  sortedSegments.sort((a, b) => a.start - b.start);

  let currentSegment = sortedSegments[0]!;

  const combinedSegments: StateSegment[] = [];

  for (let i = 1; i < sortedSegments.length; i += 1) {
    const nextSegment = sortedSegments[i]!;

    // Check if the current segment overlaps or is adjacent to the next segment
    if (currentSegment.end != null && currentSegment.end >= nextSegment.start) {
      currentSegment = {
        ...currentSegment,
        end: Math.max(currentSegment.end, nextSegment.end ?? nextSegment.start),
      };
    } else {
      // Push the current segment to the combined list and move to the next segment
      combinedSegments.push(currentSegment);
      currentSegment = nextSegment;
    }
  }

  // Push the last segment
  combinedSegments.push(currentSegment);

  return combinedSegments;
}

export function hasAnySegmentOverlap(sortedSegments: { start: number, end: number }[]) {
  if (sortedSegments.length === 0) return false;

  const overlappingGroups = partitionIntoOverlappingRanges(sortedSegments);
  return overlappingGroups.length > 0;
}

// eslint-disable-next-line space-before-function-paren
export function invertSegments(sortedCutSegments: ({ start: number, end: number, segId?: string | undefined })[], includeFirstSegment: boolean, includeLastSegment: boolean, duration?: number) {
  if (sortedCutSegments.length === 0) return [];

  if (hasAnySegmentOverlap(sortedCutSegments)) return [];

  const ret: { start: number, end?: number | undefined, segId?: string | undefined }[] = [];

  if (includeFirstSegment) {
    const firstSeg = sortedCutSegments[0]!;
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
      const inverted: typeof ret[number] = {
        start: lastSeg.end,
        end: duration,
      };
      if (lastSeg.segId != null) inverted.segId = `${lastSeg.segId}-end`;
      ret.push(inverted);
    }
  }

  // Filter out zero length resulting segments
  // https://github.com/mifi/lossless-cut/issues/909
  return ret.filter(({ start, end }) => end == null || end > start);
}

// because chapters need to be contiguous, we need to insert gaps in-between
export function convertSegmentsToChapters(sortedSegments: { start: number, end: number, name?: string | undefined }[]) {
  if (sortedSegments.length === 0) return [];
  if (hasAnySegmentOverlap(sortedSegments)) throw new Error('Segments cannot overlap');

  const invertedSegments = invertSegments(sortedSegments, true, false).map(({ end, ...seg }) => {
    invariant(end != null); // to please typescript
    return { ...seg, end };
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

export const filterNonMarkers = <T extends { end?: number | undefined }>(segments: T[]) => segments.flatMap(({ end, ...rest }) => (end != null ? [{
  ...rest,
  end,
}] : []));

export function makeDurationSegments(segmentDuration: number, fileDuration: number) {
  const edl: { start: number, end: number }[] = [];
  for (let start = 0; start < fileDuration; start += segmentDuration) {
    const end = start + segmentDuration;
    edl.push({ start, end: end >= fileDuration ? fileDuration : end });
  }
  return edl;
}

export const isInitialSegment = (segments: StateSegment[]) => segments.length === 0 || (segments.length === 1 && segments[0]!.initial);
