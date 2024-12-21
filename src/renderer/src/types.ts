import type { MenuItem, MenuItemConstructorOptions } from 'electron';
import { z } from 'zod';
import { FFprobeChapter, FFprobeFormat, FFprobeStream } from '../../../ffprobe';


export interface ChromiumHTMLVideoElement extends HTMLVideoElement {
  videoTracks?: { id: string, selected: boolean }[]
}
export interface ChromiumHTMLAudioElement extends HTMLAudioElement {
  audioTracks?: { id: string, enabled: boolean }[]
}


export interface SegmentBase {
  start?: number | undefined,
  end?: number | undefined,
}

export interface SegmentColorIndex {
  segColorIndex: number,
}

export interface ApparentSegmentBase {
  start: number,
  end: number,
}

export interface ApparentSegmentWithColorIndex extends ApparentSegmentBase, SegmentColorIndex {}

export const openFilesActionArgsSchema = z.tuple([z.string().array()]);
export type OpenFilesActionArgs = z.infer<typeof openFilesActionArgsSchema>

export const goToTimecodeDirectArgsSchema = z.tuple([z.object({ time: z.string() })]);
export type GoToTimecodeDirectArgs = z.infer<typeof goToTimecodeDirectArgsSchema>

export const segmentTagsSchema = z.record(z.string(), z.string());

export type SegmentTags = z.infer<typeof segmentTagsSchema>

export type EditingSegmentTags = Record<string, SegmentTags>

export interface StateSegment extends SegmentBase, SegmentColorIndex {
  name: string;
  segId: string;
  tags?: SegmentTags | undefined;
}

export interface Segment extends SegmentBase {
  name?: string | undefined,
}

export interface ApparentCutSegment extends ApparentSegmentWithColorIndex {
  name: string;
  segId: string,
  tags?: SegmentTags | undefined;
}

export interface SegmentToExport {
  start: number,
  end: number,
  name?: string | undefined;
  segId?: string | undefined;
  tags?: SegmentTags | undefined;
}

export interface InverseCutSegment {
  start: number,
  end: number,
  segId: string;
}


export type PlaybackMode = 'loop-segment-start-end' | 'loop-segment' | 'play-segment-once' | 'loop-selected-segments';

export type EdlFileType = 'csv' | 'csv-frames' | 'cutlist' | 'xmeml' | 'fcpxml' | 'dv-analyzer-summary-txt' | 'cue' | 'pbf' | 'edl' | 'srt' | 'llc';

export type EdlImportType = 'youtube' | EdlFileType;

export type EdlExportType = 'csv' | 'tsv-human' | 'csv-human' | 'csv-frames' | 'srt' | 'llc';

export type TunerType = 'wheelSensitivity' | 'keyboardNormalSeekSpeed' | 'keyboardSeekSpeed2' | 'keyboardSeekSpeed3' | 'keyboardSeekAccFactor';

export interface RenderableWaveform {
  createdAt: Date,
  from: number,
  to: number,
  duration: number,
  url?: string,
}

export type FfmpegCommandLog = { command: string, time: Date }[];

export interface Thumbnail {
  time: number
  url: string
}

export type FormatTimecode = (a: { seconds: number, shorten?: boolean | undefined, fileNameFriendly?: boolean | undefined }) => string;
export type ParseTimecode = (val: string) => number | undefined;

export type GetFrameCount = (sec: number) => number | undefined;

export type UpdateSegAtIndex = (index: number, newProps: Partial<StateSegment>) => void;

export type ContextMenuTemplate = (MenuItemConstructorOptions | MenuItem)[];

export type ExportMode = 'segments_to_chapters' | 'merge' | 'merge+separate' | 'separate';

export type FilesMeta = Record<string, {
  streams: FFprobeStream[];
  formatData: FFprobeFormat;
  chapters: FFprobeChapter[];
}>

export type CopyfileStreams = {
  path: string;
  streamIds: number[];
}[]

export interface Chapter { start: number, end: number, name?: string | undefined }

export type LiteFFprobeStream = Pick<FFprobeStream, 'index' | 'codec_type' | 'codec_tag' | 'codec_name' | 'disposition' | 'tags' | 'sample_rate' | 'time_base'>;

export type AllFilesMeta = Record<string, {
  streams: LiteFFprobeStream[];
  formatData: FFprobeFormat;
  chapters: FFprobeChapter[];
}>

export type CustomTagsByFile = Record<string, Record<string, string>>;

export interface StreamParams {
  customTags?: Record<string, string>,
  disposition?: string,
  bsfH264Mp4toannexb?: boolean,
  bsfHevcMp4toannexb?: boolean,
}
export type ParamsByStreamId = Map<string, Map<number, StreamParams>>;
