// Muxers implemented by ffmpeg's movenc.c, i.e. the ones that accept `-movflags`.
// Note: deliberately not util/streams.ts `isMov`, which is a narrower, UI oriented list.
const movencFormats = new Set(['3g2', '3gp', 'f4v', 'ipod', 'ismv', 'mov', 'mp4', 'psp']);

// ffmpeg tolerates private options belonging to a different muxer, but they add noise to the command line
// that we log, show in "Last commands" and include in error reports - which makes troubleshooting harder.
// If the output format is unknown, ffmpeg infers the muxer from the file extension, so keep the flags to be safe.
export function getMovFlags({ outFormat, preserveMovData, movFastStart, hasAttachedPicture }: { outFormat: string | undefined, preserveMovData: boolean, movFastStart: boolean, hasAttachedPicture: boolean }) {
  if (outFormat != null && !movencFormats.has(outFormat)) return [];

  const flags: string[] = [];

  // https://video.stackexchange.com/a/26084/29486
  // https://github.com/mifi/lossless-cut/issues/331#issuecomment-623401794
  // FFmpeg's mdta metadata mode silently drops attached pictures.
  if (preserveMovData && !hasAttachedPicture) flags.push('use_metadata_tags');

  // https://github.com/mifi/lossless-cut/issues/347
  if (movFastStart) flags.push('+faststart');

  if (flags.length === 0) return [];
  return flags.flatMap((flag) => ['-movflags', flag]);
}
