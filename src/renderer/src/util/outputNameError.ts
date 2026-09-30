const invalidFileNameCharRegex = /[<>:"/\\|?*]/;

type Stdio = string | Uint8Array | undefined | null;

const getStdioString = (stdio: Stdio) => (stdio instanceof Uint8Array ? Buffer.from(stdio).toString('utf8') : stdio ?? '');

// ffmpeg prints e.g. "[out#0/matroska @ ...] Error opening output E:\foo\bar.mkv: Invalid argument"
// when it fails to create the output file, e.g. because the file name contains characters that are
// not allowed on this file system (see https://github.com/mifi/lossless-cut/issues/2986)
export function getInvalidOutputPath(stderr: Stdio) {
  const candidates = getStdioString(stderr).split(/\r?\n/)
    .map((line) => line.match(/Error opening output(?: file)? (.*): Invalid argument\.?$/))
    .filter((match): match is RegExpMatchArray => !!match && (match[1]!.includes('/') || match[1]!.includes('\\')))
    .map((match) => match[1]!.trim());
  return candidates.length > 0 ? candidates.at(-1) : undefined;
}

export function getInvalidFileNameChars(filePath: string, platform: NodeJS.Platform = window.process.platform) {
  // These Windows restrictions do not apply to POSIX file names. An ffmpeg
  // "Invalid argument" error alone does not prove these characters caused it.
  if (platform !== 'win32') return [];

  const fileName = filePath.split(/[\\/]/).pop() ?? filePath;
  return [...new Set([...fileName].filter((char) => invalidFileNameCharRegex.test(char)))];
}
