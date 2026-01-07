# Public types

## SourceFile

```ts
/**
 * Properties of a source file made available to the user in the export file name template.
 * All times are expressed in milliseconds since the POSIX Epoch.
 */
interface SourceFile {
    /** The file's name without the file system path. */
    name: string;
    /** The full filesystem path of the file. */
    path: string;
    /** File size in bytes. */
    size?: number | bigint | undefined;
    /** The last time this file was accessed. */
    atime?: number | undefined;
    /** The last time this file was modified. */
    mtime?: number | undefined;
    /** The last time the file status was changed. */
    ctime?: number | undefined;
    /** The creation time of this file. */
    birthtime?: number | undefined;
}
```

## FileNameTemplateContext

```ts
/**
 * The global context made available to the user in the export file name template.
 * See docs/file-name-template.md documentation for details.
 */
interface FileNameTemplateContext {
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
```

## Segment

```ts
/**
 * See https://github.com/mifi/lossless-cut/blob/master/docs/expressions.md
 */
interface Segment {
    /** Index of the segment in the segment list, starting with 0 */
    index: number;
    /** Name of the segment */
    label: string;
    /** Segment start time in seconds */
    start: number;
    /** Segment end time in seconds, or undefined for markers */
    end?: number | undefined;
    /** Duration in seconds (effectively `end` minus `start` or 0 for markers) */
    duration: number;
    /** Tags associated with this segment */
    tags: Record<string, string>;
}
```

