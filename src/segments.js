import uuid from 'uuid';

import { generateColor } from './util';

export const createSegment = ({ start, end, name } = {}) => ({
  start,
  end,
  name: name || '',
  color: generateColor(),
  uuid: uuid.v4(),
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
