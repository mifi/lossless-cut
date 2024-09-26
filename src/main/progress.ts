// eslint-disable-next-line import/prefer-default-export
export function parseFfmpegProgressLine({ line, customMatcher, duration: durationIn }: {
  line: string,
  customMatcher?: ((a: string) => void) | undefined,
  duration: number | undefined,
}) {
  let match = line.match(/frame=\s*\S+\s+fps=\s*\S+\s+q=\s*\S+\s+(?:size|Lsize)=\s*\S+\s+time=\s*(\S+)\s+/);
  if (!match) {
    // Audio only looks like this: "size=  233422kB time=01:45:50.68 bitrate= 301.1kbits/s speed= 353x    "
    match = line.match(/(?:size|Lsize)=\s*\S+\s+time=\s*(\S+)\s+/);
  }
  if (!match) {
    customMatcher?.(line);
    return undefined;
  }

  if (durationIn == null) return undefined;
  const duration = Math.max(0, durationIn);
  if (duration === 0) return undefined;

  const timeStr = match[1];
  // console.log(timeStr);
  const match2 = timeStr!.match(/^(-?)(\d+):(\d+):(\d+)\.(\d+)$/);
  if (!match2) throw new Error(`Invalid time from ffmpeg progress ${timeStr}`);

  const sign = match2[1];

  if (sign === '-') {
    // For some reason, ffmpeg sometimes gives a negative progress, e.g. "-00:00:06.46"
    // let's just ignore those lines
    return undefined;
  }

  const h = parseInt(match2[2]!, 10);
  const m = parseInt(match2[3]!, 10);
  const s = parseInt(match2[4]!, 10);
  const cs = parseInt(match2[5]!, 10);
  const time = (((h * 60) + m) * 60 + s) + cs / 100;
  // console.log(time);

  const progressTime = Math.max(0, time);
  // console.log(progressTime);

  const progress = Math.min(progressTime / duration, 1); // sometimes progressTime will be greater than cutDuration
  return progress;
}
