import sharp from 'sharp';
import icongenRaw from 'icon-gen';

const icongen = icongenRaw as unknown as typeof icongenRaw['default'];

const svg2png = (from: string, to: string, width: number, height: number) => sharp(from)
  .png()
  .resize(width, height, {
    fit: sharp.fit.contain,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .toFile(to);

const srcIcon = 'src/renderer/src/icon.svg';
// Linux:
await svg2png(srcIcon, './icon-build/app-512.png', 512, 512);

// Windows Store
await svg2png(srcIcon, './build-resources/appx/StoreLogo.png', 50, 50);
await svg2png(srcIcon, './build-resources/appx/Square150x150Logo.png', 300, 300);
await svg2png(srcIcon, './build-resources/appx/Square44x44Logo.png', 44, 44);
await svg2png(srcIcon, './build-resources/appx/Wide310x150Logo.png', 620, 300);

// MacOS:
// https://github.com/mifi/lossless-cut/issues/1820
await icongen('./src/renderer/src/icon-mac.svg', './icon-build', { icns: { sizes: [512, 1024] }, report: false });

// Windows ICO:
// https://github.com/mifi/lossless-cut/issues/778
// https://stackoverflow.com/questions/3236115/which-icon-sizes-should-my-windows-applications-icon-include
await icongen(srcIcon, './icon-build', { ico: { sizes: [16, 24, 32, 40, 48, 64, 96, 128, 256, 512] }, report: false });
