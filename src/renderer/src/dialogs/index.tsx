import { CSSProperties, ReactNode, useState } from 'react';
import i18n from 'i18next';
import { Trans } from 'react-i18next';
import invariant from 'tiny-invariant';
import { FaArrowRight, FaExclamationTriangle, FaInfoCircle, FaQuestionCircle } from 'react-icons/fa';

import { formatDuration } from '../util/duration';
import Swal, { ReactSwal } from '../swal';
import { parseYouTube } from '../edlFormats';
import CopyClipboardButton from '../components/CopyClipboardButton';
import Checkbox from '../components/Checkbox';
import { isWindows } from '../util';
import { ParseTimecode } from '../types';
import { FindKeyframeMode } from '../ffmpeg';
import { dangerColor } from '../colors';

const remote = window.require('@electron/remote');
const { dialog } = remote;

const { downloadMediaUrl } = remote.require('./index.js');

// https://github.com/mifi/lossless-cut/issues/1495
export const showOpenDialog = async ({
  filters = isWindows ? [{ name: i18n.t('All Files'), extensions: ['*'] }] : undefined,
  title,
  ...props
}: Omit<Parameters<typeof dialog.showOpenDialog>[0], 'title'> & { title: string }) => (
  dialog.showOpenDialog({ ...props, title, ...(filters != null ? { filters } : {}) })
);

export async function askForYouTubeInput() {
  const example = i18n.t('YouTube video description\n00:00 Intro\n00:01 Chapter 2\n00:00:02.123 Chapter 3');
  const { value } = await Swal.fire({
    title: i18n.t('Import text chapters / YouTube'),
    input: 'textarea',
    inputPlaceholder: example,
    text: i18n.t('Paste or type a YouTube chapters description or textual chapter description'),
    showCancelButton: true,
    inputValidator: (v) => {
      if (v) {
        const edl = parseYouTube(v);
        if (edl.length > 0) return null;
      }
      return i18n.t('Please input a valid format.');
    },
  });

  if (value == null) return [];

  return parseYouTube(value);
}

export async function askForInputDir(defaultPath?: string | undefined) {
  const { filePaths } = await showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: defaultPath!,
    title: i18n.t('Please confirm folder'),
    message: i18n.t('Press confirm to grant LosslessCut access to write the project file (due to App Sandbox restrictions).'),
    buttonLabel: i18n.t('Confirm'),
  });
  return (filePaths && filePaths.length === 1) ? filePaths[0] : undefined;
}

export async function askForOutDir(defaultPath?: string | undefined) {
  const { filePaths } = await showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: defaultPath!,
    title: i18n.t('Where do you want to save output files?'),
    message: i18n.t('Where do you want to save output files? Make sure there is enough free space in this folder'),
    buttonLabel: i18n.t('Select output folder'),
  });
  return (filePaths && filePaths.length === 1) ? filePaths[0] : undefined;
}

export async function askForFfPath(defaultPath?: string | undefined) {
  const { filePaths } = await showOpenDialog({
    properties: ['openDirectory'],
    defaultPath: defaultPath!,
    title: i18n.t('Select custom FFmpeg directory'),
  });
  return (filePaths && filePaths.length === 1) ? filePaths[0] : undefined;
}

export async function askForFileOpenAction(inputOptions: Record<string, string>) {
  let value;
  function onClick(key?: string) {
    value = key;
    Swal.close();
  }

  const swal = ReactSwal.fire({
    html: (
      <div style={{ textAlign: 'left' }}>
        <div style={{ marginBottom: '1em' }}>{i18n.t('You opened a new file. What do you want to do?')}</div>

        {Object.entries(inputOptions).map(([key, text]) => (
          <button type="button" key={key} onClick={() => onClick(key)} className="button-unstyled" style={{ display: 'block', marginBottom: '.5em' }}>
            <FaArrowRight style={{ color: 'var(--gray-10)', verticalAlign: 'middle' }} /> {text}
          </button>
        ))}

        <button type="button" onClick={() => onClick()} className="button-unstyled" style={{ display: 'block', marginTop: '.5em' }}>
          <FaArrowRight style={{ color: dangerColor, verticalAlign: 'middle' }} /> {i18n.t('Cancel')}
        </button>

      </div>
    ),
    showCancelButton: false,
    showConfirmButton: false,
    showCloseButton: false,
  });

  await swal;

  return value;
}

export async function showDiskFull() {
  await Swal.fire({
    icon: 'error',
    text: i18n.t('You ran out of space'),
  });
}

export async function showMuxNotSupported() {
  await Swal.fire({
    icon: 'error',
    text: i18n.t('At least one codec is not supported by the selected output file format. Try another output format or try to disable one or more tracks.'),
  });
}

export async function showOutputNotWritable() {
  await Swal.fire({
    icon: 'error',
    text: i18n.t('You are not allowed to write the output file. This probably means that the file already exists with the wrong permissions, or you don\'t have write permissions to the output folder.'),
  });
}

export async function showRefuseToOverwrite() {
  await Swal.fire({
    icon: 'warning',
    text: i18n.t('Output file already exists, refusing to overwrite. You can turn on overwriting in settings.'),
  });
}

export async function askForImportChapters() {
  const { isConfirmed } = await Swal.fire({
    icon: 'question',
    text: i18n.t('This file has embedded chapters. Do you want to import the chapters as cut-segments?'),
    showCancelButton: true,
    cancelButtonText: i18n.t('Ignore chapters'),
    confirmButtonText: i18n.t('Import chapters'),
  });

  return isConfirmed;
}

const maxSegments = 1000;

async function askForNumSegments() {
  const { value } = await Swal.fire({
    input: 'number',
    inputAttributes: {
      min: String(0),
      max: String(maxSegments),
    },
    showCancelButton: true,
    inputValue: '2',
    text: i18n.t('Divide timeline into a number of equal length segments'),
    inputValidator: (v) => {
      const parsed = parseInt(v, 10);
      if (!Number.isNaN(parsed) && parsed >= 2 && parsed <= maxSegments) return null;
      return i18n.t('Please input a valid number of segments');
    },
  });

  if (value == null) return undefined;

  return parseInt(value, 10);
}

export async function createNumSegments(totalDuration: number) {
  const numSegments = await askForNumSegments();
  if (numSegments == null) return undefined;
  const edl: { start: number, end: number }[] = [];
  const segDuration = totalDuration / numSegments;
  for (let i = 0; i < numSegments; i += 1) {
    edl.push({ start: i * segDuration, end: i === numSegments - 1 ? totalDuration : (i + 1) * segDuration });
  }
  return edl;
}

export async function askForSegmentDuration({ totalDuration, inputPlaceholder, parseTimecode }: {
  totalDuration: number,
  inputPlaceholder: string,
  parseTimecode: ParseTimecode,
}) {
  const { value } = await Swal.fire({
    input: 'text',
    showCancelButton: true,
    inputValue: inputPlaceholder,
    text: i18n.t('Divide timeline into a number of segments with the specified length'),
    inputValidator: (v) => {
      const segmentDuration = parseTimecode(v);
      if (segmentDuration != null) {
        const numSegments = Math.ceil(totalDuration / segmentDuration);
        if (segmentDuration > 0 && segmentDuration < totalDuration && numSegments <= maxSegments) return null;
      }
      return i18n.t('Please input a valid duration. Example: {{example}}', { example: inputPlaceholder });
    },
  });

  if (value == null) return undefined;

  return parseTimecode(value);
}

// https://github.com/mifi/lossless-cut/issues/1153
async function askForSegmentsRandomDurationRange() {
  function parse(str: string) {
    // eslint-disable-next-line unicorn/better-regex
    const match = str.replaceAll(/\s/g, '').match(/^duration([\d.]+)to([\d.]+),gap([-\d.]+)to([-\d.]+)$/i);
    if (!match) return undefined;
    const values = match.slice(1);
    const parsed = values.map((val) => parseFloat(val));

    const durationMin = parsed[0]!;
    const durationMax = parsed[1]!;
    const gapMin = parsed[2]!;
    const gapMax = parsed[3]!;

    if (!(parsed.every((val) => !Number.isNaN(val)) && durationMin <= durationMax && gapMin <= gapMax && durationMin > 0)) return undefined;
    return { durationMin, durationMax, gapMin, gapMax };
  }

  const { value } = await Swal.fire({
    input: 'text',
    showCancelButton: true,
    inputValue: 'Duration 3 to 5, Gap 0 to 2',
    text: i18n.t('Divide timeline into segments with randomized durations and gaps between segments, in a range specified in seconds with the correct format.'),
    inputValidator: (v) => {
      const parsed = parse(v);
      if (!parsed) return i18n.t('Invalid input');
      return null;
    },
  });

  if (value == null) return undefined;

  return parse(value);
}

async function askForSegmentsStartOrEnd(text: string) {
  const { value } = await Swal.fire<string>({
    input: 'radio',
    showCancelButton: true,
    inputOptions: {
      start: i18n.t('Start'),
      end: i18n.t('End'),
      both: i18n.t('Both'),
    },
    inputValue: 'both',
    text,
  });
  if (!value) return undefined;

  return value === 'both' ? ['start', 'end'] as const : [value as 'start' | 'end'] as const;
}

export async function askForShiftSegments({ inputPlaceholder, parseTimecode }: {
  inputPlaceholder: string,
  parseTimecode: ParseTimecode,
}) {
  function parseValue(value: string) {
    let parseableValue = value;
    let sign = 1;
    if (parseableValue[0] === '-') {
      parseableValue = parseableValue.slice(1);
      sign = -1;
    }
    const duration = parseTimecode(parseableValue);
    if (duration != null && duration > 0) {
      return duration * sign;
    }
    return undefined;
  }

  const { value } = await Swal.fire<string>({
    input: 'text',
    showCancelButton: true,
    inputValue: inputPlaceholder,
    text: i18n.t('Shift all segments on the timeline by this amount. Negative values will be shifted back, while positive value will be shifted forward in time.'),
    inputValidator: (v) => {
      const parsed = parseValue(v);
      if (parsed == null) return i18n.t('Please input a valid duration. Example: {{example}}', { example: inputPlaceholder });
      return null;
    },
  });

  if (value == null) return undefined;
  const parsed = parseValue(value);
  invariant(parsed != null);

  const startOrEnd = await askForSegmentsStartOrEnd(i18n.t('Do you want to shift the start or end timestamp by {{time}}?', { time: formatDuration({ seconds: parsed, shorten: true }) }));
  if (startOrEnd == null) return undefined;

  return {
    shiftAmount: parsed,
    shiftKeys: startOrEnd,
  };
}


export async function askForAlignSegments() {
  const startOrEnd = await askForSegmentsStartOrEnd(i18n.t('Do you want to align the segment start or end timestamps to keyframes?'));
  if (startOrEnd == null) return undefined;

  const { value: mode } = await Swal.fire<FindKeyframeMode>({
    input: 'radio',
    showCancelButton: true,
    inputOptions: {
      nearest: i18n.t('Nearest keyframe'),
      before: i18n.t('Previous keyframe'),
      after: i18n.t('Next keyframe'),
    } satisfies Record<FindKeyframeMode, unknown>,
    inputValue: 'before',
    text: i18n.t('Do you want to align segment times to the nearest, previous or next keyframe?'),
  });

  if (mode == null) return undefined;

  return {
    mode,
    startOrEnd,
  };
}

export interface CleanupChoicesType {
  trashTmpFiles: boolean,
  closeFile: boolean,
  askForCleanup: boolean,
  cleanupAfterExport?: boolean | undefined,
  trashSourceFile?: boolean,
  trashProjectFile?: boolean,
  deleteIfTrashFails?: boolean,
}
export type CleanupChoice = keyof CleanupChoicesType;


const CleanupChoices = ({ cleanupChoicesInitial, onChange: onChangeProp }: { cleanupChoicesInitial: CleanupChoicesType, onChange: (v: CleanupChoicesType) => void }) => {
  const [choices, setChoices] = useState(cleanupChoicesInitial);

  const getVal = (key: CleanupChoice) => !!choices[key];

  const onChange = (key: CleanupChoice, val: boolean | string) => setChoices((oldChoices) => {
    const newChoices = { ...oldChoices, [key]: Boolean(val) };
    if ((newChoices.trashSourceFile || newChoices.trashTmpFiles) && !newChoices.closeFile) {
      newChoices.closeFile = true;
    }
    onChangeProp(newChoices);
    return newChoices;
  });

  const trashTmpFiles = getVal('trashTmpFiles');
  const trashSourceFile = getVal('trashSourceFile');
  const trashProjectFile = getVal('trashProjectFile');
  const deleteIfTrashFails = getVal('deleteIfTrashFails');
  const closeFile = getVal('closeFile');
  const askForCleanup = getVal('askForCleanup');
  const cleanupAfterExport = getVal('cleanupAfterExport');

  return (
    <div style={{ textAlign: 'left' }}>
      <p>{i18n.t('What do you want to do after exporting a file or when pressing the "delete source file" button?')}</p>

      <Checkbox label={i18n.t('Close currently opened file')} checked={closeFile} disabled={trashSourceFile || trashTmpFiles} onCheckedChange={(checked) => onChange('closeFile', checked)} />

      <div style={{ marginTop: 25 }}>
        <Checkbox label={i18n.t('Trash auto-generated files')} checked={trashTmpFiles} onCheckedChange={(checked) => onChange('trashTmpFiles', checked)} />
        <Checkbox label={i18n.t('Trash original source file')} checked={trashSourceFile} onCheckedChange={(checked) => onChange('trashSourceFile', checked)} />
        <Checkbox label={i18n.t('Trash project LLC file')} checked={trashProjectFile} onCheckedChange={(checked) => onChange('trashProjectFile', checked)} />
        <Checkbox label={i18n.t('Permanently delete the files if trash fails?')} disabled={!(trashTmpFiles || trashProjectFile || trashSourceFile)} checked={deleteIfTrashFails} onCheckedChange={(checked) => onChange('deleteIfTrashFails', checked)} />
      </div>

      <div style={{ marginTop: 25 }}>
        <Checkbox label={i18n.t('Show this dialog every time?')} checked={askForCleanup} onCheckedChange={(checked) => onChange('askForCleanup', checked)} />
        <Checkbox label={i18n.t('Do all of this automatically after exporting a file?')} checked={cleanupAfterExport} onCheckedChange={(checked) => onChange('cleanupAfterExport', checked)} />
      </div>
    </div>
  );
};

export async function showCleanupFilesDialog(cleanupChoicesIn: CleanupChoicesType) {
  let cleanupChoices = cleanupChoicesIn;

  const { value } = await ReactSwal.fire<string>({
    title: i18n.t('Cleanup files?'),
    html: <CleanupChoices cleanupChoicesInitial={cleanupChoices} onChange={(newChoices) => { cleanupChoices = newChoices; }} />,
    confirmButtonText: i18n.t('Confirm'),
    confirmButtonColor: '#d33',
    showCancelButton: true,
    cancelButtonText: i18n.t('Cancel'),
  });

  if (value) return cleanupChoices;
  return undefined;
}

function parseBytesHuman(str: string) {
  const match = str.replaceAll(/\s/g, '').match(/^(\d+)([gkmt]?)b$/i);
  if (!match) return undefined;
  const size = parseInt(match[1]!, 10);
  const unit = match[2]!.toLowerCase();
  if (unit === 't') return size * 1024 * 1024 * 1024 * 1024;
  if (unit === 'g') return size * 1024 * 1024 * 1024;
  if (unit === 'm') return size * 1024 * 1024;
  if (unit === 'k') return size * 1024;
  return size;
}

export async function createFixedByteSixedSegments({ fileDuration, fileSize }: {
  fileDuration: number, fileSize: number,
}) {
  const example = '100 MB';
  const { value } = await Swal.fire({
    input: 'text',
    showCancelButton: true,
    inputValue: example,
    inputPlaceholder: example,
    text: i18n.t('Divide timeline into a number of segments with an approximate byte size'),
    inputValidator: (v) => {
      const bytes = parseBytesHuman(v);
      if (bytes != null) return undefined;
      return i18n.t('Please input a valid size. Example: {{example}}', { example });
    },
  });

  if (value == null) return undefined;

  const parsed = parseBytesHuman(value);
  invariant(parsed != null);

  return fileDuration * (parsed / fileSize);
}


export async function createRandomSegments(totalDuration: number) {
  const response = await askForSegmentsRandomDurationRange();
  if (response == null) return undefined;

  const { durationMin, durationMax, gapMin, gapMax } = response;

  const randomInRange = (min: number, max: number) => min + Math.random() * (max - min);

  const edl: { start: number, end: number }[] = [];
  for (let start = randomInRange(gapMin, gapMax); start < totalDuration && edl.length < maxSegments; start += randomInRange(gapMin, gapMax)) {
    const end = Math.min(totalDuration, start + randomInRange(durationMin, durationMax));
    edl.push({ start, end });
    start = end;
  }
  return edl;
}

const MovSuggestion = ({ fileFormat }: { fileFormat: string | undefined }) => (fileFormat === 'mp4' ? <li><Trans>Change output <b>Format</b> from <b>MP4</b> to <b>MOV</b></Trans></li> : null);
const OutputFormatSuggestion = () => <li><Trans>Select a different output <b>Format</b> (<b>matroska</b> and <b>mp4</b> support most codecs)</Trans></li>;
const WorkingDirectorySuggestion = () => <li><Trans>Set a different <b>Working directory</b></Trans></li>;
const DifferentFileSuggestion = () => <li><Trans>Try with a <b>Different file</b></Trans></li>;
const HelpSuggestion = () => <li><Trans>See <b>Help</b></Trans> menu</li>;
const ErrorReportSuggestion = () => <li><Trans>If nothing helps, you can send an <b>Error report</b></Trans></li>;

export async function showExportFailedDialog({ fileFormat, safeOutputFileName }: { fileFormat: string | undefined, safeOutputFileName: boolean }) {
  const html = (
    <div style={{ textAlign: 'left' }}>
      <Trans>Try one of the following before exporting again:</Trans>
      <ol>
        {!safeOutputFileName && <li><Trans>Output file names are not sanitized. Try to enable sanitazion or check your segment labels for invalid characters.</Trans></li>}
        <MovSuggestion fileFormat={fileFormat} />
        <OutputFormatSuggestion />
        <li><Trans>Disable unnecessary <b>Tracks</b></Trans></li>
        <li><Trans>Try both <b>Normal cut</b> and <b>Keyframe cut</b></Trans></li>
        <WorkingDirectorySuggestion />
        <DifferentFileSuggestion />
        <HelpSuggestion />
        <ErrorReportSuggestion />
      </ol>
    </div>
  );

  const { value } = await ReactSwal.fire({ title: i18n.t('Unable to export this file'), html, showConfirmButton: true, showCancelButton: true, cancelButtonText: i18n.t('OK'), confirmButtonText: i18n.t('Report'), reverseButtons: true, focusCancel: true });
  return value;
}

export async function showConcatFailedDialog({ fileFormat }: { fileFormat: string | undefined }) {
  const html = (
    <div style={{ textAlign: 'left' }}>
      <Trans>Try each of the following before merging again:</Trans>
      <ol>
        <MovSuggestion fileFormat={fileFormat} />
        <OutputFormatSuggestion />
        <li><Trans>Disable <b>merge options</b></Trans></li>
        <WorkingDirectorySuggestion />
        <DifferentFileSuggestion />
        <HelpSuggestion />
        <ErrorReportSuggestion />
      </ol>
    </div>
  );

  const { value } = await ReactSwal.fire({ title: i18n.t('Unable to merge files'), html, showConfirmButton: true, showCancelButton: true, cancelButtonText: i18n.t('OK'), confirmButtonText: i18n.t('Report'), reverseButtons: true, focusCancel: true });
  return value;
}

export async function openYouTubeChaptersDialog(text: string) {
  await ReactSwal.fire({
    showCloseButton: true,
    title: i18n.t('YouTube Chapters'),
    html: (
      <div style={{ textAlign: 'left', overflow: 'auto', maxHeight: 300, overflowY: 'auto' }}>

        <p>{i18n.t('Copy to YouTube description/comment:')} <CopyClipboardButton text={text} /></p>

        <div style={{ fontWeight: 600, fontSize: 12, whiteSpace: 'pre-wrap' }} contentEditable suppressContentEditableWarning>
          {text}
        </div>
      </div>
    ),
  });
}

export async function labelSegmentDialog({ currentName, maxLength }: { currentName: string, maxLength: number }) {
  const { value } = await Swal.fire({
    showCancelButton: true,
    title: i18n.t('Label current segment'),
    inputValue: currentName,
    input: currentName.includes('\n') ? 'textarea' : 'text',
    inputValidator: (v: string) => (v.length > maxLength ? `${i18n.t('Max length')} ${maxLength}` : null),
  });
  return value;
}

export async function selectSegmentsByLabelDialog(currentName?: string | undefined) {
  const { value } = await Swal.fire({
    showCancelButton: true,
    title: i18n.t('Select segments by label'),
    inputValue: currentName,
    input: 'text',
  });
  return value;
}

export const UnorderedList = ({ children }: { children: ReactNode }) => (
  <ul style={{ paddingLeft: '1em' }}>{children}</ul>
);
export const ListItem = ({ icon, iconColor, children, style }: { icon: ReactNode, iconColor?: string, children: ReactNode, style?: CSSProperties }) => (
  <li style={{ listStyle: 'none', color: iconColor, ...style }}>
    <span style={{ fontSize: '.8em', marginRight: '.3em' }}>{icon}</span>
    {children}
  </li>
);

export const Notices = ({ notices }: { notices: string[] }) => notices.map((msg) => (
  <ListItem key={msg} icon={<FaInfoCircle />} iconColor="var(--blue-9)">{msg}</ListItem>
));
export const Warnings = ({ warnings }: { warnings: string[] }) => warnings.map((msg) => (
  <ListItem key={msg} icon={<FaExclamationTriangle />} iconColor="var(--orange-8)">{msg}</ListItem>
));
export const OutputIncorrectSeeHelpMenu = () => (
  <ListItem icon={<FaQuestionCircle />}>{i18n.t('If output does not look right, see the Help menu.')}</ListItem>
);

export async function askForPlaybackRate({ detectedFps, outputPlaybackRate }: { detectedFps: number | undefined, outputPlaybackRate: number }) {
  const fps = detectedFps || 1;
  const currentFps = fps * outputPlaybackRate;

  function parseValue(v: string) {
    if (v.trim() === '') return 1; // default to 1 if empty

    const newFps = parseFloat(v);
    if (!Number.isNaN(newFps)) {
      return newFps / fps;
    }
    return undefined;
  }

  const { value, isConfirmed } = await Swal.fire<string>({
    title: i18n.t('Change FPS'),
    input: 'text',
    inputValue: currentFps.toFixed(5),
    text: i18n.t('This option lets you losslessly change the speed at which media players will play back the exported file. For example if you double the FPS, the playback speed will double (and duration will halve), however all the frames will be intact and played back (but faster). Be careful not to set it too high, as the player might not be able to keep up (playback CPU usage will increase proportionally to the speed!)'),
    showCancelButton: true,
    inputValidator: (v) => {
      const parsed = parseValue(v);
      if (parsed != null) return null;
      return i18n.t('Please enter a valid number.');
    },
  });

  if (!isConfirmed || value == null) return undefined;

  return parseValue(value);
}

export async function promptDownloadMediaUrl(outPath: string) {
  const { value } = await Swal.fire<string>({
    title: i18n.t('Open media from URL'),
    input: 'text',
    inputPlaceholder: 'https://example.com/video.m3u8',
    text: i18n.t('Losslessly download a whole media file from the specified URL, mux it into an mkv file and open it in LosslessCut. This can be useful if you need to download a video from a website, e.g. a HLS streaming video. For example in Chrome you can open Developer Tools and view the network traffic, find the playlist (e.g. m3u8) and copy paste its URL here.'),
    showCancelButton: true,
  });

  if (!value) return false;

  await downloadMediaUrl(value, outPath);
  return true;
}
