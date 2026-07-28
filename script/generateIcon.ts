import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';


const renderPng = (from: string, width: number, height: number) => sharp(from)
  .png()
  .resize(width, height, {
    fit: sharp.fit.contain,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .toBuffer();

const svg2png = async (from: string, to: string, width: number, height: number) => (
  writeFile(to, await renderPng(from, width, height))
);

const renderSquarePngs = (from: string, sizes: number[]) => Promise.all(sizes.map(async (size) => ({ size, data: await renderPng(from, size, size) })));

// https://en.wikipedia.org/wiki/ICO_(file_format)
// PNG-compressed entries require Windows Vista or newer
function makeIco(pngs: { size: number, data: Buffer }[]) {
  const fileHeaderSize = 6;
  const dirEntrySize = 16;

  const fileHeader = Buffer.alloc(fileHeaderSize);
  fileHeader.writeUInt16LE(0, 0); // reserved
  fileHeader.writeUInt16LE(1, 2); // image type (1 = icon)
  fileHeader.writeUInt16LE(pngs.length, 4);

  let imageOffset = fileHeaderSize + dirEntrySize * pngs.length;
  const dirEntries = pngs.map(({ size, data }) => {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 means 256 or more)
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // number of palette colors
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(imageOffset, 12);
    imageOffset += data.length;
    return entry;
  });

  return Buffer.concat([fileHeader, ...dirEntries, ...pngs.map(({ data }) => data)]);
}

// https://en.wikipedia.org/wiki/Apple_Icon_Image_format
// chunk types whose payload is a plain PNG, and the pixel size each represents
const icnsChunkTypes = [
  { type: 'ic07', size: 128 }, // 128x128
  { type: 'ic08', size: 256 }, // 256x256
  { type: 'ic09', size: 512 }, // 512x512
  { type: 'ic10', size: 1024 }, // 1024x1024 (512x512@2x)
  { type: 'ic11', size: 32 }, // 16x16@2x
  { type: 'ic12', size: 64 }, // 32x32@2x
  { type: 'ic13', size: 256 }, // 128x128@2x
  { type: 'ic14', size: 512 }, // 256x256@2x
];

function makeIcns(pngs: { size: number, data: Buffer }[]) {
  const chunks = icnsChunkTypes.flatMap(({ type, size }) => {
    const png = pngs.find((p) => p.size === size);
    if (png == null) return [];
    const chunkHeader = Buffer.alloc(8);
    chunkHeader.write(type, 0, 'ascii');
    chunkHeader.writeUInt32BE(8 + png.data.length, 4);
    return [Buffer.concat([chunkHeader, png.data])];
  });

  const fileHeader = Buffer.alloc(8);
  fileHeader.write('icns', 0, 'ascii');
  fileHeader.writeUInt32BE(8 + chunks.reduce((total, chunk) => total + chunk.length, 0), 4);

  return Buffer.concat([fileHeader, ...chunks]);
}

const srcIcon = 'src/renderer/src/icon.svg';
const srcMacIcon = 'src/renderer/src/icon-mac.svg';

// Linux:
await svg2png(srcIcon, 'icon-build/app-512.png', 512, 512);

// Windows Store
await svg2png(srcIcon, 'build-resources/appx/StoreLogo.png', 50, 50);
await svg2png(srcIcon, 'build-resources/appx/Square150x150Logo.png', 300, 300);
await svg2png(srcIcon, 'build-resources/appx/Square44x44Logo.png', 44, 44);
await svg2png(srcIcon, 'build-resources/appx/Wide310x150Logo.png', 620, 300);

// MacOS:
// https://github.com/mifi/lossless-cut/issues/1820
await writeFile('icon-build/app.icns', makeIcns(await renderSquarePngs(srcMacIcon, [512, 1024])));

// Windows ICO:
// https://github.com/mifi/lossless-cut/issues/778
// https://stackoverflow.com/questions/3236115/which-icon-sizes-should-my-windows-applications-icon-include
await writeFile('icon-build/app.ico', makeIco(await renderSquarePngs(srcIcon, [16, 24, 32, 40, 48, 64, 96, 128, 256, 512])));
