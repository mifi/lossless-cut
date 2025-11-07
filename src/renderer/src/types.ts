import type { MenuItem, MenuItemConstructorOptions } from 'electron';
import { z } from 'zod';
import { FFprobeChapter, FFprobeFormat, FFprobeStream } from '../../../ffprobe';
import type { FileStream } from './ffmpeg';


export interface ChromiumHTMLVideoElement extends HTMLVideoElement {
  videoTracks?: { id: string, selected: boolean }[]
}
export interface ChromiumHTMLAudioElement extends HTMLAudioElement {
  audioTracks?: { id: string, enabled: boolean }[]
}

export const openFilesActionArgsSchema = z.tuple([z.string().array()]);
export type OpenFilesActionArgs = z.infer<typeof openFilesActionArgsSchema>

export const goToTimecodeDirectArgsSchema = z.tuple([z.object({ time: z.string() })]);
export type GoToTimecodeDirectArgs = z.infer<typeof goToTimecodeDirectArgsSchema>

export const segmentTagsSchema = z.record(z.string(), z.string());

export type SegmentTags = z.infer<typeof segmentTagsSchema>

export type EditingSegmentTags = Record<string, SegmentTags>

// todo remove some time in the future
export const llcProjectV1Schema = z.object({
  version: z.literal(1),
  mediaFileName: z.string().optional(),
  cutSegments: z.object({
    start: z.number().optional(),
    end: z.number().optional(),
    name: z.string(),
    tags: segmentTagsSchema.optional(),
  }).array(),
});

export const llcProjectV2Schema = z.object({
  version: z.literal(2),
  mediaFileName: z.string().optional(),
  cutSegments: z.object({
    start: z.number(),
    end: z.number().optional(),
    name: z.string(),
    tags: segmentTagsSchema.optional(),
    selected: z.boolean().optional(),
  }).array(),
});

export type LlcProject = z.infer<typeof llcProjectV2Schema>

export interface SegmentBase {
  start: number,
  end?: number | undefined,
  name?: string | undefined,
}

export interface DefiniteSegmentBase {
  start: number,
  end: number,
}

export interface SegmentColorIndex {
  segColorIndex: number,
}

export interface StateSegment extends SegmentBase, SegmentColorIndex {
  name: string;
  segId: string;
  tags?: SegmentTags | undefined;
  initial?: true,
  selected: boolean,
}

export interface SegmentToExport extends DefiniteSegmentBase {
  originalIndex: number,
  name?: string | undefined;
  tags?: SegmentTags | undefined;
}

export interface InverseCutSegment extends DefiniteSegmentBase {
  segId: string;
}


export type PlaybackMode = 'loop-segment-start-end' | 'loop-segment' | 'play-segment-once' | 'play-selected-segments' | 'loop-selected-segments';

export type EdlFileType = 'llc' | 'csv' | 'csv-frames' | 'cutlist' | 'xmeml' | 'fcpxml' | 'dv-analyzer-summary-txt' | 'cue' | 'pbf' | 'edl' | 'srt' | 'otio';

export type EdlImportType = 'youtube' | EdlFileType;

export type EdlExportType = 'csv' | 'tsv-human' | 'csv-human' | 'csv-frames' | 'srt' | 'llc';

export type TunerType = 'wheelSensitivity' | 'waveformHeight' | 'keyboardNormalSeekSpeed' | 'keyboardSeekSpeed2' | 'keyboardSeekSpeed3' | 'keyboardSeekAccFactor';

export interface WaveformBase {
  createdAt: Date,
}

export interface WaveformSlice extends WaveformBase {
  from: number,
  to: number,
  duration: number,
  url?: string, // undefined while rendering
}

export interface OverviewWaveform extends WaveformBase {
  url: string,
}

export type RenderableWaveform = WaveformSlice | OverviewWaveform;

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
  streams: FileStream[];
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

export interface BatchFile {
  path: string,
  name: string,
}

export type KeyboardLayoutMap = Map<string, string>;
