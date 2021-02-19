import fastXmlParser from 'fast-xml-parser';
import i18n from 'i18next';

import csvParse from 'csv-parse';
import pify from 'pify';
import sortBy from 'lodash/sortBy';

import { formatDuration } from './util/duration';

const csvParseAsync = pify(csvParse);

export async function parseCsv(str) {
  const rows = await csvParseAsync(str, {});
  if (rows.length === 0) throw new Error(i18n.t('No rows found'));
  if (!rows.every(row => row.length === 3)) throw new Error(i18n.t('One or more rows does not have 3 columns'));

  const mapped = rows
    .map(([start, end, name]) => ({
      start: start === '' ? undefined : parseFloat(start, 10),
      end: end === '' ? undefined : parseFloat(end, 10),
      name,
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

export function parseCuesheet(cuesheet) {
  // There are 75 such frames per second of audio.
  // https://en.wikipedia.org/wiki/Cue_sheet_(computing)
  const fps = 75;

  const { tracks } = cuesheet.files[0];

  function parseTime(track) {
    const index = track.indexes[0];
    if (!index) return undefined;
    const { time } = index;
    if (!time) return undefined;

    return (time.min * 60) + time.sec + time.frame / fps;
  }

  return tracks.map((track, i) => {
    const nextTrack = tracks[i + 1];
    const end = nextTrack && parseTime(nextTrack);

    return { name: track.title, start: parseTime(track), end };
  });
}


export function parsePbf(text) {
  const chapters = text.split('\n').map((line) => {
    const match = line.match(/^[0-9]+=([0-9]+)\*([^*]+)*/);
    if (match) return { time: parseInt(match[1], 10) / 1000, name: match[2] };
    return undefined;
  }).filter((it) => it);

  const out = [];
  chapters.forEach((chapter, i) => {
    const nextChapter = chapters[i + 1];
    out.push({ start: chapter.time, end: nextChapter && nextChapter.time, name: chapter.name });
  });
  return out;
}

// https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/FinalCutPro_XML/VersionsoftheInterchangeFormat/VersionsoftheInterchangeFormat.html
export function parseXmeml(xmlStr) {
  const xml = fastXmlParser.parse(xmlStr);
  // TODO maybe support media.audio also?
  return xml.xmeml.project.children.sequence.media.video.track.clipitem.map((item) => ({ start: item.start / item.rate.timebase, end: item.end / item.rate.timebase }));
}

export function parseYouTube(str) {
  const regex = /(?:([0-9]{2,}):)?([0-9]{1,2}):([0-9]{1,2})(?:\.([0-9]{3}))?[^\S\n]+([^\n]*)\n/g;

  const lines = [];

  function parseLine(match) {
    if (!match) return undefined;
    const [, hourStr, minStr, secStr, msStr, name] = match;
    const hour = hourStr != null ? parseInt(hourStr, 10) : 0;
    const min = parseInt(minStr, 10);
    const sec = parseInt(secStr, 10);
    const ms = msStr != null ? parseInt(msStr, 10) : 0;

    const time = (((hour * 60) + min) * 60 + sec) + ms / 1000;

    return { time, name };
  }

  let m;
  // eslint-disable-next-line no-cond-assign
  while ((m = regex.exec(`${str}\n`))) {
    lines.push(parseLine(m));
  }

  const linesSorted = sortBy(lines, (l) => l.time);

  const edl = linesSorted.map((line, i) => {
    const nextLine = linesSorted[i + 1];
    return { start: line.time, end: nextLine && nextLine.time, name: line.name };
  });

  return edl.filter((ed) => ed.start !== ed.end);
}

export function formatYouTube(segments) {
  return segments.map((segment) => {
    const timeStr = formatDuration({ seconds: segment.start, showMs: false, shorten: true });
    const namePart = segment.name ? ` ${segment.name}` : '';
    return `${timeStr}${namePart}`;
  }).join('\n');
}
