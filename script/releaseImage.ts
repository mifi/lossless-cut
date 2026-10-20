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

// Accent color: the photo's dominant color, or else a hue derived from the version, so every release looks a bit different
async function getAccentHue() {
  if (bg != null) {
    const { dominant: { r, g, b } } = await sharp(bg).stats();
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max - min > 20) {
      const d = max - min;
      let h = (r - g) / d + 4;
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      return Math.round((h * 60 + 360) % 360);
    }
  }
  return [...version!].reduce((acc, c) => (acc * 31 + c.codePointAt(0)!) % 360, 7);
}
const hue = await getAccentHue();
const accent = `hsl(${hue}, 80%, 65%)`;

const font = 'Helvetica Neue, Helvetica, Arial, sans-serif';
const left = 110;

const overlay = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="shade" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="hsl(${hue}, 60%, 6%)" stop-opacity="0.9" />
      <stop offset="0.6" stop-color="hsl(${hue}, 60%, 8%)" stop-opacity="0.6" />
      <stop offset="1" stop-color="hsl(${hue}, 60%, 10%)" stop-opacity="0.15" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#shade)" />
  <text x="${left + 140}" y="205" font-family="${font}" font-size="64" font-weight="300" fill="#fff">LosslessCut</text>
  <text x="${left}" y="400" font-family="${font}" font-size="150" font-weight="700" fill="${accent}">${escapeXml(version)}</text>
  ${highlights.map((highlight, i) => `<text x="${left}" y="${510 + i * 70}" font-family="${font}" font-size="44" fill="#fff" fill-opacity="0.92"><tspan fill="${accent}">•</tspan> ${escapeXml(highlight)}</text>`).join('\n  ')}
  <text x="${left}" y="${height - 80}" font-family="${font}" font-size="36" fill="#fff" fill-opacity="0.75">losslesscut.app</text>
</svg>`;

// Without a photo, use a dark gradient in the accent hue
const background = bg != null
  ? sharp(bg).rotate().resize(width, height, { fit: 'cover' })
  : sharp(Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="hsl(${hue}, 30%, 12%)" /><stop offset="1" stop-color="hsl(${(hue + 40) % 360}, 45%, 28%)" /></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)" /></svg>`));

const icon = await sharp('src/renderer/src/icon.svg').resize(110, 110).png().toBuffer();

const outPath = out ?? `dist/release-${version}.png`;
await background
  .composite([{ input: Buffer.from(overlay) }, { input: icon, left, top: 125 }])
  .png()
  .toFile(outPath);
console.log('Wrote', outPath);
