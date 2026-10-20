// Generates an image for release announcements, see AGENTS.md "Release announcement"
// Usage: node script/releaseImage.ts <version> [--bg photo.jpg] [--out file.png] "highlight 1" "highlight 2" ...
import assert from 'node:assert';
import { parseArgs } from 'node:util';
import sharp from 'sharp';

const width = 1600;
const height = 900;

const { values: { bg, out }, positionals: [version, ...highlights] } = parseArgs({
  allowPositionals: true,
  options: { bg: { type: 'string' }, out: { type: 'string' } },
});
assert(version != null && highlights.length <= 3, 'Usage: releaseImage.ts <version> [--bg photo.jpg] [--out file.png] [up to 3 highlights]');

const escapeXml = (str: string) => str.replaceAll(/[<>&'"]/g, (c) => `&#${c.codePointAt(0)};`);

const font = 'Helvetica Neue, Helvetica, Arial, sans-serif';
const left = 110;

const overlay = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="shade" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#000" stop-opacity="0.85" />
      <stop offset="0.6" stop-color="#000" stop-opacity="0.55" />
      <stop offset="1" stop-color="#000" stop-opacity="0.15" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#shade)" />
  <text x="${left + 140}" y="205" font-family="${font}" font-size="64" font-weight="300" fill="#fff">LosslessCut</text>
  <text x="${left}" y="400" font-family="${font}" font-size="150" font-weight="700" fill="#fff">${escapeXml(version)}</text>
  ${highlights.map((highlight, i) => `<text x="${left}" y="${510 + i * 70}" font-family="${font}" font-size="44" fill="#fff" fill-opacity="0.92">• ${escapeXml(highlight)}</text>`).join('\n  ')}
  <text x="${left}" y="${height - 80}" font-family="${font}" font-size="36" fill="#fff" fill-opacity="0.75">losslesscut.app</text>
</svg>`;

// Without a photo, use a dark gradient in the app's colors
const background = bg != null
  ? sharp(bg).rotate().resize(width, height, { fit: 'cover' })
  : sharp(Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#1a1d29" /><stop offset="1" stop-color="#3b2a5c" /></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)" /></svg>`));

const icon = await sharp('src/renderer/src/icon.svg').resize(110, 110).png().toBuffer();

const outPath = out ?? `dist/release-${version}.png`;
await background
  .composite([{ input: Buffer.from(overlay) }, { input: icon, left, top: 125 }])
  .png()
  .toFile(outPath);
console.log('Wrote', outPath);
