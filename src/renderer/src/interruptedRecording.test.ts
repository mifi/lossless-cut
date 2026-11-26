import { describe, expect, test } from 'vitest';

import { diagnoseRecording } from './interruptedRecording';

const ascii = (s: string) => new TextEncoder().encode(s);

function u32(n: number) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n);
  return b;
}

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((acc, p) => acc + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

const box = (type: string, payload: Uint8Array) => concat(u32(payload.length + 8), ascii(type), payload);
const ftyp = box('ftyp', concat(ascii('isom'), new Uint8Array(4)));
const media = new Uint8Array(5000).fill(7);
const moov = box('moov', box('mvhd', new Uint8Array(100)));

const diagnose = (b: Uint8Array) => diagnoseRecording(b, b, b.length);

describe('diagnoseRecording', () => {
  test('healthy file', () => {
    expect(diagnose(concat(ftyp, box('mdat', media), moov))).toBeUndefined();
  });

  test('recording cut off before the moov was written', () => {
    expect(diagnose(concat(ftyp, u32(1_000_000), ascii('mdat'), media))).toStrictEqual({ damage: 'index-missing', mediaBytes: 5000 });
  });

  test('mdat size zeroed, moov still at the end', () => {
    expect(diagnose(concat(ftyp, u32(0), ascii('mdat'), media, moov))).toStrictEqual({ damage: 'header-damaged', mediaBytes: 5000 + moov.length });
  });

  test('moov first, file cut short: plays up to the cut', () => {
    expect(diagnose(concat(ftyp, moov, u32(1_000_000), ascii('mdat'), media))).toBeUndefined();
  });

  test('not an mp4', () => {
    expect(diagnose(ascii('hello, not a video'))).toBeUndefined();
  });
});
