// The homepage's images are hosted on static.mifi.no (originals in src/, resized versions in dist/).
const baseUrl = 'https://static.mifi.no';

// The `''` size is about 0.3 megapixels and `-2000` is the full image for these, so they make a 1x/2x pair
const withSrcSet = (path: string) => ({
  src: `${baseUrl}/dist/${path}.jpg`,
  srcSet: `${baseUrl}/dist/${path}.jpg 1x, ${baseUrl}/dist/${path}-2000.jpg 2x`,
});


export const generationLossOriginal = withSrcSet('losslesscut/website/generation-loss-original');
export const generationLossReencoded = withSrcSet('losslesscut/website/generation-loss-reencoded');

// Drone photos (4:3). The hero's is behind an almost opaque gradient, so the ~1 megapixel version (1154×866, 170 KB) is plenty.
export const background1 = `${baseUrl}/dist/2018/DJI_0120-edit-1000.jpg`;
// Fixed, so it covers the whole viewport (e.g. 1920×1440 on a 1920×1080 screen): the largest resized version (1632×1224, 270 KB)
export const background2 = `${baseUrl}/dist/2018/DJI_0014-edit-2000.jpg`;

// Screen recordings (script/featureMedia.ts): silent, a smaller one for phones, and a still of the first frame
export interface Video { src: string, smallSrc: string, poster: string, width: number, height: number }

// About 13 s
export const heroVideo: Video = {
  src: `${baseUrl}/dist/losslesscut/feature-media/hero-2026-10-22-1000.mp4`,
  smallSrc: `${baseUrl}/dist/losslesscut/feature-media/hero-2026-10-22.mp4`,
  poster: `${baseUrl}/dist/losslesscut/feature-media/hero-2026-10-22-poster-1000.jpg`,
  width: 1024,
  height: 640,
};

// About 10 s: creating segments from the scene changes of a Tears of Steel excerpt (CC BY: the homepage credits it)
export const sceneChangesVideo: Video = {
  src: `${baseUrl}/dist/losslesscut/feature-media/detect-scene-changes-2026-10-22-1000.mp4`,
  smallSrc: `${baseUrl}/dist/losslesscut/feature-media/detect-scene-changes-2026-10-22.mp4`,
  poster: `${baseUrl}/dist/losslesscut/feature-media/detect-scene-changes-2026-10-22-poster-1000.jpg`,
  width: 1024,
  height: 640,
};

// About 7 s: switching off tracks one by one, in a crop of the Tracks panel, with a Tears of Steel excerpt (CC BY: the homepage
// credits it). The small one is 1330×750
export const tracksVideo: Video = {
  src: `${baseUrl}/dist/losslesscut/feature-media/tracks-panel-2026-10-22-2000.mp4`,
  smallSrc: `${baseUrl}/dist/losslesscut/feature-media/tracks-panel-2026-10-22-1000.mp4`,
  poster: `${baseUrl}/dist/losslesscut/feature-media/tracks-panel-2026-10-22-poster-1000.jpg`,
  width: 1834,
  height: 1034,
};

// Social preview image (1200x630)
export const ogImage = `${baseUrl}/dist/losslesscut/og-image-1000.jpg`;
