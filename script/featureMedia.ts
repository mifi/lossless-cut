// Records screenshots and a video of a feature demo (see script/featureMedia/scenarios.ts and AGENTS.md "Feature media").
// Linux only (captures the X display), e.g. in a cloud session. Run `yarn build` and `yarn download-ffmpeg-linux-x64` first, then:
// xvfb-run -a -s "-screen 0 1024x640x24" node script/featureMedia.ts <scenario> [--clips dir] [--music track from music.ts, audio file or none] [--scale 2]
import assert from 'node:assert';
import { createWriteStream } from 'node:fs';
import { access, mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import timers from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { execa } from 'execa';
import clipSources from './featureMedia/clips.ts';
import musicTracks, { defaultMusic } from './featureMedia/music.ts';
import scenarios from './featureMedia/scenarios.ts';
import { renderSocialVideo } from './featureMedia/socialVideo.ts';
import type { Caption, Rect, Zoom } from './featureMedia/socialVideo.ts';

// eslint-disable-next-line unicorn-js/no-unreadable-object-destructuring -- TODO fix (new rule in @mifi/lint-config)
const { values: { clips = 'dist/feature-media-clips', music: musicArg = defaultMusic, scale: scaleArg = '1' }, positionals: [scenarioName] } = parseArgs({ allowPositionals: true, options: { clips: { type: 'string' }, music: { type: 'string' }, scale: { type: 'string' } } });
const scenario = scenarioName != null ? scenarios[scenarioName] : undefined;
assert.ok(scenario != null, `Usage: node script/featureMedia.ts <scenario> [--clips dir] [--music track from music.ts, audio file or none] [--scale 2]. Scenarios: ${Object.keys(scenarios).join(', ')}`);
const display = process.env['DISPLAY'];
assert.ok(process.platform === 'linux' && display != null, 'Run under Xvfb on Linux, see the top of this file');

// The window size, in the coordinates scenarios use. With --scale 2 the app is drawn at twice the pixels (like on a HiDPI screen), e.g. for sharp screenshots
const width = 1024;
const height = 640;
const scale = Number(scaleArg);
// eslint-disable-next-line unicorn-js/prefer-number-is-safe-integer -- TODO fix (new rule in @mifi/lint-config)
assert.ok(Number.isInteger(scale) && scale > 0, `--scale must be a whole number, got ${scaleArg}`);
const screenWidth = width * scale;
const screenHeight = height * scale;
const port = 8099;
// Another app on the port (e.g. your own LosslessCut with the HTTP API on) would get the actions instead
await new Promise<void>((resolvePromise, reject) => {
  const server = createServer().once('error', () => reject(new Error(`Port ${port} is in use, close what's using it (e.g. LosslessCut with the HTTP API on)`)));
  server.listen(port, '127.0.0.1', () => server.close(() => resolvePromise()));
});
// Scenarios click at fixed positions, so the screen must be the size of the window
const { stdout: screenSize } = await execa('xdotool', ['getdisplaygeometry']);
assert.ok(screenSize === `${screenWidth} ${screenHeight}`, `The screen is ${screenSize}, run Xvfb with -screen 0 ${screenWidth}x${screenHeight}x24`);
const ffmpeg = 'ffmpeg/linux-x64/lib/ffmpeg';
const ffprobe = 'ffmpeg/linux-x64/lib/ffprobe';
const outDir = 'dist/feature-media';
await mkdir(outDir, { recursive: true });
await mkdir(clips, { recursive: true });

const exists = async (path: string) => access(path).then(() => true).catch(() => false);

// Writes to a temp file first, so an interrupted download isn't used next time
async function writeVia(path: string, write: (partPath: string) => Promise<unknown>) {
  await write(`${path}.part`);
  await rename(`${path}.part`, path);
}

async function download(url: string, path: string) {
  const response = await fetch(url);
  assert.ok(response.ok && response.body != null, `Failed to download ${url}: ${response.status}`);
  await writeVia(path, async (partPath) => pipeline(Readable.fromWeb(response.body!), createWriteStream(partPath)));
}

// ffmpeg only uses the lowercase variable. It also doesn't time out on a slow connection through a proxy, like fetch does
const httpProxy = process.env['http_proxy'] ?? process.env['HTTPS_PROXY'];
const ffmpegDownload = async (args: string[], path: string) => writeVia(path, async (partPath) => execa(ffmpeg, ['-v', 'error', '-y', ...args, partPath], { ...(httpProxy != null && { env: { http_proxy: httpProxy } }) }));

// The music for the social media versions: a track from music.ts, an audio file, or none
const musicTrack = musicTracks[musicArg];
let music: string | undefined = musicArg === 'none' ? undefined : musicArg;
if (musicTrack != null) {
  const musicDir = 'dist/feature-media-music';
  await mkdir(musicDir, { recursive: true });
  music = join(musicDir, `${musicArg}.mp3`);
  if (!await exists(music)) {
    console.log('Downloading music', musicArg);
    await ffmpegDownload(['-i', musicTrack.url, '-c', 'copy', '-f', 'mp3'], music);
  }
}
assert.ok(music == null || await exists(music), `--music must be one of ${Object.keys(musicTracks).join(', ')}, an audio file or none, got ${musicArg}`);

// Get the clips, from the folder or else make them from their sources (see clips.ts) or download them
const clipsUrl = process.env['FEATURE_MEDIA_CLIPS_URL'] ?? 'https://static.mifi.no/losslesscut';
for (const clip of scenario.clips) {
  const path = join(clips, clip);
  if (await exists(path)) continue;
  const sourceArgs = clipSources[clip];
  if (sourceArgs != null) {
    console.log('Making', clip, 'from its sources');
    await ffmpegDownload(sourceArgs, path);
  } else {
    console.log('Downloading', clip);
    await download(`${clipsUrl}/${clip}`, path);
  }
}

// Show more of the UI than the defaults do
const demoConfig = { simpleMode: false, thumbnailsEnabled: true };

// A fresh config, so the demo doesn't depend on (or change) your own settings, doesn't hand over to your running LosslessCut, and saves no project file next to the clip (it would be loaded next time)
const configDir = await mkdtemp(join(tmpdir(), 'losslesscut-feature-media-'));
// Exports go to the temp dir too
await writeFile(join(configDir, 'config.json'), JSON.stringify({ windowBounds: { x: 0, y: 0, width, height }, allowMultipleInstances: true, autoSaveProjectFile: false, enableCustomOutDir: true, recentCustomOutDirs: [configDir], ...demoConfig, ...scenario.config }));

// The app's log, including the renderer's console. Failed actions don't fail the HTTP request, so check the screenshots and this log
const appLog = join(outDir, `${scenarioName}-app.log`);
// The app path must come first: the app skips the first two arguments when run as `electron <app>` (process.defaultApp)
const app = execa('node_modules/electron/dist/electron', ['.', '--no-sandbox', '--config-dir', configDir, '--disable-networking', `--force-device-scale-factor=${scale}`, '--http-api', String(port)], { reject: false, env: { ELECTRON_ENABLE_LOGGING: '1', GTK_THEME: 'Adwaita:dark' }, stdout: { file: appLog }, stderr: { file: appLog } });

async function post(path: string, body?: unknown) {
  const response = await fetch(`http://127.0.0.1:${port}/api/${path}`, {
    method: 'POST',
    ...(body !== undefined && { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    // Actions wait until they're done (e.g. a scene detection), but don't hang forever on one that opens a dialog
    signal: AbortSignal.timeout(60_000),
  });
  assert.ok(response.ok, `${path} failed: ${response.status} ${await response.text()}`);
}

const grab = ['-f', 'x11grab', '-draw_mouse', '0', '-framerate', '30', '-video_size', `${screenWidth}x${screenHeight}`, '-i', `${display}+0,0`];
const rawVideo = join(configDir, 'raw.mkv');

try {
  // Wait for the HTTP API
  for (let i = 0; ; i += 1) {
    if (await fetch(`http://127.0.0.1:${port}/`).then(() => true).catch(() => false)) break;
    assert.ok(i < 60 && app.exitCode == null, `LosslessCut did not start, see ${appLog}`);
    await timers.setTimeout(500);
  }
  await timers.setTimeout(3000);

  // Lossless while recording, re-encoded below
  const recorder = execa(ffmpeg, ['-v', 'error', ...grab, '-c:v', 'libx264', '-preset', 'ultrafast', '-qp', '0', rawVideo], { reject: false, stderr: 'inherit' });
  const recordingStarted = performance.now();
  const now = () => (performance.now() - recordingStarted) / 1000;
  let videoStart = 0;
  const captionEvents: { time: number, text: string | undefined }[] = [];
  const zoomEvents: { time: number, rect: Rect | undefined }[] = [];
  await timers.setTimeout(500);

  // Not async, so the caught promise itself is returned (an async function would wrap it in a new, uncaught one)
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  const action = (name: string, args?: unknown) => {
    console.log('Action', name, args ?? '');
    const done = post(`action/${name}`, args);
    // Scenarios may await it later (e.g. after closing the dialog it opens), so a failure meanwhile mustn't be an unhandled rejection, which would skip the cleanup
    done.catch(() => undefined);
    return done;
  };
  const key = async (keys: string) => {
    await execa('xdotool', ['key', keys]);
  };
  const type = async (text: string) => {
    await execa('xdotool', ['type', '--delay', '80', text]);
  };

  try {
    await scenario.run({
      open: async (...names) => post('action/openFiles', names.map((name) => resolve(clips, name))),
      action,
      actionWithDialog: async (name, text) => {
        // The action finishes when the dialog is closed
        const done = action(name);
        await timers.setTimeout(1000);
        if (text != null) {
          await key('ctrl+a');
          await type(text);
          await timers.setTimeout(500);
        }
        await key('Return');
        await done;
      },
      key,
      type,
      click: async (x, y) => {
        await execa('xdotool', ['mousemove', String(x * scale), String(y * scale), 'click', '1']);
      },
      shot: async (name, crop) => {
        const cropArgs = crop != null ? ['-vf', `crop=${crop.w * scale}:${crop.h * scale}:${crop.x * scale}:${crop.y * scale}`] : [];
        await execa(ffmpeg, ['-v', 'error', '-y', ...grab, ...cropArgs, '-frames:v', '1', join(outDir, `${scenarioName}-${name}.png`)]);
      },
      wait: async (ms) => timers.setTimeout(ms),
      startVideo: () => {
        videoStart = now();
      },
      caption: (text) => {
        captionEvents.push({ time: now(), text });
      },
      zoom: (rect) => {
        zoomEvents.push({ time: now(), rect });
      },
    });
  } finally {
    // ffmpeg finishes the file and exits (with code 255) on SIGINT
    recorder.kill('SIGINT');
  }
  const { exitCode } = await recorder;
  assert.ok(exitCode === 0 || exitCode === 255, `Recording failed with exit code ${exitCode}`);
  // Not needed for the encoding below
  app.kill();
  // A high quality master (web versions are made from it elsewhere), with the index at the start for streaming
  const videoPath = join(outDir, `${scenarioName}.mp4`);
  await execa(ffmpeg, ['-v', 'error', '-y', '-ss', String(videoStart), '-i', rawVideo, '-vf', 'fps=30', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-tune', 'animation', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', videoPath]);

  // The social media versions start just before the first caption (after the intro card, the opening of the file isn't needed)
  const socialStart = Math.max(videoStart, (captionEvents[0]?.time ?? 0) - 0.5);
  const { stdout: rawDuration } = await execa(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', rawVideo]);
  const duration = Number(rawDuration) - socialStart;
  const captions: Caption[] = captionEvents.flatMap(({ time, text }, i) => (text == null ? [] : [{ text, start: Math.max(0, time - socialStart), end: Math.min((captionEvents[i + 1]?.time ?? Infinity) - socialStart, duration) }]))
    .filter(({ start, end }) => end > start);
  const zooms: Zoom[] = zoomEvents.map(({ time, rect }) => ({ time: time - socialStart, rect }));
  for (const format of ['landscape', 'vertical'] as const) {
    await renderSocialVideo({ ffmpeg, rawVideo, videoStart: socialStart, duration, captions, zooms, description: scenario.description, music, windowWidth: width, windowHeight: height, format, tmpDir: configDir, outPath: join(outDir, `${scenarioName}-${format}.mp4`) });
  }
  console.log('Wrote', videoPath, 'the social media versions and screenshots in', outDir);
  if (musicTrack != null) console.log('Posts with the social media versions must credit:', musicTrack.credit);
} finally {
  app.kill();
  await app;
  await rm(configDir, { recursive: true, force: true });
}
