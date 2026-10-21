// Records screenshots and a video of a feature demo (see script/featureMedia/scenarios.ts and AGENTS.md "Feature media").
// Linux only (captures the X display), e.g. in a cloud session. Run `yarn build` and `yarn download-ffmpeg-linux-x64` first, then:
// xvfb-run -a -s "-screen 0 1280x800x24" node script/featureMedia.ts <scenario> [--clips dir]
import assert from 'node:assert';
import { createWriteStream } from 'node:fs';
import { access, mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import timers from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { execa } from 'execa';
import scenarios from './featureMedia/scenarios.ts';

const { values: { clips = 'dist/feature-media-clips' }, positionals: [scenarioName] } = parseArgs({ allowPositionals: true, options: { clips: { type: 'string' } } });
const scenario = scenarioName != null ? scenarios[scenarioName] : undefined;
assert(scenario != null, `Usage: node script/featureMedia.ts <scenario> [--clips dir]. Scenarios: ${Object.keys(scenarios).join(', ')}`);
const display = process.env['DISPLAY'];
assert(process.platform === 'linux' && display != null, 'Run under Xvfb on Linux, see the top of this file');

const width = 1280;
const height = 800;
const port = 8099;
const ffmpeg = 'ffmpeg/linux-x64/lib/ffmpeg';
const outDir = 'dist/feature-media';
await mkdir(outDir, { recursive: true });
await mkdir(clips, { recursive: true });

// Get the clips, from the folder or else download them
const clipsUrl = process.env['FEATURE_MEDIA_CLIPS_URL'] ?? 'https://static.mifi.no/losslesscut';
for (const clip of scenario.clips) {
  const path = join(clips, clip);
  if (!await access(path).then(() => true, () => false)) {
    console.log('Downloading', clip);
    const response = await fetch(`${clipsUrl}/${clip}`);
    assert(response.ok && response.body != null, `Failed to download ${clip}: ${response.status}`);
    // Via a temp file, so an interrupted download isn't used next time
    await pipeline(Readable.fromWeb(response.body), createWriteStream(`${path}.part`));
    await rename(`${path}.part`, path);
  }
}

// A fresh config, so the demo doesn't depend on (or change) your own settings, doesn't hand over to your running LosslessCut, and saves no project file next to the clip (it would be loaded next time)
const configDir = await mkdtemp(join(tmpdir(), 'losslesscut-feature-media-'));
// Exports go to the temp dir too
await writeFile(join(configDir, 'config.json'), JSON.stringify({ windowBounds: { x: 0, y: 0, width, height }, allowMultipleInstances: true, autoSaveProjectFile: false, enableCustomOutDir: true, recentCustomOutDirs: [configDir] }));

// The app's log, including the renderer's console. Failed actions don't fail the HTTP request, so check the screenshots and this log
const appLog = join(outDir, `${scenarioName}-app.log`);
// The app path must come first: the app skips the first two arguments when run as `electron <app>` (process.defaultApp)
const app = execa('node_modules/electron/dist/electron', ['.', '--no-sandbox', '--config-dir', configDir, '--disable-networking', '--http-api', String(port)], { reject: false, env: { ELECTRON_ENABLE_LOGGING: '1' }, stdout: { file: appLog }, stderr: { file: appLog } });

async function post(path: string, body?: unknown) {
  const response = await fetch(`http://127.0.0.1:${port}/api/${path}`, {
    method: 'POST',
    ...(body !== undefined && { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    // Most actions wait until they're done, but don't hang forever on one that opens a dialog
    signal: AbortSignal.timeout(10_000),
  });
  assert(response.ok, `${path} failed: ${response.status} ${await response.text()}`);
}

const grab = ['-f', 'x11grab', '-draw_mouse', '0', '-framerate', '30', '-video_size', `${width}x${height}`, '-i', `${display}+0,0`];
const rawVideo = join(configDir, 'raw.mkv');

try {
  // Wait for the HTTP API
  for (let i = 0; ; i += 1) {
    if (await fetch(`http://127.0.0.1:${port}/`).then(() => true, () => false)) break;
    assert(i < 60 && app.exitCode == null, `LosslessCut did not start, see ${appLog}`);
    await timers.setTimeout(500);
  }
  await timers.setTimeout(3000);

  // Lossless while recording, re-encoded below
  const recorder = execa(ffmpeg, ['-v', 'error', ...grab, '-c:v', 'libx264', '-preset', 'ultrafast', '-qp', '0', rawVideo], { reject: false, stderr: 'inherit' });
  await timers.setTimeout(500);

  try {
    await scenario.run({
      open: async (...names) => post('action/openFiles', names.map((name) => resolve(clips, name))),
      action: async (name, args) => {
        console.log('Action', name, args ?? '');
        await post(`action/${name}`, args);
      },
      shot: async (name) => {
        await execa(ffmpeg, ['-v', 'error', '-y', ...grab, '-frames:v', '1', join(outDir, `${scenarioName}-${name}.png`)]);
      },
      wait: async (ms) => timers.setTimeout(ms),
    });
  } finally {
    // ffmpeg finishes the file and exits (with code 255) on SIGINT
    recorder.kill('SIGINT');
  }
  const { exitCode } = await recorder;
  assert(exitCode === 0 || exitCode === 255, `Recording failed with exit code ${exitCode}`);
  // Small file for posting: x264 at a quality that keeps UI text sharp, and the index at the start for streaming
  const videoPath = join(outDir, `${scenarioName}.mp4`);
  await execa(ffmpeg, ['-v', 'error', '-y', '-i', rawVideo, '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-tune', 'animation', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', videoPath]);
  console.log('Wrote', videoPath, 'and screenshots in', outDir);
} finally {
  app.kill();
  await app;
  await rm(configDir, { recursive: true, force: true });
}
