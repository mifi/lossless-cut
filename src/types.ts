export interface SegmentBase {
  start?: number,
  end?: number,
}

export interface Segment extends SegmentBase {
  name?: string,
}

export interface InverseSegment extends SegmentBase {
  segId?: string,
}

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
