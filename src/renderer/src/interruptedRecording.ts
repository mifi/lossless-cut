// Tells an interrupted MP4/MOV recording (camera lost power or the card was pulled before the index was written)
// apart from a file that is really unsupported. Port of the top-level box check in https://crates.io/crates/vidfix-detect

export type RecordingDamage = 'index-missing' | 'header-damaged';

export interface RecordingDiagnosis {
  damage: RecordingDamage,
  mediaBytes: number,
}

const WINDOW = 4 * 1024 * 1024;

const fourcc = (b: Uint8Array, o: number) => String.fromCodePoint(b[o]!, b[o + 1]!, b[o + 2]!, b[o + 3]!);
const isType = (t: string) => /^[\w ©]{4}$/.test(t);

function readAt(head: Uint8Array, tail: Uint8Array, fileLen: number, offset: number, n: number) {
  if (offset + n <= head.length) return head.subarray(offset, offset + n);
  const tailStart = fileLen - tail.length;
  if (offset >= tailStart && offset + n <= fileLen) return tail.subarray(offset - tailStart, offset - tailStart + n);
  return undefined;
}

/** A complete moov at the very end of the file, after `after` (when the mdat size field can't be followed) */
function findTrailingMoov(tail: Uint8Array, fileLen: number, after: number) {
  const tailStart = fileLen - tail.length;
  for (let i = 4; i + 4 <= tail.length; i += 1) {
    if (fourcc(tail, i) !== 'moov' || tailStart + i - 4 < after) continue;
    const size = new DataView(tail.buffer, tail.byteOffset + i - 4, 4).getUint32(0);
    if (size >= 8 && tailStart + i - 4 + size === fileLen) return true;
  }
  return false;
}

/** `head` and `tail` are the first and last bytes of the file (the same bytes when the file is small). */
export function diagnoseRecording(head: Uint8Array, tail: Uint8Array, fileLen: number): RecordingDiagnosis | undefined {
  let offset = 0;
  let moovComplete = false;
  let mdat: { payloadStart: number, end: number, sizeZeroed: boolean } | undefined;

  while (offset + 8 <= fileLen) {
    const h = readAt(head, tail, fileLen, offset, 16) ?? readAt(head, tail, fileLen, offset, 8);
    if (h == null) break;
    const view = new DataView(h.buffer, h.byteOffset, h.byteLength);
    const type = fourcc(h, 4);
    if (!isType(type)) break;
    let size = view.getUint32(0);
    let header = 8;
    let sizeZeroed = size === 0;
    if (size === 1) {
      if (h.length < 16) break;
      size = Number(view.getBigUint64(8));
      header = 16;
      sizeZeroed = size === 0; // 64-bit placeholder that was never patched
    }
    if (sizeZeroed) size = fileLen - offset;
    if (size < header) break;

    const end = offset + size;
    if (type === 'moov' && end <= fileLen) moovComplete = true;
    if (type === 'mdat') {
      const payloadEnd = Math.min(end, fileLen);
      if (mdat == null || payloadEnd - offset > mdat.end - mdat.payloadStart) {
        mdat = { payloadStart: offset + header, end: payloadEnd, sizeZeroed };
      }
      if (sizeZeroed) {
        // The moov may still be at the end of the file, behind the media data
        moovComplete ||= findTrailingMoov(tail, fileLen, offset + header);
        break;
      }
    }
    if (end > fileLen) break;
    offset = end;
  }

  if (mdat == null) return undefined;
  const mediaBytes = Math.max(0, mdat.end - mdat.payloadStart);
  if (mediaBytes === 0) return undefined;
  if (!moovComplete) return { damage: 'index-missing', mediaBytes };
  if (mdat.sizeZeroed) return { damage: 'header-damaged', mediaBytes };
  return undefined;
}

export async function diagnoseRecordingFile(filePath: string): Promise<RecordingDiagnosis | undefined> {
  const { open } = window.require('node:fs/promises');
  const fh = await open(filePath, 'r');
  try {
    const { size } = await fh.stat();
    const n = Math.min(size, WINDOW);
    const head = new Uint8Array(n);
    const tail = new Uint8Array(n);
    await fh.read(head, 0, n, 0);
    await fh.read(tail, 0, n, size - n);
    return diagnoseRecording(head, tail, size);
  } finally {
    await fh.close();
  }
}
