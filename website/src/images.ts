// The homepage's images are hosted on static.mifi.no (originals in src/, resized versions in dist/).
const baseUrl = 'https://static.mifi.no';

// The `''` size is about 0.3 megapixels and `-2000` is the full image for these, so they make a 1x/2x pair
const withSrcSet = (path: string) => ({
  src: `${baseUrl}/dist/${path}.jpg`,
  srcSet: `${baseUrl}/dist/${path}.jpg 1x, ${baseUrl}/dist/${path}-2000.jpg 2x`,
});

export const mainScreenshot = withSrcSet('losslesscut/screenshots/main');
export const tracksScreenshot = withSrcSet('losslesscut/screenshots/tracks');

export const generationLossOriginal = withSrcSet('losslesscut/website/generation-loss-original');
export const generationLossReencoded = withSrcSet('losslesscut/website/generation-loss-reencoded');

export const background1 = `${baseUrl}/dist/losslesscut/website/background-1000.jpg`;
export const background2 = `${baseUrl}/dist/losslesscut/website/background2-1000.jpg`;

// Social preview image (1200x630)
export const ogImage = `${baseUrl}/dist/losslesscut/og-image-1000.jpg`;
