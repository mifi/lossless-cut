// Records screenshots and a video of a feature demo (see script/featureMedia/scenarios.ts and AGENTS.md "Feature media").
// Linux only (captures the X display), e.g. in a cloud session. Run `yarn build` and `yarn download-ffmpeg-linux-x64` first, then:
// xvfb-run -a -s "-screen 0 1024x640x24" node script/featureMedia.ts <scenario> [--clips dir] [--music track from music.ts, audio file or none] [--background photo from backgrounds.ts] [--scale 2]
import assert from 'node:assert';
import { createWriteStream } from 'node:fs';
import { access, mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import timers from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { execa } from 'execa';
import sharp from 'sharp';
import backgrounds, { defaultBackground } from './featureMedia/backgrounds.ts';
import clipSources from './featureMedia/clips.ts';
import musicTracks, { defaultMusic } from './featureMedia/music.ts';
import { checkChromium } from './featureMedia/htmlScenes.ts';
import scenarios from './featureMedia/scenarios.ts';
import getShortcutKeys from './featureMedia/shortcuts.ts';
import { extractRecordingFrames, renderSocialVideo, type Caption, type Export, type KeyPress, type Rect, type Zoom } from './featureMedia/socialVideo.ts';

const { values: { clips = 'dist/feature-media-clips', music: musicArg = defaultMusic, background: backgroundArg, scale: scaleArg = '1' }, positionals: [scenarioName] } = parseArgs({ allowPositionals: true, options: { clips: { type: 'string' }, music: { type: 'string' }, background: { type: 'string' }, scale: { type: 'string' } } });
const scenario = scenarioName != null ? scenarios[scenarioName] : undefined;
assert(scenario != null, `Usage: node script/featureMedia.ts <scenario> [--clips dir] [--music track from music.ts, audio file or none] [--background photo from backgrounds.ts] [--scale 2]. Scenarios: ${Object.keys(scenarios).join(', ')}`);
const display = process.env['DISPLAY'];
assert(process.platform === 'linux' && display != null, 'Run under Xvfb on Linux, see the top of this file');

// The window size, in the coordinates scenarios use. With --scale 2 the app is drawn at twice the pixels (like on a HiDPI screen), e.g. for sharp screenshots
const width = 1024;
const height = 640;
const scale = Number(scaleArg);
assert(Number.isInteger(scale) && scale > 0, `--scale must be a whole number, got ${scaleArg}`);
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
assert(screenSize === `${screenWidth} ${screenHeight}`, `The screen is ${screenSize}, run Xvfb with -screen 0 ${screenWidth}x${screenHeight}x24`);
const ffmpeg = 'ffmpeg/linux-x64/lib/ffmpeg';
const ffprobe = 'ffmpeg/linux-x64/lib/ffprobe';
const outDir = 'dist/feature-media';
await mkdir(outDir, { recursive: true });
await mkdir(clips, { recursive: true });

const exists = async (path: string) => access(path).then(() => true, () => false);

// Writes to a temp file first, so an interrupted download isn't used next time
async function writeVia(path: string, write: (partPath: string) => Promise<unknown>) {
  const partPath = `${path}.part`;
  try {
    await write(partPath);
  } catch (err) {
    await rm(partPath, { force: true });
    throw err;
  }
  await rename(partPath, path);
}

async function download(url: string, path: string) {
  const response = await fetch(url);
  assert(response.ok && response.body != null, `Failed to download ${url}: ${response.status}`);
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
assert(music == null || await exists(music), `--music must be one of ${Object.keys(musicTracks).join(', ')}, an audio file or none, got ${musicArg}`);

// The desktop's photo in the social media versions: the original from backgrounds.ts, downscaled once to what covers both formats
// (2560×1920 for a 4:3 photo: the vertical one is 1920 high), which Chromium draws faster. sharp leaves out the photo's metadata (e.g. GPS location)
const backgroundName = backgroundArg ?? scenario.background ?? defaultBackground;
const backgroundUrl = backgrounds[backgroundName];
assert(backgroundUrl != null, `--background (or the scenario's background) must be one of ${Object.keys(backgrounds).join(', ')}, got ${backgroundName}`);
const backgroundsDir = 'dist/feature-media-backgrounds';
await mkdir(backgroundsDir, { recursive: true });
// Named after the file and the size, so a changed photo in backgrounds.ts is downloaded again
const background = join(backgroundsDir, `${basename(backgroundUrl, extname(backgroundUrl))}-2560x1920.jpg`);
if (!await exists(background)) {
  console.log('Downloading the background', backgroundName);
  // The original (which has the metadata) only in a temporary folder, removed even if resizing fails
  const originalDir = await mkdtemp(join(tmpdir(), 'feature-media-background-'));
  try {
    const original = join(originalDir, basename(backgroundUrl));
    await download(backgroundUrl, original);
    await writeVia(background, async (partPath) => sharp(original).rotate().resize(2560, 1920, { fit: 'outside', withoutEnlargement: true }).jpeg({ quality: 90, mozjpeg: true }).toFile(partPath));
  } finally {
    await rm(originalDir, { recursive: true, force: true });
  }
}
// The social media versions are drawn with Chromium: check that it starts before recording (see AGENTS.md "Feature media" if not)
await checkChromium();

// Get the clips, from the folder or else make them from their sources (see clips.ts) or download them
const clipsUrl = process.env['FEATURE_MEDIA_CLIPS_URL'] ?? 'https://static.mifi.no/src/losslesscut/demo-sources';
for (const clip of scenario.clips) {
  const path = join(clips, clip);
  if (!await exists(path)) {
    const sourceArgs = clipSources[clip];
    if (sourceArgs != null) {
      console.log('Making', clip, 'from its sources');
      await ffmpegDownload(sourceArgs, path);
    } else {
      console.log('Downloading', clip);
      await download(`${clipsUrl}/${clip}`, path);
    }
  }
}

// Show more of the UI than the defaults do
const demoConfig = { simpleMode: false, thumbnailsEnabled: true };

// Ctrl-C stops the run and cleans up (the temp folder below), a second one exits right away.
// Not process.once: execa's exit handler would see it gone and exit, skipping the cleanup
const stop = new AbortController();
process.on('SIGINT', () => {
  if (stop.signal.aborted) process.exit(130);
  console.log('Stopping (Ctrl-C again to exit right away)');
  stop.abort(new Error('Stopped with Ctrl-C'));
});
const { signal } = stop;
const sleep = async (ms: number) => timers.setTimeout(ms, undefined, { signal });

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
    signal: AbortSignal.any([AbortSignal.timeout(60_000), signal]),
  });
  assert(response.ok, `${path} failed: ${response.status} ${await response.text()}`);
}

const grab = ['-f', 'x11grab', '-draw_mouse', '0', '-framerate', '30', '-video_size', `${screenWidth}x${screenHeight}`, '-i', `${display}+0,0`];
const rawVideo = join(configDir, 'raw.mkv');

try {
  // Wait for the HTTP API
  for (let i = 0; ; i += 1) {
    if (await fetch(`http://127.0.0.1:${port}/`).then(() => true, () => false)) break;
    assert(i < 60 && app.exitCode == null, `LosslessCut did not start, see ${appLog}`);
    await sleep(500);
  }
  await sleep(3000);

  // Lossless while recording, re-encoded below
  const recorder = execa(ffmpeg, ['-v', 'error', ...grab, '-c:v', 'libx264', '-preset', 'ultrafast', '-qp', '0', rawVideo], { reject: false, stderr: 'inherit' });
  const recordingStarted = performance.now();
  const now = () => (performance.now() - recordingStarted) / 1000;
  let videoStart = 0;
  const captionEvents: { time: number, text: string | undefined }[] = [];
  const zoomEvents: { time: number, rect: Rect | undefined }[] = [];
  const keyPresses: KeyPress[] = [];

  // How long each export takes, from the app's events (only a successful one has paths). Each await-event request waits for the next event,
  // and both are waited for at once, so a quick export's complete event isn't missed. Paired after the recording
  const exportStarts: number[] = [];
  const exportCompletes: number[] = [];
  const eventsAbort = new AbortController();
  const watchEvent = async (name: string, onEvent: (event: { paths?: string[] }) => void) => {
    try {
      for (;;) {
        const response = await fetch(`http://127.0.0.1:${port}/api/await-event/${name}`, { method: 'POST', signal: eventsAbort.signal });
        onEvent(await response.json() as { paths?: string[] });
      }
    } catch {
      // Stopped after the recording
    }
  };
  const watchingExports = Promise.all([
    watchEvent('export-start', () => exportStarts.push(now())),
    watchEvent('export-complete', ({ paths }) => {
      if (paths != null) exportCompletes.push(now());
    }),
  ]);
  await sleep(500);

  // Not async, so the caught promise itself is returned (an async function would wrap it in a new, uncaught one)
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  const action = (name: string, args?: unknown) => {
    console.log('Action', name, args ?? '');
    // Shown as keys in the social media versions, if it has a keyboard shortcut
    const keys = getShortcutKeys(name);
    if (keys != null) keyPresses.push({ time: now(), keys });
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
        await sleep(1000);
        if (text != null) {
          await key('ctrl+a');
          await type(text);
          await sleep(500);
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
      wait: sleep,
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
    eventsAbort.abort();
    await watchingExports;
  }
  const { exitCode } = await recorder;
  assert(exitCode === 0 || exitCode === 255, `Recording failed with exit code ${exitCode}`);
  // Not needed for the encoding below
  app.kill();
  // A high quality master (web versions are made from it elsewhere), with the index at the start for streaming
  const videoPath = join(outDir, `${scenarioName}.mp4`);
  await execa(ffmpeg, ['-v', 'error', '-y', '-ss', String(videoStart), '-i', rawVideo, '-vf', 'fps=30', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-tune', 'animation', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', videoPath], { cancelSignal: signal });

  // The social media versions start just before the first caption (after the intro, the opening of the file isn't needed)
  const socialStart = Math.max(videoStart, (captionEvents[0]?.time ?? 0) - 0.5);
  const { stdout: rawDuration } = await execa(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', rawVideo]);
  const duration = Number(rawDuration) - socialStart;
  const captions: Caption[] = captionEvents.flatMap(({ time, text }, i) => (text == null ? [] : [{ text, start: Math.max(0, time - socialStart), end: Math.min((captionEvents[i + 1]?.time ?? Infinity) - socialStart, duration) }]))
    .filter(({ start, end }) => end > start);
  const zooms: Zoom[] = zoomEvents.map(({ time, rect }) => ({ time: time - socialStart, rect }));
  const inVideo = <T extends { time: number }>(events: T[]) => events.map((event) => ({ ...event, time: event.time - socialStart })).filter(({ time }) => time >= 0 && time < duration);
  const keys = scenario.showKeys === false ? [] : inVideo(keyPresses);
  // Each export from the last start before it (one that didn't export has no complete event). Its events can come in either order
  const exportEvents: Export[] = exportCompletes.flatMap((time) => {
    const start = exportStarts.findLast((startTime) => startTime <= time + 0.05);
    return start != null ? [{ time, duration: Math.max(0, time - start) }] : [];
  });

  // The recording's frames, for both formats
  const framesDir = join(configDir, 'frames');
  try {
    const recordingFrames = await extractRecordingFrames({ ffmpeg, rawVideo, videoStart: socialStart, duration, windowWidth: width, windowHeight: height, dir: framesDir, signal });
    // Both at once, which is faster (each mostly waits for its Chromium). If one fails, the other stops, and neither leaves a file
    const failed = new AbortController();
    const results = await Promise.allSettled((['landscape', 'vertical'] as const).map(async (format) => {
      try {
        await writeVia(join(outDir, `${scenarioName}-${format}.mp4`), async (partPath) => renderSocialVideo({ ffmpeg, framesDir, recordingFrames, captions, zooms, keys, exports: inVideo(exportEvents), description: scenario.description, music, background, windowWidth: width, windowHeight: height, format, outPath: partPath, signal: AbortSignal.any([signal, failed.signal]) }));
      } catch (err) {
        failed.abort(err);
        throw err;
      }
    }));
    // The first error, not the other's being stopped
    if (results.some(({ status }) => status === 'rejected')) throw failed.signal.reason;
  } finally {
    await rm(framesDir, { recursive: true, force: true });
  }
  console.log('Wrote', videoPath, 'the social media versions and screenshots in', outDir);
  if (musicTrack != null) console.log('Posts with the social media versions must credit:', musicTrack.credit);
} finally {
  app.kill();
  await app;
  await rm(configDir, { recursive: true, force: true });
}
