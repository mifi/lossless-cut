import { v4 as uuidv4 } from 'uuid';
import sortBy from 'lodash/sortBy';


export const isDurationValid = (duration) => Number.isFinite(duration) && duration > 0;

export const createSegment = ({ start, end, name, tags, segColorIndex } = {}) => ({
  start,
  end,
  name: name || '',
  segId: uuidv4(),
  segColorIndex,

  // `tags` is an optional object (key-value). Values must always be string
  // See https://github.com/mifi/lossless-cut/issues/879
  tags: tags != null && typeof tags === 'object'
    ? Object.fromEntries(Object.entries(tags).map(([key, value]) => [key, String(value)]))
    : undefined,
});

// Because segments could have undefined start / end
// (meaning extend to start of timeline or end duration)
export function getSegApparentStart(seg) {
  const time = seg.start;
  return time !== undefined ? time : 0;
}

export function getSegApparentEnd(seg, duration) {
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
  const indexes = [];
  apparentSegments.forEach((segment, index) => {
    if (segment.start < currentTime && segment.end > currentTime) indexes.push(index);
  });
  return indexes;
}

export const getSegmentTags = (segment) => (segment.tags || {});

export const sortSegments = (segments) => sortBy(segments, 'start');

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

  const ret = [];
  let g = 0;
  ret[g] = [array[0]];

  for (let i = 1; i < array.length; i += 1) {
    if (getSegmentStart(array[i]) >= getSegmentStart(array[i - 1]) && getSegmentStart(array[i]) < getMaxEnd(ret[g])) {
      ret[g].push(array[i]);
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
        end: sortBy(partOfPartition, (segment) => segment.end)[partOfPartition.length - 1].end,
      };
    }
    return undefined; // then remove all other segments in this partition group
  }).filter((segment) => segment);
}

export function hasAnySegmentOverlap(sortedSegments) {
  if (sortedSegments.length < 1) return false;

  const overlappingGroups = partitionIntoOverlappingRanges(sortedSegments);
  return overlappingGroups.length > 0;
}

export function invertSegments(sortedCutSegments, includeFirstSegment, includeLastSegment, duration) {
  if (sortedCutSegments.length < 1) return undefined;

  if (hasAnySegmentOverlap(sortedCutSegments)) return undefined;

  const ret = [];

  if (includeFirstSegment) {
    if (sortedCutSegments[0].start > 0) {
      ret.push({
        start: 0,
        end: sortedCutSegments[0].start,
      });
    }
  }

  sortedCutSegments.forEach((cutSegment, i) => {
    if (i === 0) return;
    ret.push({
      start: sortedCutSegments[i - 1].end,
      end: cutSegment.start,
    });
  });

  if (includeLastSegment) {
    const last = sortedCutSegments[sortedCutSegments.length - 1];
    if (last.end < duration || duration == null) {
      ret.push({
        start: last.end,
        end: duration,
      });
    }
  }

  // Filter out zero length resulting segments
  // https://github.com/mifi/lossless-cut/issues/909
  return ret.filter(({ start, end }) => end == null || start == null || end > start);
}

// because chapters need to be contiguous, we need to insert gaps in-between
export function convertSegmentsToChapters(sortedSegments) {
  if (sortedSegments.length < 1) return [];
  if (hasAnySegmentOverlap(sortedSegments)) throw new Error('Segments cannot overlap');

  sortedSegments.map((segment) => ({ start: segment.start, end: segment.end, name: segment.name }));
  const invertedSegments = invertSegments(sortedSegments, true, false);

  // inverted segments will be "gap" segments. Merge together with normal segments
  return sortSegments([...sortedSegments, ...invertedSegments]);
}
