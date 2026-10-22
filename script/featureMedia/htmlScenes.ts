// Renders the timeline of desktop.html (the whole social media version: the intro, the recording in the window and the outro)
// frame by frame with Chromium (Playwright). Everything in it is a function of the time, so the renders are the same every time.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const htmlUrl = pathToFileURL(resolve('script/featureMedia/desktop.html')).href;

// What desktop.html puts on its window. The functions passed to page.evaluate run in the page, so they can't use variables from here
interface TimelineWindow { timeline: { ready: Promise<unknown>, duration: number, seek: (time: number) => Promise<void> } }

async function launch() {
  // The browser from `yarn playwright install chromium`, or another Chromium or Chrome
  const executablePath = process.env['FEATURE_MEDIA_CHROMIUM'];
  // The same colours on every computer
  return chromium.launch({ ...(executablePath != null && { executablePath }), args: ['--force-color-profile=srgb'] });
}

/** Checks that Chromium starts */
export async function checkChromium() {
  await (await launch()).close();
}

/** Opens the timeline with its settings (see `defaults` in desktop.html), to render it at a frame rate */
export default async function openTimeline({ width, height, config, fps }: { width: number, height: number, config: Record<string, unknown>, fps: number }) {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width, height } });
    // For faster screenshots than Playwright's
    const cdp = await page.context().newCDPSession(page);
    await page.goto(`${htmlUrl}#${encodeURIComponent(JSON.stringify({ ...config, width, height, render: true }))}`);
    const duration = await page.evaluate(async () => {
      const { timeline } = globalThis as unknown as TimelineWindow;
      await timeline.ready;
      return timeline.duration;
    });
    const frames = Math.round(duration * fps);

    return {
      frames,
      /** Renders the frames in order, as JPEGs */
      async render(onFrame: (jpeg: Buffer) => Promise<void>) {
        for (let i = 0; i < frames; i += 1) {
          // eslint-disable-next-line no-await-in-loop
          await page.evaluate(async (time) => (globalThis as unknown as TimelineWindow).timeline.seek(time), i / fps);
          // eslint-disable-next-line no-await-in-loop
          // The frames are opaque, and JPEG is a lot faster than PNG. At this quality it's still much closer to the PNG than the video encoding is
          const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 95, optimizeForSpeed: true });
          // eslint-disable-next-line no-await-in-loop
          await onFrame(Buffer.from(data, 'base64'));
        }
      },
      close: async () => browser.close(),
    };
  } catch (err) {
    await browser.close();
    throw err;
  }
}
