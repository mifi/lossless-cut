const isDev = window.require('electron-is-dev');
const os = window.require('os');
const { join } = window.require('path');
const execa = window.require('execa');

function getPath() {
  const platform = os.platform();

  // todo test asar
  // todo correct?
  const subPath = platform === 'win32' ? 'exiftool-vendored.exe/bin/exiftool.exe' : 'exiftool-vendored.pl/bin/exiftool';

  const path = `node_modules/${subPath}`;
  return isDev ? path : join(process.resourcesPath, 'app.asar.unpacked', path);
}

// eslint-disable-next-line import/prefer-default-export
export async function exifToolCopyMeta(inPath, outPath) {
  /* const existingTags = await exiftool.read(inPath);
  console.log('existing tags', existingTags);
  await await exiftool.write(outPath, existingTags); */
  console.log('Copying exif data');
  await execa(getPath(), ['-tagsFromFile', inPath, '-all:all', '-overwrite_original', outPath]);
  console.log('Done copying exif data');
}
