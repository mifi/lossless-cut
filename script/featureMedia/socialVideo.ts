// Makes the social media versions of a feature demo from its raw recording: captions, zooms (as set by the scenario),
// an intro and outro card and optional music, in landscape (16:10) and vertical (9:16, for Reels, TikTok and Shorts).
import { join } from 'node:path';
import { execa } from 'execa';
import sharp from 'sharp';

export interface Rect { x: number, y: number, w: number, h: number }
export interface Caption { start: number, end: number, text: string }
export interface Zoom { time: number, rect: Rect | undefined }

const fps = 30;
const introDuration = 1.8;
const outroDuration = 2.5;
const fadeDuration = 0.4;
const zoomDuration = 0.7;
const maxZoom = 2.5;
const iconPath = 'src/renderer/src/icon.svg';

const formats = {
  landscape: { width: 1280, height: 800, video: { width: 1280, height: 800, y: 0 }, captionSize: 34, captionY: () => 28 },
  // The captions go at the top in landscape, over the menu and tool bars, which matter least.
  // In vertical, the video is in the middle, on a blurred copy of itself, with the captions above it where they don't cover the UI
  vertical: { width: 1080, height: 1920, video: { width: 1080, height: 675, y: 622 }, captionSize: 52, captionY: (captionHeight: number) => 622 - captionHeight - 60 },
} as const;
export type Format = keyof typeof formats;

const escapeMarkup = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

async function renderText(markup: string, size: number, width: number) {
  return sharp({ text: { text: `<span foreground="white">${markup}</span>`, font: `Inter ${size}`, width, align: 'centre', dpi: 72, rgba: true } }).png().toBuffer({ resolveWithObject: true });
}

// A caption: white text on a dark rounded box
async function renderCaption(text: string, size: number, maxWidth: number, path: string) {
  const { data, info } = await renderText(`<b>${escapeMarkup(text)}</b>`, size, maxWidth);
  const padX = Math.round(size * 0.8);
  const padY = Math.round(size * 0.45);
  const width = info.width + 2 * padX;
  const height = info.height + 2 * padY;
  const box = `<svg width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${Math.round(size * 0.5)}" fill="#111" fill-opacity="0.85"/></svg>`;
  await sharp(Buffer.from(box)).composite([{ input: data, left: padX, top: padY }]).png().toFile(path);
  return { width, height };
}

// The intro and outro: the icon and two lines of text on a dark background
async function renderCard({ width, height }: { width: number, height: number }, title: string, subtitle: string, path: string) {
  const scale = Math.min(width, height) / 800;
  const iconSize = Math.round(180 * scale);
  const icon = await sharp(iconPath, { density: 300 }).resize(iconSize, iconSize).png().toBuffer();
  const titleText = await renderText(`<b>${escapeMarkup(title)}</b>`, Math.round(64 * scale), width - 100);
  const subtitleText = await renderText(`<span foreground="#bbbbbb">${escapeMarkup(subtitle)}</span>`, Math.round(34 * scale), width - 100);
  const gap = Math.round(36 * scale);
  const totalHeight = iconSize + gap + titleText.info.height + Math.round(gap / 2) + subtitleText.info.height;
  let top = Math.round((height - totalHeight) / 2);
  const layers = [icon, titleText.data, subtitleText.data].map((input, i) => {
    const layerWidth = [iconSize, titleText.info.width, subtitleText.info.width][i]!;
    const layer = { input, left: Math.round((width - layerWidth) / 2), top };
    top += [iconSize + gap, titleText.info.height + Math.round(gap / 2), 0][i]!;
    return layer;
  });
  const background = `<svg width="${width}" height="${height}"><defs><radialGradient id="g" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#33363d"/><stop offset="1" stop-color="#121316"/></radialGradient></defs><rect width="${width}" height="${height}" fill="url(#g)"/></svg>`;
  await sharp(Buffer.from(background)).composite(layers).png().toFile(path);
}

// An ffmpeg expression for a value that eases from one setting to the next at each time
function easedExpression(times: number[], values: number[], initial: number): string {
  const build = (i: number, previous: number): string => {
    if (i === times.length) return String(previous);
    const start = times[i]!;
    const value = values[i]!;
    const progress = `clip((it-${start})/${zoomDuration},0,1)`;
    const eased = `${previous}+(${value - previous})*${progress}*${progress}*(3-2*${progress})`;
    return `if(lt(it,${start}),${previous},if(lt(it,${start + zoomDuration}),${eased},${build(i + 1, value)}))`;
  };
  return build(0, initial);
}

// zoompan settings that follow the zooms. The input is scaled up 2x first, which makes slow zooms smoother.
// zoompan's output timestamps can be off (with the raw recording), which makes xfade buffer frames without end, so they're renumbered
function zoomFilter(zooms: Zoom[], { windowWidth, windowHeight }: { windowWidth: number, windowHeight: number }, outWidth: number, outHeight: number) {
  const times = zooms.map(({ time }) => time);
  const targets = zooms.map(({ rect }) => {
    if (rect == null) return { z: 1, cx: windowWidth / 2, cy: windowHeight / 2 };
    const z = Math.max(1, Math.min(maxZoom, windowWidth / rect.w, windowHeight / rect.h));
    return { z, cx: rect.x + rect.w / 2, cy: rect.y + rect.h / 2 };
  });
  const z = easedExpression(times, targets.map((t) => t.z), 1);
  // The centre, in the 2x input's pixels, kept inside the frame
  const cx = easedExpression(times, targets.map((t) => t.cx * 2), windowWidth);
  const cy = easedExpression(times, targets.map((t) => t.cy * 2), windowHeight);
  return `scale=${windowWidth * 2}:${windowHeight * 2}:flags=lanczos,zoompan=z='${z}':x='clip(${cx}-iw/zoom/2,0,iw-iw/zoom)':y='clip(${cy}-ih/zoom/2,0,ih-ih/zoom)':d=1:s=${outWidth}x${outHeight}:fps=${fps},setpts=N/${fps}/TB`;
}

export async function renderSocialVideo({ ffmpeg, rawVideo, videoStart, duration, captions, zooms, description, music, windowWidth, windowHeight, format, tmpDir, outPath }: {
  ffmpeg: string,
  rawVideo: string,
  videoStart: number,
  /** Of the video after videoStart */
  duration: number,
  captions: Caption[],
  zooms: Zoom[],
  description: string,
  /** An audio file, or undefined for no music */
  music: string | undefined,
  windowWidth: number,
  windowHeight: number,
  format: Format,
  tmpDir: string,
  outPath: string,
}) {
  const { width, height, video, captionSize, captionY } = formats[format];
  const introPath = join(tmpDir, `${format}-intro.png`);
  const outroPath = join(tmpDir, `${format}-outro.png`);
  await renderCard({ width, height }, 'LosslessCut', description, introPath);
  await renderCard({ width, height }, 'losslesscut.app', 'Free and open source · Windows, macOS and Linux', outroPath);

  const inputs = [
    '-ss', String(videoStart), '-t', String(duration), '-i', rawVideo,
    '-loop', '1', '-framerate', String(fps), '-t', String(introDuration), '-i', introPath,
    '-loop', '1', '-framerate', String(fps), '-t', String(outroDuration), '-i', outroPath,
  ];
  const normalize = `fps=${fps},format=yuv420p,setsar=1,settb=AVTB`;
  const filters = [`[0:v]${zoomFilter(zooms, { windowWidth, windowHeight }, video.width, video.height)}[zoomed]`];
  if (format === 'vertical') {
    filters.push(
      '[zoomed]split[fg][bgsrc]',
      `[bgsrc]scale=-2:${height},crop=${width}:${height},gblur=sigma=40,eq=brightness=-0.2[bg]`,
      `[bg][fg]overlay=0:${video.y}[v0]`,
    );
  } else {
    filters.push('[zoomed]null[v0]');
  }

  let last = 'v0';
  for (const [i, { start, end, text }] of captions.entries()) {
    const path = join(tmpDir, `${format}-caption-${i}.png`);
    // eslint-disable-next-line no-await-in-loop
    const { width: captionWidth, height: captionHeight } = await renderCaption(text, captionSize, width - 120, path);
    const length = end - start;
    const input = 3 + i;
    inputs.push('-loop', '1', '-framerate', String(fps), '-t', String(length), '-i', path);
    filters.push(
      `[${input}:v]format=rgba,fade=in:st=0:d=0.25:alpha=1,fade=out:st=${Math.max(0, length - 0.25)}:d=0.25:alpha=1,setpts=PTS+${start}/TB[c${i}]`,
      `[${last}][c${i}]overlay=x=${Math.round((width - captionWidth) / 2)}:y=${captionY(captionHeight)}:eof_action=pass[v${i + 1}]`,
    );
    last = `v${i + 1}`;
  }

  const mainOffset = introDuration - fadeDuration;
  const outroOffset = mainOffset + duration - fadeDuration;
  const total = outroOffset + outroDuration;
  filters.push(
    `[${last}]${normalize}[main]`,
    `[1:v]${normalize}[intro]`,
    `[2:v]${normalize}[outro]`,
    `[intro][main]xfade=transition=fade:duration=${fadeDuration}:offset=${mainOffset}[im]`,
    `[im][outro]xfade=transition=fade:duration=${fadeDuration}:offset=${outroOffset}[out]`,
  );

  const audio: string[] = [];
  if (music != null) {
    const musicInput = inputs.filter((arg) => arg === '-i').length;
    inputs.push('-stream_loop', '-1', '-i', music);
    filters.push(`[${musicInput}:a]atrim=0:${total},afade=in:d=0.5,afade=out:st=${total - 1.5}:d=1.5,loudnorm=I=-14:TP=-1.5:LRA=11[aout]`);
    audio.push('-map', '[aout]', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000');
  }

  await execa(ffmpeg, ['-v', 'error', '-y', ...inputs, '-filter_complex', filters.join(';'), '-map', '[out]', ...audio, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(fps), '-t', String(total), '-movflags', '+faststart', outPath]);
}
