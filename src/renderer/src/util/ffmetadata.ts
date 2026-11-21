import type { Chapter } from '../types';

// https://ffmpeg.org/ffmpeg-formats.html#Metadata-2
// "Metadata keys or values containing special characters ('=', ';', '#', '\' and a newline) must be escaped with a backslash '\'."
// CRLF is collapsed to a single (escaped) newline, e.g. for segment names imported from SRT
export const escapeFfmetadataValue = (value: string) => value.replaceAll('\r\n', '\n').replaceAll(/[=;#\\\n]/g, String.raw`\$&`);

export const getChaptersFfmetadata = (chapters: Chapter[]) => chapters.map(({ start, end, name }) => (
  `[CHAPTER]\nTIMEBASE=1/1000\nSTART=${Math.floor(start * 1000)}\nEND=${Math.floor(end * 1000)}\ntitle=${escapeFfmetadataValue(name || '')}`
)).join('\n\n');
