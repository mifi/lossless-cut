// Makes the social media versions of a feature demo from its raw recording: the app in a window on a desktop, with captions,
// zooms (as set by the scenario), an intro and outro animation and optional music, in landscape (16:10) and vertical (9:16, for Reels, TikTok and Shorts).
// The whole video is an HTML timeline (desktop.html) that Chromium renders frame by frame, with the recording's frames (decoded by ffmpeg) in the window,
// and ffmpeg encodes the frames with the music.
import { once } from 'node:events';
import { mkdir, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execa } from 'execa';
import openTimeline from './htmlScenes.ts';

export interface Rect { x: number, y: number, w: number, h: number }
export interface Caption { start: number, end: number, text: string }
export interface Zoom { time: number, rect: Rect | undefined }
/** An action with a keyboard shortcut, shown as its keys */
export interface KeyPress { time: number, keys: string[] }
/** A finished export and how long it took (in seconds) */
export interface Export { time: number, duration: number }

const fps = 30;
const iconPath = 'src/renderer/src/icon.svg';

// The window's place on the desktop: its left and top (of the title bar) and width. The recording fills its content, below the title bar.
// The captions go on the desktop above the window. In vertical, the window (658 px high) is a bit below the middle, so with a caption above it
// they're about centred, and the footer (if any) is a subtle line with the icon close under it. Everything ends above the bottom quarter
// (y 1440) that Reels, TikTok and Shorts cover with their buttons and text: the footer at about y 1370–1414.
// The keys of keyboard shortcuts go beside the window in landscape (in the room on its right) and above it (and the captions) in vertical
const formats = {
  landscape: { width: 1920, height: 1200, window: { x: 224, y: 168, width: 1472 }, captionSize: 48, captionGap: 36, footer: undefined, keysPlace: 'beside' },
  vertical: { width: 1080, height: 1920, window: { x: 36, y: 690, width: 1008 }, captionSize: 52, captionGap: 60, footer: 'losslesscut.app', keysPlace: 'above' },
} as const;
export type Format = keyof typeof formats;

// Where the window and the recording go, for the HTML
function getLayout(format: Format, windowWidth: number, windowHeight: number) {
  const { width, height, window, captionSize, captionGap, footer, keysPlace } = formats[format];
  // From macOS points (the app's window is windowWidth points wide)
  const scale = window.width / windowWidth;
  const titleBarHeight = Math.round(28 * scale);
  const content = { x: window.x, y: window.y + titleBarHeight, w: window.width, h: Math.round(windowHeight * scale) };
  return { width, height, scale, titleBarHeight, content, captionSize, captionGap, footer, keysPlace };
}

export async function renderSocialVideo({ ffmpeg, rawVideo, videoStart, duration, captions, zooms, keys, exports, description, music, background, windowWidth, windowHeight, format, tmpDir, outPath }: {
  ffmpeg: string,
  rawVideo: string,
  videoStart: number,
  /** Of the video after videoStart */
  duration: number,
  captions: Caption[],
  zooms: Zoom[],
  keys: KeyPress[],
  exports: Export[],
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
  const { width, height } = layout;
  const framesDir = join(tmpDir, `${format}-frames`);
  const fileUrl = (path: string) => pathToFileURL(resolve(path)).href;
  await rm(framesDir, { recursive: true, force: true });
  await mkdir(framesDir, { recursive: true });

  // The recording's frames, for the page to show. fps fills in the frames x11grab dropped. Scaled up 2x, so they stay sharp when zoomed in
  // (Chromium scales images up less sharply). JPEG decodes faster than PNG, and at this quality (with all the colour) it's about as sharp
  await execa(ffmpeg, ['-v', 'error', '-y', '-ss', String(videoStart), '-t', String(duration), '-i', rawVideo, '-vf', `fps=${fps},scale=iw*2:ih*2:flags=lanczos`, '-frames:v', String(Math.round(duration * fps)), '-pix_fmt', 'yuvj444p', '-q:v', '1', '-start_number', '0', join(framesDir, '%05d.jpg')]);
  const recordingFrames = (await readdir(framesDir)).filter((name) => name.endsWith('.jpg')).length;

  const timeline = await openTimeline({
    width,
    height,
    fps,
    config: {
      ...layout,
      recording: { width: windowWidth, height: windowHeight, duration: recordingFrames / fps, fps, frames: `${fileUrl(framesDir)}/` },
      captions,
      zooms,
      keys,
      exports,
      intro: { title: 'LosslessCut', subtitle: description },
      outro: { title: 'losslesscut.app', subtitle: 'Free and open source · Windows, macOS and Linux' },
      background: fileUrl(background),
      icon: fileUrl(iconPath),
    },
  });
  try {
    const total = timeline.frames / fps;
    const musicInput = music != null ? ['-stream_loop', '-1', '-i', music] : [];
    const audio = music != null ? ['-map', '1:a', '-af', `atrim=0:${total},afade=in:d=0.5,afade=out:st=${total - 1.5}:d=1.5,loudnorm=I=-14:TP=-1.5:LRA=11`, '-c:a', 'aac', '-b:a', '192k', '-ar', '48000'] : [];
    // The page's screenshots, piped in
    const encoder = execa(ffmpeg, ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', ...musicInput, '-map', '0:v', ...audio, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(fps), '-t', String(total), '-movflags', '+faststart', outPath], { stdin: 'pipe', stderr: 'inherit' });
    const { stdin } = encoder;
    try {
      await timeline.render(async (frame) => {
        if (!stdin.write(frame)) await once(stdin, 'drain');
      });
      stdin.end();
    } catch (err) {
      // e.g. ffmpeg failed (it has printed why)
      encoder.kill();
      await encoder.catch(() => undefined);
      throw err;
    }
    await encoder;
  } finally {
    await timeline.close();
  }
}
