// electron-builder afterPack hook: fail the build if the bundled ffmpeg/ffprobe are missing or don't run.
// electron-builder only warns when an `extraResources` source doesn't exist, so a missing ffmpeg would otherwise ship silently.
import assert from 'node:assert';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Arch } from 'electron-builder';
import type { AfterPackContext } from 'electron-builder';
import { execa } from 'execa';

export default async function afterPack({ appOutDir, arch, electronPlatformName, packager }: AfterPackContext) {
  const resourcesDir = packager.getResourcesDir(appOutDir);
  for (const name of ['ffmpeg', 'ffprobe']) {
    const path = join(resourcesDir, electronPlatformName === 'win32' ? `${name}.exe` : name);
    assert.ok(existsSync(path), `${path} is missing. Did you run download-ffmpeg for ${electronPlatformName}-${Arch[arch]}?`);

    // If the binary can run on this machine, check that it does (e.g. not a broken download or missing libraries).
    // Mac App Store builds have electronPlatformName 'mas', so they're not run (the dmg builds use the same binaries)
    if (electronPlatformName !== process.platform || Arch[arch] !== process.arch) continue;
    // Like the app does on Linux (see src/main/ffmpeg.ts)
    const { stdout } = await execa(path, ['-hide_banner', '-version'], { env: { LD_LIBRARY_PATH: resourcesDir } });
    console.log(stdout.split('\n', 1)[0]);
  }
}
