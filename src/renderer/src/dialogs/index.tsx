import { CSSProperties, ReactNode, useState } from 'react';
import { ArrowRightIcon, HelpIcon, TickCircleIcon, WarningSignIcon, InfoSignIcon, IconComponent } from 'evergreen-ui';
import i18n from 'i18next';
import { Trans } from 'react-i18next';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { tomorrow as lightSyntaxStyle, tomorrowNight as darkSyntaxStyle } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import JSON5 from 'json5';
import type { SweetAlertOptions } from 'sweetalert2';
import invariant from 'tiny-invariant';

import { formatDuration } from '../util/duration';
import Swal, { ReactSwal, swalToastOptions, toast } from '../swal';
import { parseYouTube } from '../edlFormats';
import CopyClipboardButton from '../components/CopyClipboardButton';
import Checkbox from '../components/Checkbox';
import { isWindows, showItemInFolder } from '../util';
import { ParseTimecode } from '../types';
import { FindKeyframeMode } from '../ffmpeg';
import Action from '../components/Action';

const remote = window.require('@electron/remote');
const { dialog, shell } = remote;

const { downloadMediaUrl } = remote.require('./index.js');


export async function promptTimecode({ initialValue, title, text, inputPlaceholder, parseTimecode, allowRelative = false }: {
  initialValue?: string | undefined, title: string, text?: string | undefined, inputPlaceholder: string, parseTimecode: ParseTimecode, allowRelative?: boolean,
}) {
  const { value } = await Swal.fire<string>({
    title,
    text,
    input: 'text',
    inputValue: initialValue || '',
    didOpen: () => {
      Swal.getInput()!.select();
    },
    showCancelButton: true,
    inputPlaceholder,
  });

  if (value === undefined) {
    return undefined;
  }

  let relDirection: number | undefined;
  if (allowRelative) {
    if (value.startsWith('-')) relDirection = -1;
    else if (value.startsWith('+')) relDirection = 1;
  }

  const value2 = allowRelative ? value.replace(/^[+-]/, '') : value;

  const duration = parseTimecode(value2);
  // Invalid, try again
  if (duration === undefined) return promptTimecode({ initialValue: value, title, text, inputPlaceholder, parseTimecode, allowRelative });

  return {
    duration,
    relDirection,
  };
}

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
            <ArrowRightIcon style={{ color: 'var(--gray-10)' }} verticalAlign="middle" /> {text}
          </button>
        ))}

        <button type="button" onClick={() => onClick()} className="button-unstyled" style={{ display: 'block', marginTop: '.5em' }}>
          <ArrowRightIcon style={{ color: 'var(--red-11)' }} /> {i18n.t('Cancel')}
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

const maxSegments = 300;

async function askForNumSegments() {
  const { value } = await Swal.fire({
    input: 'number',
    inputAttributes: {
      min: 0 as unknown as string,
      max: maxSegments as unknown as string,
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

export async function createNumSegments(fileDuration: number) {
  const numSegments = await askForNumSegments();
  if (numSegments == null) return undefined;
  const edl: { start: number, end: number }[] = [];
  const segDuration = fileDuration / numSegments;
  for (let i = 0; i < numSegments; i += 1) {
    edl.push({ start: i * segDuration, end: i === numSegments - 1 ? fileDuration : (i + 1) * segDuration });
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
        if (segmentDuration > 0 && segmentDuration < fileDuration && numSegments <= maxSegments) return null;
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

export async function confirmExtractAllStreamsDialog() {
  const { value } = await Swal.fire<string>({
    text: i18n.t('Please confirm that you want to extract all tracks as separate files'),
    showCancelButton: true,
    confirmButtonText: i18n.t('Extract all tracks'),
  });
  return !!value;
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

  const { value } = await ReactSwal.fire({ title: i18n.t('Unable to export this file'), html, timer: null as unknown as undefined, showConfirmButton: true, showCancelButton: true, cancelButtonText: i18n.t('OK'), confirmButtonText: i18n.t('Report'), reverseButtons: true, focusCancel: true });
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

  const { value } = await ReactSwal.fire({ title: i18n.t('Unable to merge files'), html, timer: null as unknown as undefined, showConfirmButton: true, showCancelButton: true, cancelButtonText: i18n.t('OK'), confirmButtonText: i18n.t('Report'), reverseButtons: true, focusCancel: true });
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

export async function exprDialog({ inputValidator, examples, title, description, variables, inputValue }: {
  inputValidator: (v: string) => Promise<string | undefined>,
  examples: { name: string, code: string }[],
  title: string,
  description: ReactNode,
  variables?: string[],
  inputValue?: string | undefined,
}) {
  function addExample(code: string) {
    Swal.getInput()!.value = code;
  }

  const { value } = await ReactSwal.fire<string>({
    showCancelButton: true,
    title,
    input: 'text',
    width: '90vw',
    html: (
      <div style={{ textAlign: 'left' }}>
        <div style={{ marginBottom: '1em' }}>
          {description}
        </div>

        {variables && <div style={{ marginBottom: '1em' }}>{i18n.t('Variables')}: <span style={{ display: 'inline-flex', gap: '.5em' }}>{variables.map((v) => <code key={v} className="highlighted">{v}</code>)}</span></div>}

        <div><b>{i18n.t('Examples')}:</b></div>

        {examples.map(({ name, code }) => (
          <button key={code} type="button" onClick={() => addExample(code)} className="link-button" style={{ display: 'block', marginBottom: '.1em' }}>
            {name}
          </button>
        ))}
      </div>
    ),
    inputValue,
    inputPlaceholder: i18n.t('Enter JavaScript expression'),
    inputValidator,
  });
  return value;
}

export async function selectSegmentsByExprDialog(inputValidator: (v: string) => Promise<string | undefined>) {
  return exprDialog({
    inputValidator,
    examples: [
      { name: i18n.t('Segment duration less than 5 seconds'), code: 'segment.duration < 5' },
      { name: i18n.t('Segment starts after 01:00'), code: 'segment.start > 60' },
      { name: i18n.t('Segment label (exact)'), code: "segment.label === 'My label'" },
      { name: i18n.t('Segment label (regexp)'), code: '/^My label/.test(segment.label)' },
      { name: i18n.t('Segment tag value'), code: "segment.tags.myTag === 'tag value'" },
      { name: i18n.t('Markers'), code: 'segment.end == null' },
    ],
    title: i18n.t('Select segments by expression'),
    description: <Trans>Enter a JavaScript expression which will be evaluated for each segment. Segments for which the expression evaluates to &quot;true&quot; will be selected. <button type="button" className="link-button" onClick={() => shell.openExternal('https://github.com/mifi/lossless-cut/blob/master/expressions.md')}>View available syntax.</button></Trans>,
    variables: ['segment.index', 'segment.label', 'segment.start', 'segment.end', 'segment.duration', 'segment.tags.*'],
  });
}

export async function filterEnabledStreamsDialog({ validator, value }: {
  validator: (v: string) => Promise<string | undefined>,
  value: string | undefined,
}) {
  return exprDialog({
    inputValidator: validator,
    examples: [
      { name: i18n.t('Audio tracks'), code: "track.codec_type === 'audio'" },
      { name: i18n.t('Video tracks'), code: "track.codec_type === 'video'" },
      { name: i18n.t('English language tracks'), code: "track.tags?.language === 'eng'" },
      { name: i18n.t('Tracks with at least 720p video'), code: 'track.height >= 720' },
      { name: i18n.t('Tracks with H264 codec'), code: "track.codec_name === 'h264'" },
      { name: i18n.t('1st, 2nd and 3rd track'), code: 'track.index >= 0 && track.index <= 2' },
    ],
    title: i18n.t('Toggle tracks by expression'),
    description: <Trans>Enter a JavaScript filter expression which will be evaluated for each track of the current file. Tracks for which the expression evaluates to &quot;true&quot; will be selected or deselected. You may also the <Action name="toggleStripCurrentFilter" /> keyboard action to run this filter.</Trans>,
    inputValue: value ?? '',
  });
}

export async function mutateSegmentsByExprDialog(inputValidator: (v: string) => Promise<string | undefined>) {
  return exprDialog({
    inputValidator,
    examples: [
      { name: i18n.t('Expand segments +5 sec'), code: '{ start: segment.start - 5, end: segment.end + 5 }' },
      { name: i18n.t('Shrink segments -5 sec'), code: '{ start: segment.start + 5, end: segment.end - 5 }' },
      { name: i18n.t('Center segments around start time'), code: '{ start: segment.start - 5, end: segment.start + 5 }' },
      // eslint-disable-next-line no-template-curly-in-string
      { name: i18n.t('Add number suffix to label'), code: '{ label: `${segment.label} ${segment.index + 1}` }' },
      { name: i18n.t('Add a tag to every even segment'), code: '{ tags: (segment.index + 1) % 2 === 0 ? { ...segment.tags, even: \'true\' } : segment.tags }' },
      { name: i18n.t('Convert segments to markers'), code: '{ end: undefined }' },
      { name: i18n.t('Convert markers to segments'), code: '{ ...(segment.end == null && { end: segment.start + 5 }) }' },
    ],
    title: i18n.t('Edit segments by expression'),
    description: <Trans>Enter a JavaScript expression which will be evaluated for each selected segment. Returned properties will be edited. <button type="button" className="link-button" onClick={() => shell.openExternal('https://github.com/mifi/lossless-cut/blob/master/expressions.md')}>View available syntax.</button></Trans>,
    variables: ['segment.index', 'segment.label', 'segment.start', 'segment.end', 'segment.tags.*'],
  });
}

export function showJson5Dialog({ title, json, darkMode }: { title: string, json: unknown, darkMode: boolean }) {
  const html = (
    <SyntaxHighlighter language="javascript" style={darkMode ? darkSyntaxStyle : lightSyntaxStyle} customStyle={{ textAlign: 'left', maxHeight: 300, overflowY: 'auto', fontSize: 14 }}>
      {JSON5.stringify(json, null, 2)}
    </SyntaxHighlighter>
  );

  ReactSwal.fire({
    showCloseButton: true,
    title,
    html,
    width: '50em',
  });
}

export async function openDirToast({ filePath, text, html, ...props }: SweetAlertOptions & { filePath: string }) {
  const swal = text ? toast : ReactSwal;

  // @ts-expect-error todo
  const { value } = await swal.fire<string>({
    ...swalToastOptions,
    showConfirmButton: true,
    confirmButtonText: i18n.t('Show'),
    showCancelButton: true,
    cancelButtonText: i18n.t('Close'),
    text,
    html,
    ...props,
  });
  if (value) showItemInFolder(filePath);
}

const UnorderedList = ({ children }: { children: ReactNode }) => (
  <ul style={{ paddingLeft: '1em' }}>{children}</ul>
);
const ListItem = ({ icon: Icon, iconColor, children, style }: { icon: IconComponent, iconColor?: string, children: ReactNode, style?: CSSProperties }) => (
  <li style={{ listStyle: 'none', ...style }}>
    {Icon && <Icon style={{ color: iconColor }} size={14} marginRight=".4em" />}
    {children}
  </li>
);

const Notices = ({ notices }: { notices: string[] }) => notices.map((msg) => (
  <ListItem key={msg} icon={InfoSignIcon} iconColor="var(--blue-9)">{msg}</ListItem>
));
const Warnings = ({ warnings }: { warnings: string[] }) => warnings.map((msg) => (
  <ListItem key={msg} icon={WarningSignIcon} iconColor="var(--orange-8)">{msg}</ListItem>
));
const OutputIncorrectSeeHelpMenu = () => (
  <ListItem icon={HelpIcon}>{i18n.t('If output does not look right, see the Help menu.')}</ListItem>
);

export async function openExportFinishedToast({ filePath, warnings, notices }: { filePath: string, warnings: string[], notices: string[] }) {
  const hasWarnings = warnings.length > 0;
  const html = (
    <UnorderedList>
      <ListItem icon={TickCircleIcon} iconColor={hasWarnings ? 'var(--orange-8)' : 'var(--green-11)'} style={{ fontWeight: 'bold' }}>{hasWarnings ? i18n.t('Export finished with warning(s)', { count: warnings.length }) : i18n.t('Export is done!')}</ListItem>
      <ListItem icon={InfoSignIcon}>{i18n.t('Please test the output file in your desired player/editor before you delete the source file.')}</ListItem>
      <OutputIncorrectSeeHelpMenu />
      <Notices notices={notices} />
      <Warnings warnings={warnings} />
    </UnorderedList>
  );

  // https://github.com/mifi/lossless-cut/issues/2048
  await openDirToast({ filePath, html, width: 800, position: 'center', timer: undefined });
}

export async function openConcatFinishedToast({ filePath, warnings, notices }: { filePath: string, warnings: string[], notices: string[] }) {
  const hasWarnings = warnings.length > 0;
  const html = (
    <UnorderedList>
      <ListItem icon={TickCircleIcon} iconColor={hasWarnings ? 'warning' : 'success'} style={{ fontWeight: 'bold' }}>{hasWarnings ? i18n.t('Files merged with warning(s)', { count: warnings.length }) : i18n.t('Files merged!')}</ListItem>
      <ListItem icon={InfoSignIcon}>{i18n.t('Please test the output files in your desired player/editor before you delete the source files.')}</ListItem>
      <OutputIncorrectSeeHelpMenu />
      <Notices notices={notices} />
      <Warnings warnings={warnings} />
    </UnorderedList>
  );

  await openDirToast({ filePath, html, width: 800, position: 'center', timer: 30000 });
}

export async function askForPlaybackRate({ detectedFps, outputPlaybackRate }: { detectedFps: number | undefined, outputPlaybackRate: number }) {
  const fps = detectedFps || 1;
  const currentFps = fps * outputPlaybackRate;

  function parseValue(v: string) {
    const newFps = parseFloat(v);
    if (!Number.isNaN(newFps)) {
      return newFps / fps;
    }
    return undefined;
  }

  const { value } = await Swal.fire({
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

  if (!value) return undefined;

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
