// Generates an image for release announcements, see AGENTS.md "Release announcement"
import assert from 'node:assert';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';

const { values: { bg, position, caption, square, out }, positionals: [version, ...highlights] } = parseArgs({
  allowPositionals: true,
  options: { bg: { type: 'string' }, position: { type: 'string' }, caption: { type: 'string' }, square: { type: 'boolean' }, out: { type: 'string' } },
});
const usage = 'Usage: node script/releaseImage.ts <version> [--bg photo.jpg] [--position top|bottom|left|right|center] [--caption "photo caption"] [--square] [--out file.png] [up to 3 "highlights"]';
assert(version != null && highlights.length <= 3, usage);

// 16:9 for X/Bluesky/Mastodon/Discord, or square for Instagram
const width = square ? 1080 : 1600;
const height = square ? 1080 : 900;
const margin = square ? 80 : 110;
const scale = square ? 0.8 : 1;

// Text doesn't wrap, so warn about text that probably runs off the image
const maxHighlightLength = square ? 40 : 50;
highlights.filter((highlight) => highlight.length > maxHighlightLength).forEach((highlight) => console.warn(`Highlight may be too long (${highlight.length} > ${maxHighlightLength} chars):`, highlight));
if (caption != null && caption.length > 60) console.warn('Caption may be too long:', caption);

const escapeXml = (str: string) => str.replaceAll(/[<>&'"]/g, (c) => `&#${c.codePointAt(0)};`);
const svg = (content: string) => Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${content}</svg>`);

// Crop the photo (e.g. a portrait) to the image's aspect ratio. By default keep the most interesting part (sharp's attention strategy), or the part given by --position (e.g. top, bottom, left, right, center)
const photo = bg != null ? await sharp(bg).rotate().resize(width, height, { fit: 'cover', position: position ?? sharp.strategy.attention }).flatten({ background: '#000' }).png().toBuffer() : undefined;

// Accent color: the photo's dominant color, or else a hue derived from the version, so every release looks a bit different
async function getAccentHue(seed: string) {
  if (photo != null) {
    const { dominant: { r, g, b } } = await sharp(photo).stats();
    // Unless it's (nearly) grey
    if (Math.max(r, g, b) - Math.min(r, g, b) > 20) return Math.round(((Math.atan2(Math.sqrt(3) * (g - b), 2 * r - g - b) * 180) / Math.PI + 360) % 360);
  }
  return [...seed].reduce((acc, c) => (acc * 31 + c.codePointAt(0)!) % 360, 7);
}
const hue = await getAccentHue(version);
const accent = `hsl(${hue}, 80%, 65%)`;

// Darken the text area (left side) enough for the text to stay readable, also on bright photos
async function getTextAreaBrightness() {
  if (photo == null) return 0;
  // stats() reads the input, so the extracted area has to be rendered first
  const area = await sharp(photo).extract({ left: 0, top: 0, width: Math.round(width * 0.6), height }).greyscale().toBuffer();
  const { channels } = await sharp(area).stats();
  return channels[0]!.mean;
}
const brightness = await getTextAreaBrightness();
// At least 0.7, more for bright photos, so the area ends up dark (at most roughly 55 of 255)
const shadeOpacity = Math.max(0.7, 1 - 40 / brightness);

// Darkens (and blurs) the left side, fading out towards the right
const fade = (id: string, stops: [number, number][]) => `<linearGradient id="${id}" x1="0" x2="1" y1="0" y2="0">${stops.map(([offset, opacity]) => `<stop offset="${offset}" stop-color="hsl(${hue}, 60%, 7%)" stop-opacity="${opacity}" />`).join('')}</linearGradient>`;

const font = 'Helvetica Neue, Helvetica, Arial, sans-serif';
const text = (x: number, y: number, size: number, attrs: string, content: string, anchor = 'start') => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${font}" font-size="${size}" ${attrs}>${content}</text>`;
const iconSize = Math.round(110 * scale);
const top = square ? 180 : 125;
const lineY = (offset: number) => top + offset * scale;

const overlay = svg(`
  <defs>${fade('shade', [[0, shadeOpacity], [0.55, shadeOpacity * 0.8], [1, 0.15]])}</defs>
  <rect width="100%" height="100%" fill="url(#shade)" />
  ${text(margin + iconSize + 30 * scale, lineY(80), 64 * scale, 'font-weight="300" fill="#fff"', 'LosslessCut')}
  ${text(margin, lineY(275), 150 * scale, `font-weight="700" fill="${accent}"`, escapeXml(version))}
  ${highlights.map((highlight, i) => text(margin, lineY(385 + i * 70), 44 * scale, 'fill="#fff" fill-opacity="0.92"', `<tspan fill="${accent}">•</tspan> ${escapeXml(highlight)}`)).join('\n  ')}
  ${text(margin, height - 80, 36 * scale, 'fill="#fff" fill-opacity="0.75"', 'losslesscut.app')}
  ${caption != null ? text(width - margin, height - 40, 20, 'fill="#fff" fill-opacity="0.85" stroke="#000" stroke-opacity="0.6" stroke-width="3" paint-order="stroke"', escapeXml(caption), 'end') : ''}
`);

// The background and the layers to put on top of it (before the text overlay)
async function getBackground() {
  if (photo == null) {
    // Without a photo, use a dark gradient in the accent hue
    return { base: svg(`<defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="hsl(${hue}, 30%, 12%)" /><stop offset="1" stop-color="hsl(${(hue + 40) % 360}, 45%, 28%)" /></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)" />`), layers: [] };
  }
  // Blur only behind the text, lightly, fading into the sharp photo
  const blurMask = svg(`<defs>${fade('m', [[0, 1], [0.35, 1], [0.55, 0]])}</defs><rect width="100%" height="100%" fill="url(#m)" />`);
  const blurred = await sharp(photo).blur(8).composite([{ input: blurMask, blend: 'dest-in' }]).png().toBuffer();
  return { base: photo, layers: [{ input: blurred }] };
}

const icon = await sharp('src/renderer/src/icon.svg').resize(iconSize, iconSize).png().toBuffer();

const outPath = out ?? `dist/release-${version}${square ? '-square' : ''}.png`;
await mkdir(dirname(outPath), { recursive: true });
const { base, layers } = await getBackground();
await sharp(base)
  .composite([...layers, { input: overlay }, { input: icon, left: margin, top }])
  .png()
  .toFile(outPath);
console.log('Wrote', outPath);
