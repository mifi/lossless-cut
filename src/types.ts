export interface SegmentBase {
  start?: number | undefined,
  end?: number | undefined,
}

export interface ApparentSegmentBase {
  start: number,
  end: number,
}


export type SegmentTags = Record<string, string>;

export interface StateSegment extends SegmentBase {
  name: string;
  segId: string;
  segColorIndex?: number | undefined;
  tags?: SegmentTags | undefined;
}

export interface Segment extends SegmentBase {
  name?: string,
}

export interface ApparentCutSegment extends ApparentSegmentBase {
  segId?: string | undefined,
  tags?: SegmentTags | undefined;
}

export interface InverseSegment extends ApparentSegmentBase {
  segId?: string,
}

export interface SegmentToExport extends ApparentSegmentBase {
  name?: string | undefined;
  segId?: string | undefined;
  tags?: SegmentTags | undefined;
}

export type PlaybackMode = 'loop-segment-start-end' | 'loop-segment' | 'play-segment-once' | 'loop-selected-segments';

export type Html5ifyMode = 'fastest' | 'fast-audio-remux' | 'fast-audio' | 'fast' | 'slow' | 'slow-audio' | 'slowest';

export type EdlFileType = 'csv' | 'csv-frames' | 'xmeml' | 'fcpxml' | 'dv-analyzer-summary-txt' | 'cue' | 'pbf' | 'mplayer' | 'srt' | 'llc';

export type EdlImportType = 'youtube' | EdlFileType;

export type EdlExportType = 'csv' | 'tsv-human' | 'csv-human' | 'csv-frames' | 'srt' | 'llc';

export type TunerType = 'wheelSensitivity' | 'keyboardNormalSeekSpeed' | 'keyboardSeekAccFactor';

export interface Waveform {
  from: number,
  to: number,
  url: string,
}

export type FfmpegCommandLog = { command: string, time: Date }[];

export interface Thumbnail {
  time: number
  url: string
}

// todo types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FfprobeStream = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FfprobeFormat = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FfprobeChapter = any;
