// electron-builder afterPack hook: fail the build if the bundled ffmpeg/ffprobe are missing.
// electron-builder only warns when an `extraResources` source doesn't exist, so a missing ffmpeg would otherwise ship silently.
import assert from 'node:assert';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Arch, type AfterPackContext } from 'electron-builder';

export default async function afterPack({ appOutDir, arch, electronPlatformName, packager }: AfterPackContext) {
  // We have no ffmpeg builds for Linux ARM (see script/downloadFfmpeg.ts)
  if (electronPlatformName === 'linux' && arch !== Arch.x64) return;

  const resourcesDir = packager.getResourcesDir(appOutDir);
  for (const name of ['ffmpeg', 'ffprobe']) {
    const path = join(resourcesDir, electronPlatformName === 'win32' ? `${name}.exe` : name);
    assert(existsSync(path), `${path} is missing. Did you run download-ffmpeg for ${electronPlatformName}-${Arch[arch]}?`);
  }
}
