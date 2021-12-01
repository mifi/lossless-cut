const sharp = require('sharp');
const icongen = require('@mifi/icon-gen');

const svg2png = (from, to, width, height) => sharp(from)
  .png()
  .resize(width, height, {
    fit: sharp.fit.contain,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .toFile(to);

(async () => {
  await svg2png('src/icon.svg', './icon-build/app-512.png', 512, 512);
  await svg2png('src/icon.svg', './build-resources/appx/StoreLogo.png', 50, 50);
  await svg2png('src/icon.svg', './build-resources/appx/Square150x150Logo.png', 300, 300);
  await svg2png('src/icon.svg', './build-resources/appx/Square44x44Logo.png', 44, 44);
  await svg2png('src/icon.svg', './build-resources/appx/Wide310x150Logo.png', 620, 300);

  await icongen('./src/icon.svg', './icon-build', { icns: { sizes: [512, 1024] } });

  // https://github.com/mifi/lossless-cut/issues/778
  // https://stackoverflow.com/questions/3236115/which-icon-sizes-should-my-windows-applications-icon-include
  await icongen('./src/icon.svg', './icon-build', { ico: { sizes: [16, 24, 32, 40, 48, 64, 96, 128, 256, 512] } });
})();
