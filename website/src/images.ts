// The homepage's images are hosted on static.mifi.no (originals in src/, resized versions in dist/).
const baseUrl = 'https://static.mifi.no';

// The `''` size is about 0.3 megapixels and `-2000` is the full image for these, so they make a 1x/2x pair
const withSrcSet = (path: string) => ({
  src: `${baseUrl}/dist/${path}.jpg`,
  srcSet: `${baseUrl}/dist/${path}.jpg 1x, ${baseUrl}/dist/${path}-2000.jpg 2x`,
});

export const tracksScreenshot = withSrcSet('losslesscut/screenshots/tracks');

export const generationLossOriginal = withSrcSet('losslesscut/website/generation-loss-original');
export const generationLossReencoded = withSrcSet('losslesscut/website/generation-loss-reencoded');

export const background1 = `${baseUrl}/dist/losslesscut/website/background-1000.jpg`;
export const background2 = `${baseUrl}/dist/losslesscut/website/background2-1000.jpg`;

// Screen recordings (script/featureMedia.ts): 1024×640, silent, a smaller one for phones, and a still of the first frame
export interface Video { src: string, smallSrc: string, poster: string }

// About 13 s
export const heroVideo: Video = {
  src: `${baseUrl}/dist/losslesscut/feature-media/hero-2026-10-22-1000.mp4`,
  smallSrc: `${baseUrl}/dist/losslesscut/feature-media/hero-2026-10-22.mp4`,
  poster: `${baseUrl}/dist/losslesscut/feature-media/hero-2026-10-22-poster-1000.jpg`,
};

// About 10 s: creating segments from the scene changes of a Tears of Steel excerpt (CC BY: the homepage credits it)
export const sceneChangesVideo: Video = {
  src: `${baseUrl}/dist/losslesscut/feature-media/detect-scene-changes-2026-10-22-1000.mp4`,
  smallSrc: `${baseUrl}/dist/losslesscut/feature-media/detect-scene-changes-2026-10-22.mp4`,
  poster: `${baseUrl}/dist/losslesscut/feature-media/detect-scene-changes-2026-10-22-poster-1000.jpg`,
};

// Social preview image (1200x630)
export const ogImage = `${baseUrl}/dist/losslesscut/og-image-1000.jpg`;
