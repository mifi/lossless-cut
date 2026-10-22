// Feature demo scenarios for script/featureMedia.ts. Each one drives the app through the HTTP API (see docs/api.md):
// `action` runs a keyboard action by name, `shot` saves a screenshot and `wait` pauses so the video shows each step.
// `click`, `key` and `type` are for what actions can't do (dialogs, the tracks panel). Click positions are for the 1024×640 window: find them in a screenshot.
// Keep each scenario short (10-30 s of video) and about one feature.
import type { Scenario } from './types.ts';

// Play the clip, mark three parts as it plays and merge them into one file, without the export confirmation
function heroScenario(clip: string, marks: [start: number, end: number][]): Scenario {
  return {
    description: 'Keep the good parts and get a new file in seconds',
    clips: [clip],
    config: { autoMerge: true, exportConfirmEnabled: false },
    async run({ open, action, key, shot, wait, startVideo }) {
      await open(clip);
      // Wait until the thumbnails are loaded, so the video starts on the opened file
      await wait(4000);
      startVideo();
      await shot('opened');
      await wait(500);
      await action('play');
      // Mark at the playhead (seconds since play started)
      let elapsed = 0;
      for (const [start, end] of marks) {
        await wait((start - elapsed) * 1000);
        await action('setCutStart');
        await wait((end - start) * 1000);
        await action('setCutEnd');
        elapsed = end;
      }
      await action('pause');
      await wait(800);
      await shot('segments');
      await action('export');
      await wait(1500);
      // Close the success dialog and end on the timeline with the parts, like the start but with segments
      await key('Escape');
      await wait(1500);
      await shot('exported');
    },
  };
}

const scenarios: Record<string, Scenario> = {
  // For the website's homepage: a short silent loop of the core idea. Keep it quick, and don't use clips that need a credit
  hero: heroScenario('DJI_0121.MOV', [[1, 2.5], [3.5, 5], [6, 7.5]]),
  'cut-segments': {
    description: 'Mark and label two segments to keep, play them and export',
    clips: ['DJI_0759.MP4'],
    async run({ open, action, actionWithDialog, shot, wait, caption, zoom }) {
      await open('DJI_0759.MP4');
      await wait(2000);
      await shot('opened');
      caption('Mark the parts you want to keep');
      // Setting a start after the last segment starts a new segment
      for (const [start, end, label] of [['00:00:03', '00:00:08', 'Sunset'], ['00:00:14', '00:00:20', 'Cliffs']] as const) {
        await action('goToTimecodeDirect', { time: start });
        await action('setCutStart');
        await wait(700);
        await action('goToTimecodeDirect', { time: end });
        await action('setCutEnd');
        await wait(700);
        await actionWithDialog('labelCurrentSegment', label);
        await wait(800);
      }
      await shot('segments');
      // The segment list
      caption('Each part becomes a segment');
      zoom({ x: 780, y: 60, w: 244, h: 280 });
      await wait(2500);
      zoom();
      caption('Preview only the selected parts');
      await action('togglePlaySelectedSegments');
      await wait(8000);
      await action('pause');
      caption('Export without re-encoding');
      // Shows the export confirmation, then exports
      await action('export');
      await wait(2000);
      await shot('export');
      await action('export');
      caption('Done in seconds, with the original quality');
      await wait(3000);
      await shot('exported');
    },
  },
  'split-segments': {
    description: 'Split the video into segments while it plays',
    clips: ['DJI_0740.MP4'],
    async run({ open, action, shot, wait, caption }) {
      await open('DJI_0740.MP4');
      await wait(2000);
      caption('Split it into parts while it plays');
      await action('play');
      for (let i = 0; i < 4; i += 1) {
        await wait(2500);
        await action('splitCurrentSegment');
      }
      await action('pause');
      caption('Each part can be exported on its own');
      await wait(2500);
      await shot('segments');
    },
  },
  'merge-files': {
    description: 'Open several files and merge them into one',
    clips: ['DJI_0009.MOV', 'DJI_0121.MOV', 'DJI_0740.MP4', 'DJI_0759.MP4'],
    // The simple mode merge dialog checks the files, which shows nicer
    config: { simpleMode: true },
    async run({ open, action, shot, wait, caption }) {
      caption('Open several files at once');
      await open('DJI_0009.MOV', 'DJI_0121.MOV', 'DJI_0740.MP4', 'DJI_0759.MP4');
      await wait(1500);
      await action('batchOpenSelectedFile');
      await wait(2000);
      await shot('batch');
      caption('Merge them into one, without re-encoding');
      await action('concatBatch');
      await wait(3500);
      await shot('merge');
    },
  },
  tracks: {
    description: 'Choose which tracks to keep, then export',
    clips: ['tears-of-steel.mkv'],
    config: { waveformMode: 'waveform' },
    async run({ open, action, click, shot, wait, caption, zoom }) {
      await open('tears-of-steel.mkv');
      await wait(3000);
      caption('See every track in the file');
      await action('toggleStreamsSelector');
      await wait(2000);
      await shot('tracks');
      caption('Choose the ones to keep');
      // The Keep column, the codecs and the titles
      zoom({ x: 60, y: 230, w: 560, h: 300 });
      await wait(800);
      // The Keep buttons of the 5.1 track and the last 4 subtitles
      for (const y of [325, 417, 443, 469, 495]) {
        await click(97, y);
        await wait(600);
      }
      await wait(1000);
      await shot('selected');
      // Only the tracks panel, e.g. for the website (sharpest with --scale 2)
      await shot('panel', { x: 53, y: 73, w: 917, h: 517 });
      zoom();
      await action('toggleStreamsSelector');
      caption('Export with only those tracks');
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
    config: { waveformMode: 'waveform' },
    async run({ open, action, click, key, type, shot, wait, caption, zoom }) {
      await open('tears-of-steel.mkv');
      await wait(3000);
      await action('toggleStreamsSelector');
      await wait(1500);
      // The menu button of track 2, then "Edit track metadata"
      await click(909, 300);
      await wait(1000);
      caption('Edit the metadata of any track');
      await click(905, 376);
      // The dialog
      zoom({ x: 193, y: 95, w: 640, h: 480 });
      await wait(1500);
      await shot('dialog');
      // Edit the title
      await click(743, 277);
      await wait(800);
      await key('ctrl+a');
      await type('English stereo mix');
      await wait(500);
      await key('Return');
      await wait(1000);
      // Delete the HANDLER_NAME tag
      await click(791, 315);
      await wait(1500);
      await shot('edited');
      zoom();
      await click(761, 528);
      await wait(1500);
      await shot('tracks');
    },
  },
  'detect-scene-changes': {
    description: 'Create segments from the scene changes',
    clips: ['tears-of-steel.mkv'],
    config: { waveformMode: 'waveform' },
    async run({ open, actionWithDialog, shot, wait, caption }) {
      await open('tears-of-steel.mkv');
      await wait(3000);
      caption('Find the scene changes automatically');
      // Confirm the parameters dialog with the defaults
      await actionWithDialog('detectSceneChanges');
      await wait(2000);
      caption('Every scene becomes a segment');
      await wait(3000);
      await shot('segments');
    },
  },
  waveform: {
    description: 'Show the audio waveform while playing',
    clips: ['tears-of-steel.mkv'],
    async run({ open, action, shot, wait, caption }) {
      await open('tears-of-steel.mkv');
      await wait(3000);
      // First the waveform above the timeline, then the full-screen waveform
      caption('See the audio waveform');
      await action('toggleWaveformMode');
      await action('goToTimecodeDirect', { time: '00:00:03' });
      await action('play');
      await wait(5000);
      await shot('waveform');
      caption('Or make it full-screen');
      await action('toggleWaveformMode');
      await wait(6000);
      await action('pause');
      await shot('full-waveform');
    },
  },
  rotate: {
    description: 'Rotate a video losslessly',
    clips: ['DJI_0740.MP4'],
    async run({ open, action, shot, wait, caption }) {
      await open('DJI_0740.MP4');
      await wait(2000);
      await shot('original');
      caption('Rotate a video');
      await wait(1000);
      // The first press sets 0° (to override the file's rotation), the next one 90°
      await action('increaseRotation');
      await action('increaseRotation');
      await wait(2000);
      caption('Losslessly, without re-encoding');
      await wait(3000);
      await shot('rotated');
    },
  },
  'invert-segments': {
    description: 'Mark the parts to remove, then invert to keep the rest',
    clips: ['DJI_0759.MP4'],
    async run({ open, action, shot, wait, caption }) {
      await open('DJI_0759.MP4');
      await wait(2000);
      caption('Mark the parts you don\'t want');
      for (const [start, end] of [['00:00:05', '00:00:09'], ['00:00:16', '00:00:19']]) {
        await action('goToTimecodeDirect', { time: start });
        await action('setCutStart');
        await action('goToTimecodeDirect', { time: end });
        await action('setCutEnd');
        await wait(1000);
      }
      await shot('marked');
      caption('Invert to keep the rest');
      await action('invertAllSegments');
      await wait(2500);
      await shot('inverted');
    },
  },
  'merge-cuts': {
    description: 'Cut out three parts and merge them into one file',
    clips: ['DJI_0759.MP4'],
    config: { autoMerge: true },
    async run({ open, action, actionWithDialog, shot, wait, caption }) {
      await open('DJI_0759.MP4');
      await wait(2000);
      caption('Mark the parts you want to keep');
      for (const [start, end, label] of [['00:00:02', '00:00:05', 'Sea'], ['00:00:10', '00:00:13', 'Cliffs'], ['00:00:18', '00:00:22', 'Sunset']] as const) {
        await action('goToTimecodeDirect', { time: start });
        await action('setCutStart');
        await action('goToTimecodeDirect', { time: end });
        await action('setCutEnd');
        await wait(500);
        await actionWithDialog('labelCurrentSegment', label);
        await wait(800);
      }
      await shot('segments');
      caption('Merge them into one file');
      // Shows the export confirmation (with "Merge cuts"), then exports
      await action('export');
      await wait(2500);
      await shot('export');
      await action('export');
      caption('Done in seconds, without re-encoding');
      await wait(4000);
      await shot('exported');
    },
  },
  'fixed-duration-segments': {
    description: 'Split a video into 5 second parts, e.g. for stories',
    clips: ['DJI_0759.MP4'],
    async run({ open, actionWithDialog, shot, wait, caption }) {
      await open('DJI_0759.MP4');
      await wait(2000);
      caption('Split it into equal parts, e.g. for stories');
      await actionWithDialog('createFixedDurationSegments', '00:00:05');
      caption('Each part is 5 seconds');
      await wait(2500);
      await shot('segments');
    },
  },
  'youtube-chapters': {
    description: 'Label parts of a video and get YouTube chapters',
    clips: ['tears-of-steel.mkv'],
    config: { waveformMode: 'waveform' },
    async run({ open, action, actionWithDialog, key, shot, wait, caption, zoom }) {
      await open('tears-of-steel.mkv');
      await wait(3000);
      caption('Split a video into parts and name them');
      await actionWithDialog('createNumSegments', '3');
      await wait(1000);
      for (const [i, label] of ['On the bridge', '40 years later', 'In the lab'].entries()) {
        await action(i === 0 ? 'jumpSeekFirstSegment' : 'jumpSeekNextSegment');
        await wait(800);
        await actionWithDialog('labelCurrentSegment', label);
        await wait(800);
      }
      await shot('labels');
      caption('Get chapters to paste into YouTube');
      // The dialog stays open until it's closed
      const showing = action('exportYouTube');
      // The dialog
      zoom({ x: 260, y: 250, w: 500, h: 320 });
      await wait(3000);
      await shot('chapters');
      zoom();
      await key('Escape');
      await showing;
    },
  },
  'keyboard-shortcuts': {
    description: 'Every action has a keyboard shortcut that you can change',
    clips: ['DJI_0759.MP4'],
    async run({ open, action, shot, wait, caption, zoom }) {
      await open('DJI_0759.MP4');
      await wait(2000);
      caption('Every action has a keyboard shortcut');
      await action('toggleKeyboardShortcuts');
      // The dialog
      zoom({ x: 193, y: 75, w: 640, h: 520 });
      await wait(2000);
      caption('And you can change them all');
      await wait(2000);
      await shot('shortcuts');
    },
  },
  'dark-mode': {
    description: 'Switch between dark and light mode',
    clips: ['DJI_0759.MP4'],
    async run({ open, action, shot, wait, caption }) {
      await open('DJI_0759.MP4');
      await wait(2000);
      caption('Dark mode');
      await shot('dark');
      await wait(1500);
      await action('toggleDarkMode');
      caption('Or light mode');
      await wait(2000);
      await shot('light');
      await action('toggleDarkMode');
      await wait(1500);
    },
  },
};

export default scenarios;
