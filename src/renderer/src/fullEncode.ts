import type { FFprobeStream } from '../../common/ffprobe';
import type { PreserveMetadata } from '../../common/types';
import { formatFfmpegNumber } from '../../common/util';

// Decode before seeking, and encode every output frame. In particular, do not
// splice a copied GOP into the output or look for a keyframe after the cutpoint.
export default function getFullEncodeArgs({ filePath, outPath, cutFrom, cutTo, streams, rotation, preserveMetadata, preserveChapters, chaptersPath, metadata }: {
  filePath: string,
  outPath: string,
  cutFrom: number,
  cutTo: number,
  streams: (Pick<FFprobeStream, 'index' | 'codec_type'> & { disposition?: Pick<FFprobeStream['disposition'], 'attached_pic'> })[],
  rotation?: number | undefined,
  preserveMetadata: PreserveMetadata,
  preserveChapters: boolean,
  chaptersPath?: string | undefined,
  metadata: Record<string, string>,
}) {
  const selectedStreams = streams.filter((s) => s.codec_type === 'audio' || (s.codec_type === 'video' && !s.disposition?.attached_pic));
  if (selectedStreams.length === 0) throw new Error('Select at least one video or audio track for full re-encoding');
  if (!Number.isFinite(cutFrom) || !Number.isFinite(cutTo) || cutFrom < 0 || cutTo <= cutFrom) throw new Error('Invalid segment times for full re-encoding');

  return [
    '-hide_banner',
    ...(rotation != null ? ['-display_rotation:v:0', String(360 - rotation)] : []),
    '-i', filePath,
    ...(chaptersPath != null ? ['-f', 'ffmetadata', '-i', chaptersPath] : []),
    '-ss', formatFfmpegNumber(cutFrom),
    '-t', formatFfmpegNumber(cutTo - cutFrom),
    ...selectedStreams.flatMap((s) => ['-map', `0:${s.index}`]),
    '-map_metadata', preserveMetadata === 'default' ? '0' : '-1',
    '-map_chapters', chaptersPath != null ? '1' : (preserveChapters ? '0' : '-1'),
    ...Object.entries(metadata).flatMap(([key, value]) => ['-metadata', `${key}=${value}`]),
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-threads', '4',
    // H.264 yuv420p needs even dimensions; leave even-sized sources unchanged.
    ...(selectedStreams.some((s) => s.codec_type === 'video') ? ['-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-pix_fmt', 'yuv420p', '-fps_mode', 'vfr'] : []),
    '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart',
    '-f', 'mp4', '-y', outPath,
  ];
}
