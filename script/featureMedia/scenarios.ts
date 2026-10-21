// Feature demo scenarios for script/featureMedia.ts. Each one drives the app through the HTTP API (see docs/api.md):
// `action` runs a keyboard action by name, `shot` saves a screenshot and `wait` pauses so the video shows each step.
// Keep each scenario short (10-30 s of video) and about one feature.
import type { Scenario } from './types.ts';

const scenarios: Record<string, Scenario> = {
  'cut-segments': {
    description: 'Mark two segments to keep, play them and export',
    clips: ['DJI_0759.MP4'],
    async run({ open, action, shot, wait }) {
      await open('DJI_0759.MP4');
      await wait(2000);
      await shot('opened');
      // Setting a start after the last segment starts a new segment
      for (const [start, end] of [['00:00:03', '00:00:08'], ['00:00:14', '00:00:20']]) {
        await action('goToTimecodeDirect', { time: start });
        await action('setCutStart');
        await wait(700);
        await action('goToTimecodeDirect', { time: end });
        await action('setCutEnd');
        await wait(1000);
      }
      await shot('segments');
      await action('togglePlaySelectedSegments');
      await wait(12000);
      await action('pause');
      // Shows the export confirmation, then exports
      await action('export');
      await wait(2000);
      await shot('export');
      await action('export');
      await wait(3000);
      await shot('exported');
    },
  },
  'split-segments': {
    description: 'Split the video into segments while it plays',
    clips: ['DJI_0740.MP4'],
    async run({ open, action, shot, wait }) {
      await open('DJI_0740.MP4');
      await wait(2000);
      await action('play');
      for (let i = 0; i < 4; i += 1) {
        await wait(2500);
        await action('splitCurrentSegment');
      }
      await action('pause');
      await wait(1500);
      await shot('segments');
    },
  },
  'merge-files': {
    description: 'Open several files and merge them into one',
    clips: ['DJI_0009.MOV', 'DJI_0121.MOV', 'DJI_0740.MP4', 'DJI_0759.MP4'],
    async run({ open, action, shot, wait }) {
      await open('DJI_0009.MOV', 'DJI_0121.MOV', 'DJI_0740.MP4', 'DJI_0759.MP4');
      await wait(1500);
      await action('batchOpenSelectedFile');
      await wait(2000);
      await shot('batch');
      await action('concatBatch');
      await wait(3000);
      await shot('merge');
    },
  },
};

export default scenarios;
