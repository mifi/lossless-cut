// The homepage's images and videos are published on static.mifi.no from Mikael's photo library, each at
// media/<public id>/<file>: images as <size>.jpg, videos as <size>.mp4 with posters as poster-<size>.jpg. Sizes are about 0.3 (300),
// 1 (1000) and 2 (2000) megapixels, never larger than the original. The originals are private.
const media = (publicId: string, file: string) => `https://static.mifi.no/media/${publicId}/${file}`;

// The 300 size is about 0.3 megapixels, and 2000 is the full image for these (800×600), so they make a 1x/2x pair (about 1x/1.3x)
const withSrcSet = (publicId: string) => ({
  src: media(publicId, '300.jpg'),
  srcSet: `${media(publicId, '300.jpg')} 1x, ${media(publicId, '2000.jpg')} 2x`,
});


export const generationLossOriginal = withSrcSet('JsdhNV0HgDGbh8kK');
export const generationLossReencoded = withSrcSet('Pyj2ktQ2cfCZV5Lv');

export const background1 = media('Dh1-fklTTZgeL_-d', '1000.jpg');
export const background2 = media('HJz8FiHBINJq9DoO', '1000.jpg');

// Screen recordings (script/featureMedia.ts): silent, a smaller one for phones, and a still for the poster (the first frame, or one that
// shows the feature)
export interface Video { src: string, smallSrc: string, poster: string, width: number, height: number }

// About 13 s
export const heroVideo: Video = {
  src: media('eiLI5DmAyZ164Vb4', '1000.mp4'),
  smallSrc: media('eiLI5DmAyZ164Vb4', '300.mp4'),
  poster: media('eiLI5DmAyZ164Vb4', 'poster-1000.jpg'),
  width: 1024,
  height: 640,
};

// About 10 s: creating segments from the scene changes of a Tears of Steel excerpt (CC BY: the homepage credits it)
export const sceneChangesVideo: Video = {
  src: media('Ctw7264I6yLMJzmc', '1000.mp4'),
  smallSrc: media('Ctw7264I6yLMJzmc', '300.mp4'),
  poster: media('Ctw7264I6yLMJzmc', 'poster-1000.jpg'),
  width: 1024,
  height: 640,
};

// About 7 s: switching off tracks one by one, in a crop of the Tracks panel, with a Tears of Steel excerpt (CC BY: the homepage
// credits it). The small one is 1330×750
export const tracksVideo: Video = {
  src: media('dA_qOIvwYnjEOOfT', '2000.mp4'),
  smallSrc: media('dA_qOIvwYnjEOOfT', '1000.mp4'),
  poster: media('dA_qOIvwYnjEOOfT', 'poster-1000.jpg'),
  width: 1834,
  height: 1034,
};

// Social preview image (1200x630)
export const ogImage = media('MbXWWcu1zsMAinf4', '1000.jpg');
