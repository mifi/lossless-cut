// Feature demo scenarios for script/featureMedia.ts. Each one drives the app through the HTTP API (see docs/api.md):
// `action` runs a keyboard action by name, `shot` saves a screenshot and `wait` pauses so the video shows each step.
// Keep each scenario short (10-30 s of video) and about one feature.
import type { Scenario } from './types.ts';

const scenarios: Record<string, Scenario> = {
  'cut-segments': {
    description: 'Open a file and mark two segments to keep',
    clips: ['demo.mp4'],
    async run({ open, action, shot, wait }) {
      await open('demo.mp4');
      await wait(2000);
      await shot('opened');
      // The file starts with one segment; addSegment starts the next one
      for (const [i, [start, end]] of ([['00:00:02', '00:00:05'], ['00:00:09', '00:00:13']] as const).entries()) {
        if (i > 0) await action('addSegment');
        await action('goToTimecodeDirect', { time: start });
        await action('setCutStart');
        await wait(700);
        await action('goToTimecodeDirect', { time: end });
        await action('setCutEnd');
        await wait(1000);
      }
      await wait(1500);
      await shot('segments');
    },
  },
};

export default scenarios;
