// ⚠️ These types are a the contract with the user, through the documentation.
// ‼️ DO NOT change these types without considering the user impact!
// See https://github.com/mifi/lossless-cut/blob/master/expressions.md
// https://github.com/mifi/lossless-cut/blob/master/docs.md#custom-exported-file-names

/**
 * Properties of a source file made available to the user in the export file name template.
 * All times are expressed in milliseconds since the POSIX Epoch.
 */
export interface SourceFile {
  /** The file's name without the file system path. */
  name: string,
  /** The full filesystem path of the file. */
  path: string,
  /** File size in bytes. */
  size?: number | bigint | undefined, // File size in bytes
  /** The last time this file was accessed. */
  atime?: number | undefined,
  /** The last time this file was modified. */
  mtime?: number | undefined,
  /** The last time the file status was changed. */
  ctime?: number | undefined,
  /** The creation time of this file. */
  birthtime?: number | undefined,
}

/**
 * The global context made available to the user in the export file name template.
 */
export interface FileNameTemplateContext {
  FILENAME: string;
  FILES: SourceFile[];
  SEG_SUFFIX?: string | undefined;
  EXT: string;
  SEG_NUM_INT?: number | undefined;
  SEG_NUM?: string | undefined;
  SELECTED_SEG_NUM_INT?: number | undefined;
  SELECTED_SEG_NUM?: string | undefined;
  SEG_LABEL?: string | string[] | undefined;
  EPOCH_MS: number;
  CUT_FROM?: string | undefined;
  CUT_FROM_NUM?: number | undefined;
  CUT_TO?: string | undefined;
  CUT_TO_NUM?: number | undefined;
  CUT_DURATION?: string | undefined;
  SEG_TAGS?: Record<string, string> | undefined;
  FILE_EXPORT_COUNT?: number | undefined;
  EXPORT_COUNT?: number | undefined;
}
