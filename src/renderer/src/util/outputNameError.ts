const invalidFileNameCharRegex = /[<>:"/\\|?*]/;

// ffmpeg prints e.g. "[out#0/matroska @ ...] Error opening output E:\foo\bar.mkv: Invalid argument"
// when it fails to create the output file, e.g. because the file name contains characters that are
// not allowed on this file system (see https://github.com/mifi/lossless-cut/issues/2986)
export function getInvalidOutputPath(stderr: string) {
  const candidates = stderr.split(/\r?\n/)
    .map((line) => line.match(/Error opening output(?: file)? (.*): Invalid argument\.?$/))
    .filter((match): match is RegExpMatchArray => !!match && (match[1]!.includes('/') || match[1]!.includes('\\')))
    .map((match) => match[1]!.trim());
  return candidates.length > 0 ? candidates.at(-1) : undefined;
}

// Characters that are invalid in Windows file names
export function getInvalidFileNameChars(filePath: string) {
  const fileName = filePath.split(/[\\/]/).pop() ?? filePath;
  return [...new Set([...fileName].filter((char) => invalidFileNameCharRegex.test(char)))];
}
