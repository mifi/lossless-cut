// Makes the social media versions of a feature demo from its raw recording: the app in a window on a desktop, with captions,
// zooms (as set by the scenario), an intro and outro animation and optional music, in landscape (16:10) and vertical (9:16, for Reels, TikTok and Shorts).
// The designed parts are HTML (desktop.html, rendered with Chromium) and ffmpeg puts the zoomed recording into the window.
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execa } from 'execa';
import openHtmlScenes from './htmlScenes.ts';

export interface Rect { x: number, y: number, w: number, h: number }
export interface Caption { start: number, end: number, text: string }
export interface Zoom { time: number, rect: Rect | undefined }

const fps = 30;
const zoomDuration = 0.7;
const maxZoom = 2.5;
const iconPath = 'src/renderer/src/icon.svg';

// The window's place on the desktop: its left and top (of the title bar) and width. The recording fills its content, below the title bar.
// In landscape, the captions go on the desktop above the window. In vertical, the window is in the middle with the captions above it
const formats = {
  landscape: { width: 1920, height: 1200, window: { x: 224, y: 168, width: 1472 }, captionSize: 48, captionGap: 36 },
  vertical: { width: 1080, height: 1920, window: { x: 36, y: 631, width: 1008 }, captionSize: 52, captionGap: 60 },
} as const;
export type Format = keyof typeof formats;

// Where the recording goes, the same numbers for the HTML and ffmpeg
function getLayout(format: Format, windowWidth: number, windowHeight: number) {
  const { width, height, window, captionSize, captionGap } = formats[format];
  // From macOS points (the app's window is windowWidth points wide)
  const scale = window.width / windowWidth;
  const titleBarHeight = Math.round(28 * scale);
  const content = { x: window.x, y: window.y + titleBarHeight, w: window.width, h: Math.round(windowHeight * scale) };
  return { width, height, scale, titleBarHeight, content, captionSize, captionGap };
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
// zoompan's output timestamps can be off (with the raw recording), which makes xfade buffer frames without end, so they're renumbered.
// fps first fills in the frames x11grab dropped, or the renumbering would shorten the video
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
  return `fps=${fps},scale=${windowWidth * 2}:${windowHeight * 2}:flags=lanczos,zoompan=z='${z}':x='clip(${cx}-iw/zoom/2,0,iw-iw/zoom)':y='clip(${cy}-ih/zoom/2,0,ih-ih/zoom)':d=1:s=${outWidth}x${outHeight}:fps=${fps},setpts=N/${fps}/TB`;
}

export async function renderSocialVideo({ ffmpeg, rawVideo, videoStart, duration, captions, zooms, description, music, background, windowWidth, windowHeight, format, tmpDir, outPath }: {
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
  /** The desktop's photo */
  background: string,
  windowWidth: number,
  windowHeight: number,
  format: Format,
  tmpDir: string,
  outPath: string,
}) {
  const layout = getLayout(format, windowWidth, windowHeight);
  const { width, height, content } = layout;
  const dir = join(tmpDir, format);
  const file = (name: string) => join(dir, name);
  const fileUrl = (path: string) => pathToFileURL(resolve(path)).href;
  await mkdir(dir, { recursive: true });

  // The zoomed recording, at the size of the window's content. Lossless, it's encoded again below
  const mainFrames = Math.round(duration * fps);
  const mainPath = file('main.mkv');
  await execa(ffmpeg, ['-v', 'error', '-y', '-ss', String(videoStart), '-t', String(duration), '-i', rawVideo, '-vf', zoomFilter(zooms, { windowWidth, windowHeight }, content.w, content.h), '-frames:v', String(mainFrames), '-c:v', 'libx264', '-preset', 'ultrafast', '-qp', '0', mainPath]);
  // Its first and last frames, for the window in the intro and outro
  await execa(ffmpeg, ['-v', 'error', '-y', '-i', mainPath, '-frames:v', '1', file('first.png')]);
  await execa(ffmpeg, ['-v', 'error', '-y', '-sseof', '-1', '-i', mainPath, '-update', '1', file('last.png')]);

  // The desktop with the window (with a hole where the recording goes), the captions and the intro and outro
  const scenes = await openHtmlScenes({ width, height });
  const sceneConfig = { ...layout, background: fileUrl(background), icon: fileUrl(iconPath) };
  let introFrames: number;
  let outroFrames: number;
  try {
    await scenes.still({ ...sceneConfig, scene: 'frame' }, file('frame.png'));
    for (const [i, { text }] of captions.entries()) {
      // eslint-disable-next-line no-await-in-loop
      await scenes.still({ ...sceneConfig, scene: 'caption', caption: text }, file(`caption-${i}.png`));
    }
    introFrames = await scenes.animation({ ...sceneConfig, scene: 'intro', title: 'LosslessCut', subtitle: description, image: fileUrl(file('first.png')) }, file('intro'), fps);
    outroFrames = await scenes.animation({ ...sceneConfig, scene: 'outro', title: 'losslesscut.app', subtitle: 'Free and open source · Windows, macOS and Linux', image: fileUrl(file('last.png')) }, file('outro'), fps);
  } finally {
    await scenes.close();
  }

  const mainDuration = mainFrames / fps;
  const inputs = [
    '-i', mainPath,
    '-loop', '1', '-framerate', String(fps), '-t', String(mainDuration), '-i', file('frame.png'),
    '-framerate', String(fps), '-i', join(dir, 'intro', '%04d.png'),
    '-framerate', String(fps), '-i', join(dir, 'outro', '%04d.png'),
  ];
  const normalize = `fps=${fps},format=yuv420p,setsar=1,settb=AVTB`;
  // The recording under the window frame, which rounds its bottom corners
  const filters = [`[0:v]pad=${width}:${height}:${content.x}:${content.y}[padded]`, '[padded][1:v]overlay=0:0[v0]'];

  let last = 'v0';
  for (const [i, { start, end }] of captions.entries()) {
    const length = end - start;
    const input = 4 + i;
    inputs.push('-loop', '1', '-framerate', String(fps), '-t', String(length), '-i', file(`caption-${i}.png`));
    filters.push(
      `[${input}:v]format=rgba,fade=in:st=0:d=0.25:alpha=1,fade=out:st=${Math.max(0, length - 0.25)}:d=0.25:alpha=1,setpts=PTS+${start}/TB[c${i}]`,
      `[${last}][c${i}]overlay=0:0:eof_action=pass[v${i + 1}]`,
    );
    last = `v${i + 1}`;
  }

  // The intro ends and the outro starts on the same frame as the recording, so they're joined without a transition
  const total = (introFrames + mainFrames + outroFrames) / fps;
  filters.push(
    `[${last}]${normalize}[main]`,
    `[2:v]${normalize}[intro]`,
    `[3:v]${normalize}[outro]`,
    '[intro][main][outro]concat=n=3:v=1:a=0[out]',
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
