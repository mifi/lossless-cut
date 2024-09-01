/* eslint-disable no-console */
import assert from 'node:assert';
import { execa } from 'execa';
import got from 'got';
import os from 'node:os';
import timers from 'node:timers/promises';


const losslessCutExePath = process.argv[2];
assert(losslessCutExePath);
const screenshotOutPath = process.argv[3];
assert(screenshotOutPath);


const port = 8081;

const ps = execa(losslessCutExePath, ['--http-api', String(port)]);

console.log('Started', losslessCutExePath);

// eslint-disable-next-line unicorn/prefer-top-level-await
ps.catch((err) => console.error(err));

const client = got.extend({ prefixUrl: `http://127.0.0.1:${port}`, timeout: { request: 5000 } });

async function captureScreenshot(outPath: string) {
  // https://trac.ffmpeg.org/wiki/Capture/Desktop#Windows

  await execa('ffmpeg', [
    ...(os.platform() === 'darwin' ? ['-r', '30', '-pix_fmt', 'uyvy422', '-f', 'avfoundation', '-i', '1:none'] : []),
    ...(os.platform() === 'win32' ? ['-f', 'gdigrab', '-framerate', '30', '-i', 'desktop'] : []),
    ...(os.platform() === 'linux' ? ['-framerate', '25', '-f', 'x11grab', '-i', ':0.0+0,0'] : []),
    '-vframes', '1', outPath,
  ], { timeout: 30000 });
}

try {
  const resp = await client('', {
    retry: { backoffLimit: 5000, limit: 10 },
    hooks: { beforeRequest: [() => { console.log('attempt'); }] },
  }).text();
  assert(resp.length > 0);

  console.log('Waiting for UI to settle');

  await timers.setTimeout(5000);

  console.log('Capturing screenshot');

  await captureScreenshot(screenshotOutPath);

  console.log('Sending quit command');

  await client.post('api/action/quit').text();
} finally {
  // ps.cancel();
}

console.log('Waiting for app to quit');

await ps;

console.log('App has quit');
