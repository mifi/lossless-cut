import { XMLParser } from 'fast-xml-parser';
import i18n from 'i18next';
import invariant from 'tiny-invariant';
import { Duration } from 'luxon';

import { parse as csvParse } from 'csv-parse/browser/esm/sync';
import { stringify as csvStringify } from 'csv-stringify/browser/esm/sync';
import sortBy from 'lodash/sortBy';
import type { ICueSheet, ITrack } from 'cue-parser/lib/types';

import { formatDuration } from './util/duration';
import { invertSegments, sortSegments } from './segments';
import { GetFrameCount, SegmentBase } from './types';
import parseCmx3600 from './cmx3600';

export const getTimeFromFrameNum = (detectedFps: number, frameNum: number) => frameNum / detectedFps;

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

export function parseCsvTime(str: string) {
  const parsed = parseTime(str.trim());
  return parsed?.time;
}

export const getFrameValParser = (fps: number) => (str: string) => {
  if (str === '') return undefined;
  const frameCount = parseFloat(str);
  return getTimeFromFrameNum(fps, frameCount);
};

export async function parseCsv(csvStr: string, parseTimeFn: (a: string) => number | undefined) {
  const rows = csvParse(csvStr, {}) as [string, string, string][];
  if (rows.length === 0) throw new Error(i18n.t('No rows found'));
  if (!rows.every((row) => row.length === 3)) throw new Error(i18n.t('One or more rows does not have 3 columns'));

  const mapped = rows
    .map(([start, end, name]) => ({
      start: parseTimeFn(start) ?? 0,
      end: parseTimeFn(end),
      name: name.trim(),
    }));

  if (!mapped.every(({ start, end }) => (
    !Number.isNaN(start)
    && (end === undefined || !Number.isNaN(end))
  ))) {
    console.log(mapped);
    throw new Error(i18n.t('Invalid start or end value. Must contain a number of seconds'));
  }

  return mapped;
}

export async function parseCutlist(clStr: string) {
  // first parse INI-File into "iniValue" object
  const regex = {
    section: /^\s*\[\s*([^\]]*)\s*]\s*$/,
    param: /^\s*([^=]+?)\s*=\s*(.*?)\s*$/,
    comment: /^\s*;.*$/,
  };
  const iniValue: Record<string, string | undefined | Record<string, string | undefined>> = {};

  const lines = clStr.split(/[\n\r]+/);
  let section: string | undefined;
  lines.forEach((line) => {
    if (regex.comment.test(line)) {
      return;
    }
    if (regex.param.test(line)) {
      const match = line.match(regex.param) || [];
      const [, key, value] = match;
      if (key) {
        if (section) {
          const sectionObj = iniValue[section];
          invariant(sectionObj != null && typeof sectionObj !== 'string');
          sectionObj[key] = value;
        } else {
          iniValue[key] = value;
        }
      }
    } else if (regex.section.test(line)) {
      const match = line.match(regex.section) || [];
      const [, sectionMatch] = match;
      if (sectionMatch) {
        iniValue[sectionMatch] = {};
        section = sectionMatch;
      }
    } else if (line.length === 0 && section) {
      section = undefined;
    }
  });

  // end INI-File parse

  const cutArr: { start: number, end: number, name: string }[] = [];
  for (let i = 0; ; i += 1) {
    const cutEntry = iniValue[`Cut${i}`];
    if (cutEntry && typeof cutEntry !== 'string') {
      const start = parseFloat(cutEntry['Start']!);
      const end = Math.round((start + parseFloat(cutEntry['Duration']!) + Number.EPSILON) * 100) / 100;
      invariant(!Number.isNaN(start), 'Invalid Start');
      invariant(!Number.isNaN(end), 'Invalid End');
      cutArr.push({
        start,
        end,
        name: `Cut ${i}`,
      });
    } else {
      break;
    }
  }

  return cutArr;
}

export async function parseMplayerEdl(text: string) {
  const allRows = text.split('\n').flatMap((line) => {
    const match = line.match(/^\s*(\S+)\s+(\S+)\s+([0-3])\s*$/);
    if (!match) return [];
    const start = parseFloat(match[1]!);
    const end = parseFloat(match[2]!);
    const type = parseInt(match[3]!, 10);
    if (Number.isNaN(start) || Number.isNaN(end)) return [];
    if (start < 0 || end < 0 || start >= end) return [];
    return [{ start, end, type }];
  });

  const cutAwaySegments = allRows.filter((row) => row.type === 0);
  const muteSegments = allRows.filter((row) => row.type === 1);
  const sceneMarkers = allRows.filter((row) => row.type === 2);
  const commercialBreaks = allRows.filter((row) => row.type === 3);

  const inverted = invertSegments(sortSegments(cutAwaySegments), true, true);

  const map = (segments: SegmentBase[], name: string, type: 0 | 1 | 2 | 3) => segments.map(({ start, end }) => ({ start, end, name, tags: { mplayerEdlType: String(type) } }));

  const out = [
    ...map(inverted, 'Cut', 0),
    ...map(muteSegments, 'Mute', 1),
    ...map(sceneMarkers, 'Scene Marker', 2),
    ...map(commercialBreaks, 'Commercial Break', 3),
  ];
  if (out.length === 0) throw new Error(i18n.t('Invalid EDL data found'));
  return out;
}

export async function parseEdlCmx3600(text: string, fps: number) {
  const cmx = parseCmx3600(text);

  const parseTimecode = (t: string) => {
    const match = t.match(/^(\d+)[:;](\d+)[:;](\d+)[:;](\d+)$/);
    invariant(match, `Invalid EDL line: ${t}`);
    const hours = parseInt(match[1]!, 10);
    const minutes = parseInt(match[2]!, 10);
    const seconds = parseInt(match[3]!, 10);
    const frames = parseInt(match[4]!, 10);
    return Duration.fromObject({ hours, minutes, seconds: seconds + (frames / fps) }).as('seconds');
  };

  return cmx.events.map((event) => ({
    start: parseTimecode(event.sourceIn),
    end: parseTimecode(event.sourceOut),
    name: event.eventNumber,
    tags: { reel: event.reelNumber, trackType: event.trackType, transition: event.transition },
  }));
}

export async function parseEdl(text: string, fps: number) {
  // trim because it might have a BOM
  if (text.trim().startsWith('TITLE: ')) return parseEdlCmx3600(text, fps);
  return parseMplayerEdl(text);
}

export function parseCuesheet(cuesheet: ICueSheet) {
  // There are 75 such frames per second of audio.
  // https://en.wikipedia.org/wiki/Cue_sheet_(computing)
  const fps = 75;

  const { tracks } = cuesheet.files![0]!;

  function getTime(track: ITrack) {
    const index = track.indexes![0];
    if (!index) return undefined;
    const { time } = index;
    if (!time) return undefined;

    return (time.min * 60) + time.sec + time.frame / fps;
  }

  return tracks!.map((track, i) => {
    const nextTrack = tracks![i + 1];
    const end = nextTrack && getTime(nextTrack);

    return { name: track.title, start: getTime(track) ?? 0, end, tags: { performer: track.performer, title: track.title } };
  });
}

// See https://github.com/mifi/lossless-cut/issues/993
export function parsePbf(buf: Buffer) {
  const text = buf.toString('utf16le');

  return text.split('\n').flatMap((line) => {
    const match = line.match(/^\d+=(\d+)\*([^*]+)*([^*]+)?/);
    if (match) return [{ start: parseInt(match[1]!, 10) / 1000, name: match[2] }];
    return [];
  });
}

// https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/FinalCutPro_XML/VersionsoftheInterchangeFormat/VersionsoftheInterchangeFormat.html
export function parseXmeml(xmlStr: string) {
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

  // todo
  const mainTrack: { clipitem: { in: number, out: number, rate: { timebase: number } }[] } = Array.isArray(sequence.media.video.track) ? sequence.media.video.track[0] : sequence.media.video.track;

  return mainTrack.clipitem.map((item) => ({ start: item.in / item.rate.timebase, end: item.out / item.rate.timebase }));
}

export function parseFcpXml(xmlStr: string) {
  const xml = new XMLParser({ ignoreAttributes: false }).parse(xmlStr);

  const { fcpxml } = xml;
  if (!fcpxml) throw new Error('Root element <fcpxml> not found in file');

  function getTime(str: string) {
    const match = str.match(/(\d+)\/(\d+)s/);
    if (!match) throw new Error('Invalid attribute');
    return parseInt(match[1]!, 10) / parseInt(match[2]!, 10);
  }

  // todo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (fcpxml.library.event.project.sequence.spine['asset-clip'] as any[]).map((assetClip) => {
    const start = getTime(assetClip['@_start']);
    const duration = getTime(assetClip['@_duration']);
    const end = start + duration;
    return { start, end };
  });
}

export function parseYouTube(str: string) {
  function parseLine(lineStr: string) {
    const timeParsed = parseTime(lineStr);
    if (timeParsed == null) return undefined;

    const { time, rest } = timeParsed;

    const nameMatch = rest.match(/^[\s-]+([^\n]*)$/);
    if (!nameMatch) return undefined;

    const [, name] = nameMatch;

    return { time, name };
  }

  const lines = str.split(/\r?\n/).map((line) => parseLine(line)).flatMap((line) => (line ? [line] : []));

  const linesSorted = sortBy(lines, (l) => l.time);

  const edl = linesSorted.map((line, i) => {
    const nextLine = linesSorted[i + 1];
    return { start: line.time, end: nextLine?.time, name: line.name };
  });

  return edl.filter((ed) => ed.start !== ed.end);
}

export function formatYouTube(segments: { start: number, name?: string }[]) {
  return segments.map((segment) => {
    const timeStr = formatDuration({ seconds: segment.start, showFraction: false, shorten: true });
    const namePart = segment.name ? ` ${segment.name}` : '';
    return `${timeStr}${namePart}`;
  }).join('\n');
}

// because null/undefined is also valid values (start/end of timeline)
const safeFormatDuration = (duration: number | undefined) => (duration != null ? formatDuration({ seconds: duration }) : '');

export const formatSegmentsTimes = (cutSegments: SegmentBase[]) => cutSegments.map(({ start, end, name }) => [
  safeFormatDuration(start),
  safeFormatDuration(end),
  name,
]);

export async function formatCsvFrames({ cutSegments, getFrameCount }: { cutSegments: SegmentBase[], getFrameCount: GetFrameCount }) {
  const safeFormatFrameCount = (seconds: number | undefined) => (seconds != null ? getFrameCount(seconds) : '');

  const formatted = cutSegments.map(({ start, end, name }) => [
    safeFormatFrameCount(start),
    safeFormatFrameCount(end),
    name,
  ]);

  return csvStringify(formatted);
}

export async function formatCsvSeconds(cutSegments: SegmentBase[]) {
  const rows = cutSegments.map(({ start, end, name }) => [start, end, name]);
  return csvStringify(rows);
}

export async function formatCsvHuman(cutSegments: SegmentBase[]) {
  return csvStringify(formatSegmentsTimes(cutSegments));
}

export async function formatTsv(cutSegments: SegmentBase[]) {
  return csvStringify(formatSegmentsTimes(cutSegments), { delimiter: '\t' });
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
  const ret: { start: number, end: number, lines: string[], index: number | undefined }[] = [];

  // working state
  let subtitleIndexAt: number | undefined;
  let start: number | undefined;
  let end: number | undefined;
  let lines: string[] = [];

  const flush = () => {
    if (start != null && end != null && lines.length > 0) {
      ret.push({ start, end, lines, index: subtitleIndexAt });
    }
    start = undefined;
    end = undefined;
    subtitleIndexAt = undefined;
    lines = [];
  };

  // eslint-disable-next-line no-restricted-syntax
  for (const lineRaw of text.trim().split(/\r?\n/)) {
    const line = lineRaw.trim();
    if (line === '') {
      flush();
    } else if (subtitleIndexAt != null && subtitleIndexAt > 0) {
      const match = line.match(/^(\d+:\d+:\d+[,.]\d+\s+)-->(\s+\d+:\d+:\d+[,.]\d+)$/);
      if (match) {
        const fixComma = (v: string | undefined) => v!.replaceAll(',', '.');
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

export function parseSrtToSegments(text: string) {
  return parseSrt(text).map(({ start, end, lines, index }) => ({
    start,
    end,
    name: lines.join('\r\n'),
    tags: { index: index != null ? String(index) : undefined },
  }));
}

export function formatSrt(segments: SegmentBase[]) {
  return segments.reduce((acc, segment, index) => `${acc}${index > 0 ? '\r\n' : ''}${index + 1}\r\n${formatDuration({ seconds: segment.start }).replaceAll('.', ',')} --> ${formatDuration({ seconds: segment.end }).replaceAll('.', ',')}\r\n${segment.name || '-'}\r\n`, '');
}

export function parseGpsLine(line: string) {
  const gpsMatch = line.match(/^\s*([^,]+),\s*SS\s+([^,]+),\s*ISO\s+([^,]+),\s*EV\s+([^,]+)(?:,\s*DZOOM\s+([^,]+))?,\s*GPS\s+\(([^,]+),\s*([^,]+),\s*([^,]+)\),\s*D\s+([^m]+)m,\s*H\s+([^m]+)m,\s*H\.S\s+([^m]+)m\/s,\s*V\.S\s+([^m]+)m\/s\s*$/);
  if (!gpsMatch) return undefined;
  return {
    f: gpsMatch[1]!,
    ss: parseFloat(gpsMatch[2]!),
    iso: parseInt(gpsMatch[3]!, 10),
    ev: parseFloat(gpsMatch[4]!),
    dzoom: gpsMatch[5] != null ? parseFloat(gpsMatch[5]) : undefined,
    lat: parseFloat(gpsMatch[6]!),
    lng: parseFloat(gpsMatch[7]!),
    alt: parseFloat(gpsMatch[8]!),
    distance: parseFloat(gpsMatch[9]!),
    height: parseFloat(gpsMatch[10]!),
    horizontalSpeed: parseFloat(gpsMatch[11]!),
    verticalSpeed: parseFloat(gpsMatch[12]!),
  };
}
