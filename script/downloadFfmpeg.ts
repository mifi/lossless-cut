// Downloads the bundled ffmpeg/ffprobe for a platform into ffmpeg/<platform>-<arch>, see CONTRIBUTING.md
// Usage: node script/downloadFfmpeg.ts darwin-x64|darwin-arm64|linux-x64|win32-x64|win32-arm64
import assert from 'node:assert';
import { createWriteStream } from 'node:fs';
import { chmod, mkdir, readdir, rename, rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { execa } from 'execa';

// Bump these when upgrading FFmpeg
const macRelease = '9.0.2-1'; // https://github.com/mifi/ffmpeg-build-script/releases
const windowsLinuxRelease = '9.0-1'; // https://github.com/mifi/ffmpeg-builds/releases (mirrors BtbN's n<branch>-latest builds)

const target = process.argv[2];
const btbnTargets: Record<string, string> = { 'linux-x64': 'linux64', 'win32-x64': 'win64', 'win32-arm64': 'winarm64' };
const macArchs: Record<string, string> = { 'darwin-x64': 'X64', 'darwin-arm64': 'ARM64' };
assert(target != null && (Object.hasOwn(btbnTargets, target) || Object.hasOwn(macArchs, target)), `Usage: downloadFfmpeg.ts ${[...Object.keys(macArchs), ...Object.keys(btbnTargets)].join('|')}`);

const dir = join('ffmpeg', target);

async function download(url: string, path: string) {
  console.log('Downloading', url);
  const response = await fetch(url);
  assert(response.ok && response.body != null, `Failed to download ${url}: ${response.status}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(path));
}

await rm(dir, { recursive: true, force: true });
await mkdir(dir, { recursive: true });

let binDir: string;
const macArch = macArchs[target];
if (macArch != null) {
  binDir = dir;
  for (const name of ['ffmpeg', 'ffprobe']) {
    const path = join(dir, name);
    await download(`https://github.com/mifi/ffmpeg-build-script/releases/download/${macRelease}/${name}-macos-${macArch}`, path);
    await chmod(path, 0o755);
  }
} else {
  // the electron-builder config bundles everything in `lib`
  binDir = join(dir, 'lib');
  const branch = windowsLinuxRelease.split('-')[0];
  const isWindows = target.startsWith('win32');
  const name = `ffmpeg-n${branch}-latest-${btbnTargets[target]}-gpl-shared-${branch}`;
  const archiveName = `${name}${isWindows ? '.zip' : '.tar.xz'}`;
  const archive = join(dir, archiveName);
  await download(`https://github.com/mifi/ffmpeg-builds/releases/download/${windowsLinuxRelease}/${archiveName}`, archive);

  // 7z, because tar on Windows may be GNU tar (from Git), which doesn't support zip
  await (isWindows ? execa('7z', ['x', '-y', archive, `-o${dir}`], { stdout: 'ignore' }) : execa('tar', ['-xf', archive, '-C', dir]));

  await mkdir(binDir);
  const extractedBinDir = join(dir, name, 'bin');
  const extractedLibDir = join(dir, name, 'lib');
  // Windows has the dlls next to the exes, Linux has the .so files in lib
  const files = isWindows
    ? (await readdir(extractedBinDir)).filter((file) => /^(ffmpeg\.exe|ffprobe\.exe|.*\.dll)$/.test(file)).map((file) => join(extractedBinDir, file))
    : [join(extractedBinDir, 'ffmpeg'), join(extractedBinDir, 'ffprobe'), ...(await readdir(extractedLibDir)).filter((file) => /^lib.*\.so/.test(file)).map((file) => join(extractedLibDir, file))];
  for (const file of files) await rename(file, join(binDir, basename(file)));
  await rm(join(dir, name), { recursive: true });
  await rm(archive);
}

// Smoke test, if the binaries can run on this machine (on Linux this also checks that their RPATH finds the libs)
if (target === `${process.platform}-${process.arch}`) {
  for (const name of ['ffmpeg', 'ffprobe']) {
    const { stdout } = await execa(join(binDir, process.platform === 'win32' ? `${name}.exe` : name), ['-hide_banner', '-version']);
    console.log(stdout.split('\n')[0]);
  }
}
console.log('Done', binDir);
