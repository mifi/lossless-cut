// Generates an image for release announcements, see AGENTS.md "Release announcement"
// Usage: node script/releaseImage.ts <version> [--bg photo.jpg] [--caption "photo caption"] [--square] [--out file.png] "highlight 1" "highlight 2" ...
import assert from 'node:assert';
import { parseArgs } from 'node:util';
import sharp from 'sharp';

const { values: { bg, caption, square, out }, positionals: [version, ...highlights] } = parseArgs({
  allowPositionals: true,
  options: { bg: { type: 'string' }, caption: { type: 'string' }, square: { type: 'boolean' }, out: { type: 'string' } },
});
assert(version != null && highlights.length <= 3, 'Usage: releaseImage.ts <version> [--bg photo.jpg] [--caption "photo caption"] [--square] [--out file.png] [up to 3 highlights]');

// 16:9 for X/Bluesky/Mastodon/Discord, or square for Instagram
const width = square ? 1080 : 1600;
const height = square ? 1080 : 900;
const margin = square ? 80 : 110;
const scale = square ? 0.8 : 1;

const escapeXml = (str: string) => str.replaceAll(/[<>&'"]/g, (c) => `&#${c.codePointAt(0)};`);
const svg = (content: string) => Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${content}</svg>`);

const photo = bg != null ? await sharp(bg).rotate().resize(width, height, { fit: 'cover' }).toBuffer() : undefined;

// Accent color: the photo's dominant color, or else a hue derived from the version, so every release looks a bit different
async function getAccentHue() {
  if (photo != null) {
    const { dominant: { r, g, b } } = await sharp(photo).stats();
    const max = Math.max(r, g, b);
    const d = max - Math.min(r, g, b);
    if (d > 20) {
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

// Put the text on the darker half of the photo
async function getMeanBrightness(left: number) {
  // stats() reads the input, so the extracted half has to be rendered first
  const half = await sharp(photo).extract({ left, top: 0, width: width / 2, height }).greyscale().toBuffer();
  const { channels } = await sharp(half).stats();
  return channels[0]!.mean;
}
const textOnRight = photo != null && square !== true && await getMeanBrightness(width / 2) < await getMeanBrightness(0);
const x = textOnRight ? width - margin : margin;
const anchor = textOnRight ? 'end' : 'start';

// Darkens (and blurs) the text side, fading out towards the other side
const fade = (id: string, stops: [number, number][]) => `<linearGradient id="${id}" x1="${textOnRight ? 1 : 0}" x2="${textOnRight ? 0 : 1}" y1="0" y2="0">${stops.map(([offset, opacity]) => `<stop offset="${offset}" stop-color="hsl(${hue}, 60%, 7%)" stop-opacity="${opacity}" />`).join('')}</linearGradient>`;

const font = 'Helvetica Neue, Helvetica, Arial, sans-serif';
const text = (textX: number, y: number, size: number, attrs: string, content: string, textAnchor = anchor) => `<text x="${textX}" y="${y}" text-anchor="${textAnchor}" font-family="${font}" font-size="${size}" ${attrs}>${content}</text>`;
const iconSize = Math.round(110 * scale);
const top = square ? 180 : 125;
const lineY = (offset: number) => top + offset * scale;
const titleX = textOnRight ? x - iconSize - 30 * scale : x + iconSize + 30 * scale;

const overlay = svg(`
  <defs>${fade('shade', [[0, 0.9], [0.6, 0.6], [1, 0.15]])}</defs>
  <rect width="100%" height="100%" fill="url(#shade)" />
  ${text(titleX, lineY(80), 64 * scale, 'font-weight="300" fill="#fff"', 'LosslessCut')}
  ${text(x, lineY(275), 150 * scale, `font-weight="700" fill="${accent}"`, escapeXml(version))}
  ${highlights.map((highlight, i) => text(x, lineY(385 + i * 70), 44 * scale, 'fill="#fff" fill-opacity="0.92"', `<tspan fill="${accent}">•</tspan> ${escapeXml(highlight)}`)).join('\n  ')}
  ${text(x, height - 80, 36 * scale, 'fill="#fff" fill-opacity="0.75"', 'losslesscut.app')}
  ${caption != null ? text(textOnRight ? margin : width - margin, height - 40, 20, 'fill="#fff" fill-opacity="0.6"', escapeXml(caption), textOnRight ? 'start' : 'end') : ''}
`);

async function getBackground() {
  if (photo == null) {
    // Without a photo, use a dark gradient in the accent hue
    return svg(`<defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="hsl(${hue}, 30%, 12%)" /><stop offset="1" stop-color="hsl(${(hue + 40) % 360}, 45%, 28%)" /></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)" />`);
  }
  // Blur only behind the text, fading into the sharp photo
  const blurMask = svg(`<defs>${fade('m', [[0, 1], [0.45, 1], [0.7, 0]])}</defs><rect width="100%" height="100%" fill="url(#m)" />`);
  const blurred = await sharp(photo).blur(25).composite([{ input: blurMask, blend: 'dest-in' }]).png().toBuffer();
  return sharp(photo).composite([{ input: blurred }]).toBuffer();
}

const icon = await sharp('src/renderer/src/icon.svg').resize(iconSize, iconSize).png().toBuffer();

const outPath = out ?? `dist/release-${version}${square ? '-square' : ''}.png`;
await sharp(await getBackground())
  .composite([{ input: overlay }, { input: icon, left: textOnRight ? x - iconSize : x, top }])
  .png()
  .toFile(outPath);
console.log('Wrote', outPath);
