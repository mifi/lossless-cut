import { XMLParser } from 'fast-xml-parser';
import i18n from 'i18next';

import csvParse from 'csv-parse/lib/browser';
import csvStringify from 'csv-stringify/lib/browser';
import pify from 'pify';
import sortBy from 'lodash/sortBy';

import { formatDuration } from './util/duration';
import { invertSegments, sortSegments } from './segments';
import { Segment } from './types';

const csvParseAsync = pify(csvParse);
const csvStringifyAsync = pify(csvStringify);

export const getTimeFromFrameNum = (detectedFps, frameNum) => frameNum / detectedFps;

export function getFrameCountRaw(detectedFps: number | undefined, sec: number) {
  if (detectedFps == null) return undefined;
  return Math.round(sec * detectedFps);
}

function parseTime(str: string) {
  const timeMatch = str.match(/^\D*(?:(?:(\d+):)?(\d{1,2}):)?(\d+)(?:\.(\d{1,3}))?:?/);
  if (!timeMatch) return undefined;

  const rest = str.slice(timeMatch[0].length);

  const [, hourStr, minStr, secStr, msStr] = timeMatch;
  const hour = hourStr != null ? parseInt(hourStr, 10) : 0;
  const min = minStr != null ? parseInt(minStr, 10) : 0;
  const sec = parseFloat(msStr != null ? `${secStr}.${msStr}` : secStr!);

  const time = (((hour * 60) + min) * 60 + sec);
  return { time, rest };
}

export function parseCsvTime(str) {
  const parsed = parseTime(str.trim());
  return parsed?.time;
}

export const getFrameValParser = (fps) => (str) => {
  if (str === '') return undefined;
  const frameCount = parseFloat(str);
  return getTimeFromFrameNum(fps, frameCount);
};

export async function parseCsv(csvStr, parseTimeFn) {
  const rows = await csvParseAsync(csvStr, {});
  if (rows.length === 0) throw new Error(i18n.t('No rows found'));
  if (!rows.every((row) => row.length === 3)) throw new Error(i18n.t('One or more rows does not have 3 columns'));

  const mapped = rows
    .map(([start, end, name]) => ({
      start: parseTimeFn(start),
      end: parseTimeFn(end),
      name: name.trim(),
    }));

  if (!mapped.every(({ start, end }) => (
    (start === undefined || !Number.isNaN(start))
    && (end === undefined || !Number.isNaN(end))
  ))) {
    console.log(mapped);
    throw new Error(i18n.t('Invalid start or end value. Must contain a number of seconds'));
  }

  return mapped;
}

export async function parseMplayerEdl(text) {
  const allRows = text.split('\n').map((line) => {
    const match = line.match(/^\s*(\S+)\s+(\S+)\s+([0-3])\s*$/);
    if (!match) return undefined;
    const start = parseFloat(match[1]);
    const end = parseFloat(match[2]);
    const type = parseInt(match[3], 10);
    if (Number.isNaN(start) || Number.isNaN(end)) return undefined;
    if (start < 0 || end < 0 || start >= end) return undefined;
    return { start, end, type };
  }).filter(Boolean);

  const cutAwaySegments = allRows.filter((row) => row.type === 0);
  const muteSegments = allRows.filter((row) => row.type === 1);
  const sceneMarkers = allRows.filter((row) => row.type === 2);
  const commercialBreaks = allRows.filter((row) => row.type === 3);

  const inverted = cutAwaySegments.length > 0 ? invertSegments(sortSegments(cutAwaySegments), true, true) : [];

  const map = (segments, name, type) => segments.map(({ start, end }) => ({ start, end, name, tags: { mplayerEdlType: type } }));

  const out = [
    ...map(inverted || [], 'Cut', 0),
    ...map(muteSegments, 'Mute', 1),
    ...map(sceneMarkers, 'Scene Marker', 2),
    ...map(commercialBreaks, 'Commercial Break', 3),
  ];
  if (out.length === 0) throw new Error(i18n.t('Invalid EDL data found'));
  return out;
}

export function parseCuesheet(cuesheet) {
  // There are 75 such frames per second of audio.
  // https://en.wikipedia.org/wiki/Cue_sheet_(computing)
  const fps = 75;

  const { tracks } = cuesheet.files[0];

  function getTime(track) {
    const index = track.indexes[0];
    if (!index) return undefined;
    const { time } = index;
    if (!time) return undefined;

    return (time.min * 60) + time.sec + time.frame / fps;
  }

  return tracks.map((track, i) => {
    const nextTrack = tracks[i + 1];
    const end = nextTrack && getTime(nextTrack);

    return { name: track.title, start: getTime(track), end, tags: { performer: track.performer, title: track.title } };
  });
}

// See https://github.com/mifi/lossless-cut/issues/993#issuecomment-1037090403
export function parsePbf(buf: Buffer) {
  const text = buf.toString('utf16le');
  const bookmarks = text.split('\n').map((line) => {
    const match = line.match(/^\d+=(\d+)\*([^*]+)*([^*]+)?/);
    if (match) return { time: parseInt(match[1]!, 10) / 1000, name: match[2] };
    return undefined;
  }).filter(Boolean);

  const out: Segment[] = [];

  for (let i = 0; i < bookmarks.length;) {
    const bookmark = bookmarks[i]!;
    const nextBookmark = bookmarks[i + 1];
    if (!nextBookmark) {
      out.push({ start: bookmark.time, end: undefined, name: bookmark.name });
      i += 1;
    } else {
      out.push({ start: bookmark.time, end: nextBookmark && nextBookmark.time, name: bookmark.name });
      i += nextBookmark.name === ' ' ? 2 : 1;
    }
  }

  return out;
}

// https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/FinalCutPro_XML/VersionsoftheInterchangeFormat/VersionsoftheInterchangeFormat.html
export function parseXmeml(xmlStr) {
  const xml = new XMLParser().parse(xmlStr);

  // TODO maybe support media.audio also?
  const { xmeml } = xml;
  if (!xmeml) throw new Error('Root element <xmeml> not found in file');

  let sequence;

  if (xmeml.project?.children?.sequence) {
    sequence = xmeml.project.children.sequence;
  } else if (xmeml.sequence) {
    sequence = xmeml.sequence;
  } else {
    throw new Error('No <sequence> element found');
  }

  if (!sequence?.media?.video?.track) {
    throw new Error('No <track> element found');
  }

  const mainTrack = Array.isArray(sequence.media.video.track) ? sequence.media.video.track[0] : sequence.media.video.track;

  return mainTrack.clipitem.map((item) => ({ start: item.in / item.rate.timebase, end: item.out / item.rate.timebase }));
}

export function parseFcpXml(xmlStr) {
  const xml = new XMLParser({ ignoreAttributes: false }).parse(xmlStr);

  const { fcpxml } = xml;
  if (!fcpxml) throw new Error('Root element <fcpxml> not found in file');

  function getTime(str) {
    const match = str.match(/(\d+)\/(\d+)s/);
    if (!match) throw new Error('Invalid attribute');
    return parseInt(match[1], 10) / parseInt(match[2], 10);
  }

  return fcpxml.library.event.project.sequence.spine['asset-clip'].map((assetClip) => {
    const start = getTime(assetClip['@_start']);
    const duration = getTime(assetClip['@_duration']);
    const end = start + duration;
    return { start, end };
  });
}

export function parseYouTube(str) {
  function parseLine(lineStr) {
    const timeParsed = parseTime(lineStr);
    if (timeParsed == null) return undefined;

    const { time, rest } = timeParsed;

    const nameMatch = rest.match(/^[\s-]+([^\n]*)$/);
    if (!nameMatch) return undefined;

    const [, name] = nameMatch;

    return { time, name };
  }

  const lines = str.split('\n').map((line) => parseLine(line)).filter(Boolean);

  const linesSorted = sortBy(lines, (l) => l.time);

  const edl = linesSorted.map((line, i) => {
    const nextLine = linesSorted[i + 1];
    return { start: line.time, end: nextLine && nextLine.time, name: line.name };
  });

  return edl.filter((ed) => ed.start !== ed.end);
}

export function formatYouTube(segments) {
  return segments.map((segment) => {
    const timeStr = formatDuration({ seconds: segment.start, showFraction: false, shorten: true });
    const namePart = segment.name ? ` ${segment.name}` : '';
    return `${timeStr}${namePart}`;
  }).join('\n');
}

// because null/undefined is also valid values (start/end of timeline)
const safeFormatDuration = (duration) => (duration != null ? formatDuration({ seconds: duration }) : '');

export const formatSegmentsTimes = (cutSegments) => cutSegments.map(({ start, end, name }) => [
  safeFormatDuration(start),
  safeFormatDuration(end),
  name,
]);

export async function formatCsvFrames({ cutSegments, getFrameCount }) {
  const safeFormatFrameCount = (seconds) => (seconds != null ? getFrameCount(seconds) : '');

  const formatted = cutSegments.map(({ start, end, name }) => [
    safeFormatFrameCount(start),
    safeFormatFrameCount(end),
    name,
  ]);

  return csvStringifyAsync(formatted);
}

export async function formatCsvSeconds(cutSegments) {
  const rows = cutSegments.map(({ start, end, name }) => [start, end, name]);
  return csvStringifyAsync(rows);
}

export async function formatCsvHuman(cutSegments) {
  return csvStringifyAsync(formatSegmentsTimes(cutSegments));
}

export async function formatTsv(cutSegments) {
  return csvStringifyAsync(formatSegmentsTimes(cutSegments), { delimiter: '\t' });
}

export function parseDvAnalyzerSummaryTxt(txt: string) {
  const lines = txt.split(/\r?\n/);

  let headerFound = false;

  const times: { time: number, name: string, tags: Record<string, string> }[] = [];
  // eslint-disable-next-line no-restricted-syntax
  for (const line of lines) {
    if (headerFound) {
      const match = line.match(/^(\d{2}):(\d{2}):(\d{2}).(\d{3})\s+(\S+)\s+-\s+(\S+)\s+(\S+\s+\S+)\s+-\s+(\S+\s+\S+)/);
      if (!match) break;
      const h = parseInt(match[1]!, 10);
      const m = parseInt(match[2]!, 10);
      const s = parseInt(match[3]!, 10);
      const ms = parseInt(match[4]!, 10);
      const total = s + ((m + (h * 60)) * 60) + (ms / 1000);
      const recordedStart = match[7]!;
      const recordedEnd = match[8]!;
      times.push({ time: total, name: recordedStart, tags: { recordedStart, recordedEnd } });
    }
    if (/^Absolute time\s+DV timecode range\s+Recorded date\/time range\s+Frame range\s*$/.test(line)) headerFound = true;
  }

  const edl = times.map(({ time, name, tags }, i) => {
    const nextTime = times[i + 1];
    return { start: time, end: nextTime?.time, name, tags };
  });

  return edl;
}

// http://www.textfiles.com/uploads/kds-srt.txt
export function parseSrt(text: string) {
  const ret: { start?: number, end?: number, name: string, tags: Record<string, string | number | undefined> }[] = [];

  // working state
  let subtitleIndexAt: number | undefined;
  let start: number | undefined;
  let end: number | undefined;
  let lines: string[] = [];

  const flush = () => {
    if (start != null && end != null && lines.length > 0) {
      ret.push({ start, end, name: lines.join('\r\n'), tags: { index: subtitleIndexAt } });
    }
    start = undefined;
    end = undefined;
    subtitleIndexAt = undefined;
    lines = [];
  };

  // eslint-disable-next-line no-restricted-syntax
  for (const lineRaw of text.trim().split('\r\n')) {
    const line = lineRaw.trim();
    if (line === '') {
      flush();
    } else if (subtitleIndexAt != null && subtitleIndexAt > 0) {
      const match = line.match(/^(\d+:\d+:\d+[,.]\d+\s+)-->(\s+\d+:\d+:\d+[,.]\d+)$/);
      if (match) {
        const fixComma = (v) => v.replaceAll(',', '.');
        start = parseTime(fixComma(match[1]))?.time;
        end = parseTime(fixComma(match[2]))?.time;
      } else if (start != null && end != null) {
        lines.push(line);
      }
    } else if (/^\d+$/.test(line)) {
      const parsedIndex = parseInt(line, 10);
      if (!Number.isNaN(parsedIndex) && parsedIndex > 0) {
        subtitleIndexAt = parsedIndex;
      }
    }
  }

  flush();

  return ret;
}

export function formatSrt(segments) {
  return segments.reduce((acc, segment, index) => `${acc}${index > 0 ? '\r\n' : ''}${index + 1}\r\n${formatDuration({ seconds: segment.start }).replaceAll('.', ',')} --> ${formatDuration({ seconds: segment.end }).replaceAll('.', ',')}\r\n${segment.name || '-'}\r\n`, '');
}
