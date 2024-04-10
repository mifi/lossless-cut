import type { MenuItem, MenuItemConstructorOptions } from 'electron';


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

export interface ApparentSegmentBase extends SegmentColorIndex {
  start: number,
  end: number,
}


export type SegmentTags = Record<string, unknown>;

export type EditingSegmentTags = Record<string, SegmentTags>

export interface StateSegment extends SegmentBase, SegmentColorIndex {
  name: string;
  segId: string;
  tags?: SegmentTags | undefined;
}

export interface Segment extends SegmentBase {
  name?: string | undefined,
}

export interface ApparentCutSegment extends ApparentSegmentBase {
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

export type EdlFileType = 'csv' | 'csv-frames' | 'xmeml' | 'fcpxml' | 'dv-analyzer-summary-txt' | 'cue' | 'pbf' | 'mplayer' | 'srt' | 'llc';

export type EdlImportType = 'youtube' | EdlFileType;

export type EdlExportType = 'csv' | 'tsv-human' | 'csv-human' | 'csv-frames' | 'srt' | 'llc';

export type TunerType = 'wheelSensitivity' | 'keyboardNormalSeekSpeed' | 'keyboardSeekAccFactor';

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
