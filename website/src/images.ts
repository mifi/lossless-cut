// The homepage's images are hosted on static.mifi.no (originals in src/, resized versions in dist/).
// The `''` size is about 0.3 megapixels and `-2000` is the full image for these, so they make a 1x/2x pair.
const baseUrl = 'https://static.mifi.no';

export const mainScreenshot = {
  src: `${baseUrl}/dist/losslesscut/screenshots/main.jpg`,
  srcSet: `${baseUrl}/dist/losslesscut/screenshots/main.jpg 1x, ${baseUrl}/dist/losslesscut/screenshots/main-2000.jpg 2x`,
};

export const tracksScreenshot = {
  src: `${baseUrl}/dist/losslesscut/screenshots/tracks.jpg`,
  srcSet: `${baseUrl}/dist/losslesscut/screenshots/tracks.jpg 1x, ${baseUrl}/dist/losslesscut/screenshots/tracks-2000.jpg 2x`,
};

export const background1 = `${baseUrl}/dist/losslesscut/website/background-1000.jpg`;
export const background2 = `${baseUrl}/dist/losslesscut/website/background2-1000.jpg`;

// The originals, since re-encoding would add artifacts to the comparison
export const generationLossOriginal = `${baseUrl}/src/losslesscut/website/generation-loss-original.jpg`;
export const generationLossReencoded = `${baseUrl}/src/losslesscut/website/generation-loss-reencoded.jpg`;

// Social preview image (1200x630)
export const ogImage = `${baseUrl}/dist/losslesscut/og-image-1000.jpg`;
