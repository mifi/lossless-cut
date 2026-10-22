// Renders the scenes of desktop.html (the desktop with the app window, captions, intro and outro) to PNGs with Chromium (Playwright).
// The animations are paused and stepped frame by frame, so the renders are the same every time.
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, type CDPSession, type Page } from 'playwright';

const htmlUrl = pathToFileURL(resolve('script/featureMedia/desktop.html')).href;

// What desktop.html puts on its window. The functions passed to page.evaluate run in the page, so they can't use variables from here
interface SceneWindow { scene: { ready: Promise<unknown>, duration: number, seek: (time: number) => void } }

export default async function openHtmlScenes({ width, height }: { width: number, height: number }) {
  // The browser from `yarn playwright install chromium`, or another Chromium or Chrome
  const executablePath = process.env['FEATURE_MEDIA_CHROMIUM'];
  // The same colours on every computer
  const browser = await chromium.launch({ ...(executablePath != null && { executablePath }), args: ['--force-color-profile=srgb'] });
  let page: Page;
  let cdp: CDPSession;
  try {
    page = await browser.newPage({ viewport: { width, height } });
    // For the animations' frames: Playwright's screenshots compress the PNGs more, which takes a lot longer
    cdp = await page.context().newCDPSession(page);
  } catch (err) {
    await browser.close();
    throw err;
  }

  let loads = 0;
  async function load(config: Record<string, unknown>) {
    // A new query each time, or only the hash would change, which doesn't load the page again
    loads += 1;
    await page.goto(`${htmlUrl}?${loads}#${encodeURIComponent(JSON.stringify({ ...config, width, height, render: true }))}`);
    return page.evaluate(async () => {
      const { scene } = globalThis as unknown as SceneWindow;
      await scene.ready;
      return scene.duration;
    });
  }

  return {
    /** Renders a still, with transparency where nothing is drawn */
    async still(config: Record<string, unknown>, path: string) {
      await load(config);
      await page.screenshot({ path, omitBackground: true });
    },
    /** Renders an animation to numbered PNGs (0000.png…) in a folder, returns the number of frames */
    async animation(config: Record<string, unknown>, dir: string, fps: number) {
      const duration = await load(config);
      await mkdir(dir, { recursive: true });
      const frames = Math.round(duration * fps);
      for (let i = 0; i < frames; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await page.evaluate((time) => (globalThis as unknown as SceneWindow).scene.seek(time), i / fps);
        // eslint-disable-next-line no-await-in-loop
        const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
        // eslint-disable-next-line no-await-in-loop
        await writeFile(join(dir, `${String(i).padStart(4, '0')}.png`), Buffer.from(data, 'base64'));
      }
      return frames;
    },
    close: async () => browser.close(),
  };
}
