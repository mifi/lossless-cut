// Feature demo scenarios for script/featureMedia.ts. Each one drives the app through the HTTP API (see docs/api.md):
// `action` runs a keyboard action by name, `shot` saves a screenshot and `wait` pauses so the video shows each step.
// `click`, `key` and `type` are for what actions can't do (dialogs, the tracks panel). Click positions are for the 1280×800 window: find them in a screenshot.
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
  tracks: {
    description: 'Choose which tracks to keep, then export',
    clips: ['tears-of-steel.mkv'],
    async run({ open, action, click, shot, wait }) {
      await open('tears-of-steel.mkv');
      await wait(3000);
      await action('toggleStreamsSelector');
      await wait(2000);
      await shot('tracks');
      // The Keep buttons of the 5.1 track and the last 4 subtitles
      for (const y of [391, 469, 495, 521, 547]) {
        await click(110, y);
        await wait(600);
      }
      await wait(1000);
      await shot('selected');
      await action('toggleStreamsSelector');
      await wait(1000);
      // Shows the export confirmation, then exports
      await action('export');
      await wait(2000);
      await action('export');
      await wait(3000);
      await shot('exported');
    },
  },
  'track-metadata': {
    description: 'Edit the metadata of a track',
    clips: ['tears-of-steel.mkv'],
    async run({ open, action, click, key, type, shot, wait }) {
      await open('tears-of-steel.mkv');
      await wait(3000);
      await action('toggleStreamsSelector');
      await wait(1500);
      // The menu button of track 2, then "Edit track metadata"
      await click(1167, 365);
      await wait(1000);
      await click(1162, 441);
      await wait(1500);
      await shot('dialog');
      // Edit the title
      await click(871, 338);
      await wait(800);
      await key('ctrl+a');
      await type('English stereo mix');
      await wait(500);
      await key('Return');
      await wait(1000);
      // Delete the ENCODER tag
      await click(919, 376);
      await wait(1500);
      await shot('edited');
      await click(889, 627);
      await wait(1500);
      await shot('tracks');
    },
  },
  'detect-scene-changes': {
    description: 'Create segments from the scene changes',
    clips: ['tears-of-steel.mkv'],
    async run({ open, action, key, shot, wait }) {
      await open('tears-of-steel.mkv');
      await wait(3000);
      // Opens a parameters dialog, confirm it with the defaults
      const detecting = action('detectSceneChanges');
      await wait(2000);
      await shot('parameters');
      await key('Return');
      await detecting;
      await wait(5000);
      await shot('segments');
    },
  },
  waveform: {
    description: 'Show the audio waveform while playing',
    clips: ['tears-of-steel.mkv'],
    async run({ open, action, shot, wait }) {
      await open('tears-of-steel.mkv');
      await wait(3000);
      // First the waveform above the timeline, then the full-screen waveform
      await action('toggleWaveformMode');
      await action('goToTimecodeDirect', { time: '00:00:03' });
      await action('play');
      await wait(5000);
      await shot('waveform');
      await action('toggleWaveformMode');
      await wait(6000);
      await action('pause');
      await shot('full-waveform');
    },
  },
  rotate: {
    description: 'Rotate a video losslessly',
    clips: ['DJI_0740.MP4'],
    async run({ open, action, shot, wait }) {
      await open('DJI_0740.MP4');
      await wait(2000);
      await shot('original');
      // The first press sets 0° (to override the file's rotation), the next one 90°
      await action('increaseRotation');
      await action('increaseRotation');
      await wait(5000);
      await shot('rotated');
    },
  },
  'invert-segments': {
    description: 'Mark the parts to remove, then invert to keep the rest',
    clips: ['DJI_0759.MP4'],
    async run({ open, action, shot, wait }) {
      await open('DJI_0759.MP4');
      await wait(2000);
      for (const [start, end] of [['00:00:05', '00:00:09'], ['00:00:16', '00:00:19']]) {
        await action('goToTimecodeDirect', { time: start });
        await action('setCutStart');
        await action('goToTimecodeDirect', { time: end });
        await action('setCutEnd');
        await wait(1000);
      }
      await shot('marked');
      await action('invertAllSegments');
      await wait(2000);
      await shot('inverted');
    },
  },
};

export default scenarios;
