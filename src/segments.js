import uuid from 'uuid';
import sortBy from 'lodash/sortBy';

import { generateColor } from './util/colors';

export const createSegment = ({ start, end, name } = {}) => ({
  start,
  end,
  name: name || '',
  color: generateColor(),
  segId: uuid.v4(),
});

export const createInitialCutSegments = () => [createSegment()];

// Because segments could have undefined start / end
// (meaning extend to start of timeline or end duration)
export function getSegApparentStart(seg) {
  const time = seg.start;
  return time !== undefined ? time : 0;
}

export const getCleanCutSegments = (cs) => cs.map((seg) => ({
  start: seg.start,
  end: seg.end,
  name: seg.name,
}));

export function findSegmentsAtCursor(apparentSegments, currentTime) {
  const indexes = [];
  apparentSegments.forEach((segment, index) => {
    if (segment.start < currentTime && segment.end > currentTime) indexes.push(index);
  });
  return indexes;
}

export const sortSegments = (segments) => sortBy(segments, 'start');

export function invertSegments(sortedCutSegments, duration) {
  if (sortedCutSegments.length < 1) return undefined;

  const foundOverlap = sortedCutSegments.some((cutSegment, i) => {
    if (i === 0) return false;
    return sortedCutSegments[i - 1].end > cutSegment.start;
  });

  if (foundOverlap) return undefined;

  const ret = [];

  if (sortedCutSegments[0].start > 0) {
    ret.push({
      start: 0,
      end: sortedCutSegments[0].start,
    });
  }

  sortedCutSegments.forEach((cutSegment, i) => {
    if (i === 0) return;
    ret.push({
      start: sortedCutSegments[i - 1].end,
      end: cutSegment.start,
    });
  });

  const last = sortedCutSegments[sortedCutSegments.length - 1];
  if (last.end < duration || duration == null) {
    ret.push({
      start: last.end,
      end: duration,
    });
  }

  return ret;
}
