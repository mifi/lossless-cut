import React, { useState } from 'react';
import { HelpIcon, TickCircleIcon, WarningSignIcon, InfoSignIcon, Checkbox } from 'evergreen-ui';
import i18n from 'i18next';
import { Trans } from 'react-i18next';
import withReactContent from 'sweetalert2-react-content';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { tomorrow as style } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import JSON5 from 'json5';

import { parseDuration, formatDuration } from '../util/duration';
import Swal, { swalToastOptions, toast } from '../swal';
import { parseYouTube } from '../edlFormats';
import CopyClipboardButton from '../components/CopyClipboardButton';
import { isWindows } from '../util';

const { dialog } = window.require('@electron/remote');
const { shell } = window.require('electron');

const ReactSwal = withReactContent(Swal);

export async function promptTimeOffset({ initialValue, title, text }) {
  const { value } = await Swal.fire({
    title,
    text,
    input: 'text',
    inputValue: initialValue || '',
    showCancelButton: true,
    inputPlaceholder: '00:00:00.000',
  });

  if (value === undefined) {
    return undefined;
  }

  const duration = parseDuration(value);
  // Invalid, try again
  if (duration === undefined) return promptTimeOffset({ initialValue: value, title, text });

  return duration;
}

// https://github.com/mifi/lossless-cut/issues/1495
export const showOpenDialog = async ({
  filters = isWindows ? [{ name: i18n.t('All Files'), extensions: ['*'] }] : undefined,
  ...props
}) => dialog.showOpenDialog({ ...props, filters });

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
        if (edl.length > 0) return undefined;
      }
      return i18n.t('Please input a valid format.');
    },
  });

  return parseYouTube(value);
}

export async function askForInputDir(defaultPath) {
  const { filePaths } = await showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    defaultPath,
    title: i18n.t('Please confirm folder'),
    message: i18n.t('Press confirm to grant LosslessCut access to write the project file (due to App Sandbox restrictions).'),
    buttonLabel: i18n.t('Confirm'),
  });
  return (filePaths && filePaths.length === 1) ? filePaths[0] : undefined;
}

export async function askForOutDir(defaultPath) {
  const { filePaths } = await showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    defaultPath,
    title: i18n.t('Where do you want to save output files?'),
    message: i18n.t('Where do you want to save output files? Make sure there is enough free space in this folder'),
    buttonLabel: i18n.t('Select output folder'),
  });
  return (filePaths && filePaths.length === 1) ? filePaths[0] : undefined;
}

export async function askForFfPath(defaultPath) {
  const { filePaths } = await showOpenDialog({
    properties: ['openDirectory'],
    defaultPath,
    title: i18n.t('Select custom FFmpeg directory'),
  });
  return (filePaths && filePaths.length === 1) ? filePaths[0] : undefined;
}

export async function askForFileOpenAction(inputOptions) {
  const { value } = await Swal.fire({
    text: i18n.t('You opened a new file. What do you want to do?'),
    icon: 'question',
    input: 'radio',
    inputValue: 'open',
    showCancelButton: true,
    customClass: { input: 'swal2-losslesscut-radio' },
    inputOptions,
    inputValidator: (v) => !v && i18n.t('You need to choose something!'),
  });

  return value;
}

export async function showDiskFull() {
  await Swal.fire({
    icon: 'error',
    text: i18n.t('You ran out of space'),
  });
}

export async function showRefuseToOverwrite() {
  await Swal.fire({
    icon: 'warning',
    text: i18n.t('Output file already exists, refusing to overwrite. You can turn on overwriting in settings.'),
  });
}

export async function askForImportChapters() {
  const { value } = await Swal.fire({
    icon: 'question',
    text: i18n.t('This file has embedded chapters. Do you want to import the chapters as cut-segments?'),
    showCancelButton: true,
    cancelButtonText: i18n.t('Ignore chapters'),
    confirmButtonText: i18n.t('Import chapters'),
  });

  return value;
}

const maxSegments = 300;

async function askForNumSegments() {
  const { value } = await Swal.fire({
    input: 'number',
    inputAttributes: {
      min: 0,
      max: maxSegments,
    },
    showCancelButton: true,
    inputValue: '2',
    text: i18n.t('Divide timeline into a number of equal length segments'),
    inputValidator: (v) => {
      const parsed = parseInt(v, 10);
      if (!Number.isNaN(parsed) && parsed >= 2 && parsed <= maxSegments) return undefined;
      return i18n.t('Please input a valid number of segments');
    },
  });

  if (value == null) return undefined;

  return parseInt(value, 10);
}

export async function createNumSegments(fileDuration) {
  const numSegments = await askForNumSegments();
  if (numSegments == null) return undefined;
  const edl = [];
  const segDuration = fileDuration / numSegments;
  for (let i = 0; i < numSegments; i += 1) {
    edl.push({ start: i * segDuration, end: i === numSegments - 1 ? undefined : (i + 1) * segDuration });
  }
  return edl;
}

const exampleDuration = '00:00:05.123';

async function askForSegmentDuration(fileDuration) {
  const { value } = await Swal.fire({
    input: 'text',
    showCancelButton: true,
    inputValue: '00:00:00.000',
    text: i18n.t('Divide timeline into a number of segments with the specified length'),
    inputValidator: (v) => {
      const duration = parseDuration(v);
      if (duration != null) {
        const numSegments = Math.ceil(fileDuration / duration);
        if (duration > 0 && duration < fileDuration && numSegments <= maxSegments) return undefined;
      }
      return i18n.t('Please input a valid duration. Example: {{example}}', { example: exampleDuration });
    },
  });

  if (value == null) return undefined;

  return parseDuration(value);
}

// https://github.com/mifi/lossless-cut/issues/1153
async function askForSegmentsRandomDurationRange() {
  function parse(str) {
    const match = str.replace(/\s/g, '').match(/^duration([\d.]+)to([\d.]+),gap([-\d.]+)to([-\d.]+)$/i);
    if (!match) return undefined;
    const values = match.slice(1);
    const parsed = values.map((val) => parseFloat(val));

    const durationMin = parsed[0];
    const durationMax = parsed[1];
    const gapMin = parsed[2];
    const gapMax = parsed[3];

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
      return undefined;
    },
  });

  if (value == null) return undefined;

  return parse(value);
}

async function askForSegmentsStartOrEnd(text) {
  const { value } = await Swal.fire({
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

  return value === 'both' ? ['start', 'end'] : [value];
}

export async function askForShiftSegments() {
  function parseValue(value) {
    let parseableValue = value;
    let sign = 1;
    if (parseableValue[0] === '-') {
      parseableValue = parseableValue.substring(1);
      sign = -1;
    }
    const duration = parseDuration(parseableValue);
    if (duration != null && duration > 0) {
      return duration * sign;
    }
    return undefined;
  }

  const { value } = await Swal.fire({
    input: 'text',
    showCancelButton: true,
    inputValue: '00:00:00.000',
    text: i18n.t('Shift all segments on the timeline by this amount. Negative values will be shifted back, while positive value will be shifted forward in time.'),
    inputValidator: (v) => {
      const parsed = parseValue(v);
      if (parsed == null) return i18n.t('Please input a valid duration. Example: {{example}}', { example: exampleDuration });
      return undefined;
    },
  });

  if (value == null) return undefined;
  const parsed = parseValue(value);

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

  const { value: mode } = await Swal.fire({
    input: 'radio',
    showCancelButton: true,
    inputOptions: {
      nearest: i18n.t('Nearest keyframe'),
      before: i18n.t('Previous keyframe'),
      after: i18n.t('Next keyframe'),
    },
    inputValue: 'before',
    text: i18n.t('Do you want to align segment times to the nearest, previous or next keyframe?'),
  });

  if (mode == null) return undefined;

  return {
    mode,
    startOrEnd,
  };
}

export async function askForMetadataKey() {
  const { value } = await Swal.fire({
    title: i18n.t('Add metadata'),
    text: i18n.t('Enter metadata key'),
    input: 'text',
    showCancelButton: true,
    inputPlaceholder: 'metadata_key',
    inputValidator: (v) => v.includes('=') && i18n.t('Invalid character(s) found in key'),
  });
  return value;
}

export async function confirmExtractAllStreamsDialog() {
  const { value } = await Swal.fire({
    text: i18n.t('Please confirm that you want to extract all tracks as separate files'),
    showCancelButton: true,
    confirmButtonText: i18n.t('Extract all tracks'),
  });
  return !!value;
}

const CleanupChoices = ({ cleanupChoicesInitial, onChange: onChangeProp }) => {
  const [choices, setChoices] = useState(cleanupChoicesInitial);

  const getVal = (key) => !!choices[key];

  const onChange = (key, val) => setChoices((oldChoices) => {
    const newChoices = { ...oldChoices, [key]: val };
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

      <Checkbox label={i18n.t('Close currently opened file')} checked={closeFile} disabled={trashSourceFile || trashTmpFiles} onChange={(e) => onChange('closeFile', e.target.checked)} />

      <div style={{ marginTop: 25 }}>
        <Checkbox label={i18n.t('Trash auto-generated files')} checked={trashTmpFiles} onChange={(e) => onChange('trashTmpFiles', e.target.checked)} />
        <Checkbox label={i18n.t('Trash original source file')} checked={trashSourceFile} onChange={(e) => onChange('trashSourceFile', e.target.checked)} />
        <Checkbox label={i18n.t('Trash project LLC file')} checked={trashProjectFile} onChange={(e) => onChange('trashProjectFile', e.target.checked)} />
        <Checkbox label={i18n.t('Permanently delete the files if trash fails?')} disabled={!(trashTmpFiles || trashProjectFile || trashSourceFile)} checked={deleteIfTrashFails} onChange={(e) => onChange('deleteIfTrashFails', e.target.checked)} />
      </div>

      <div style={{ marginTop: 25 }}>
        <Checkbox label={i18n.t('Show this dialog every time?')} checked={askForCleanup} onChange={(e) => onChange('askForCleanup', e.target.checked)} />
        <Checkbox label={i18n.t('Do all of this automatically after exporting a file?')} checked={cleanupAfterExport} onChange={(e) => onChange('cleanupAfterExport', e.target.checked)} />
      </div>
    </div>
  );
};

export async function showCleanupFilesDialog(cleanupChoicesIn) {
  let cleanupChoices = cleanupChoicesIn;

  const { value } = await ReactSwal.fire({
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

export async function createFixedDurationSegments(fileDuration) {
  const segmentDuration = await askForSegmentDuration(fileDuration);
  if (segmentDuration == null) return undefined;
  const edl = [];
  for (let start = 0; start < fileDuration; start += segmentDuration) {
    const end = start + segmentDuration;
    edl.push({ start, end: end >= fileDuration ? undefined : end });
  }
  return edl;
}

export async function createRandomSegments(fileDuration) {
  const response = await askForSegmentsRandomDurationRange();
  if (response == null) return undefined;

  const { durationMin, durationMax, gapMin, gapMax } = response;

  const randomInRange = (min, max) => min + Math.random() * (max - min);

  const edl = [];
  for (let start = randomInRange(gapMin, gapMax); start < fileDuration && edl.length < maxSegments; start += randomInRange(gapMin, gapMax)) {
    const end = Math.min(fileDuration, start + randomInRange(durationMin, durationMax));
    edl.push({ start, end });
    start = end;
  }
  return edl;
}

const MovSuggestion = ({ fileFormat }) => fileFormat === 'mp4' && <li><Trans>Change output <b>Format</b> from <b>MP4</b> to <b>MOV</b></Trans></li>;
const OutputFormatSuggestion = () => <li><Trans>Select a different output <b>Format</b> (<b>matroska</b> and <b>mp4</b> support most codecs)</Trans></li>;
const WorkingDirectorySuggestion = () => <li><Trans>Set a different <b>Working directory</b></Trans></li>;
const DifferentFileSuggestion = () => <li><Trans>Try with a <b>Different file</b></Trans></li>;
const HelpSuggestion = () => <li><Trans>See <b>Help</b></Trans> menu</li>;
const ErrorReportSuggestion = () => <li><Trans>If nothing helps, you can send an <b>Error report</b></Trans></li>;

export async function showExportFailedDialog({ fileFormat, safeOutputFileName }) {
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

  const { value } = await ReactSwal.fire({ title: i18n.t('Unable to export this file'), html, timer: null, showConfirmButton: true, showCancelButton: true, cancelButtonText: i18n.t('OK'), confirmButtonText: i18n.t('Report'), reverseButtons: true, focusCancel: true });
  return value;
}

export async function showConcatFailedDialog({ fileFormat }) {
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

  const { value } = await ReactSwal.fire({ title: i18n.t('Unable to merge files'), html, timer: null, showConfirmButton: true, showCancelButton: true, cancelButtonText: i18n.t('OK'), confirmButtonText: i18n.t('Report'), reverseButtons: true, focusCancel: true });
  return value;
}

export function openYouTubeChaptersDialog(text) {
  ReactSwal.fire({
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

export async function labelSegmentDialog({ currentName, maxLength }) {
  const { value } = await Swal.fire({
    showCancelButton: true,
    title: i18n.t('Label current segment'),
    inputValue: currentName,
    input: 'text',
    inputValidator: (v) => (v.length > maxLength ? `${i18n.t('Max length')} ${maxLength}` : undefined),
  });
  return value;
}

export async function selectSegmentsByLabelDialog(currentName) {
  const { value } = await Swal.fire({
    showCancelButton: true,
    title: i18n.t('Select segments by label'),
    inputValue: currentName,
    input: 'text',
  });
  return value;
}

export async function selectSegmentsByTagDialog() {
  const { value: value1 } = await Swal.fire({
    showCancelButton: true,
    title: i18n.t('Select segments by tag'),
    text: i18n.t('Enter tag name (in the next dialog you\'ll enter tag value)'),
    input: 'text',
  });
  if (!value1) return undefined;

  const { value: value2 } = await Swal.fire({
    showCancelButton: true,
    title: i18n.t('Select segments by tag'),
    text: i18n.t('Enter tag value'),
    input: 'text',
  });
  if (!value2) return undefined;

  return { tagName: value1, tagValue: value2 };
}

export async function showEditableJsonDialog({ text, title, inputLabel, inputValue, inputValidator }) {
  const { value } = await Swal.fire({
    input: 'textarea',
    inputLabel,
    text,
    title,
    inputPlaceholder: JSON5.stringify({ exampleTag: 'Example value' }, null, 2),
    inputValue,
    showCancelButton: true,
    inputValidator,
  });
  return value;
}

export function showJson5Dialog({ title, json }) {
  const html = (
    <SyntaxHighlighter language="javascript" style={style} customStyle={{ textAlign: 'left', maxHeight: 300, overflowY: 'auto', fontSize: 14 }}>
      {JSON5.stringify(json, null, 2)}
    </SyntaxHighlighter>
  );

  ReactSwal.fire({
    showCloseButton: true,
    title,
    html,
  });
}

export async function openDirToast({ filePath, text, html, ...props }) {
  const swal = text ? toast : ReactSwal;

  const { value } = await swal.fire({
    ...swalToastOptions,
    showConfirmButton: true,
    confirmButtonText: i18n.t('Show'),
    showCancelButton: true,
    cancelButtonText: i18n.t('Close'),
    text,
    html,
    ...props,
  });
  if (value) shell.showItemInFolder(filePath);
}

const UnorderedList = ({ children }) => <ul style={{ paddingLeft: '1em' }}>{children}</ul>;
const ListItem = ({ icon: Icon, iconColor, children }) => <li style={{ listStyle: 'none' }}>{Icon && <Icon color={iconColor} size={14} marginRight=".3em" />} {children}</li>;

const Notices = ({ notices }) => notices.map((msg) => <ListItem key={msg} icon={InfoSignIcon} iconColor="info">{msg}</ListItem>);
const Warnings = ({ warnings }) => warnings.map((msg) => <ListItem key={msg} icon={WarningSignIcon} iconColor="warning">{msg}</ListItem>);
const OutputIncorrectSeeHelpMenu = () => <ListItem icon={HelpIcon}>{i18n.t('If output does not look right, see the Help menu.')}</ListItem>;

export async function openExportFinishedToast({ filePath, warnings, notices }) {
  const hasWarnings = warnings.length > 0;
  const html = (
    <UnorderedList>
      <ListItem icon={TickCircleIcon} iconColor={hasWarnings ? 'warning' : 'success'} fontWeight="bold">{hasWarnings ? i18n.t('Export finished with warning(s)', { count: warnings.length }) : i18n.t('Export is done!')}</ListItem>
      <ListItem icon={InfoSignIcon}>{i18n.t('Please test the output file in your desired player/editor before you delete the source file.')}</ListItem>
      <OutputIncorrectSeeHelpMenu />
      <Notices notices={notices} />
      <Warnings warnings={warnings} />
    </UnorderedList>
  );

  await openDirToast({ filePath, html, width: 800, position: 'center', timer: hasWarnings ? undefined : 30000 });
}

export async function openConcatFinishedToast({ filePath, warnings, notices }) {
  const hasWarnings = warnings.length > 0;
  const html = (
    <UnorderedList>
      <ListItem icon={TickCircleIcon} iconColor={hasWarnings ? 'warning' : 'success'} fontWeight="bold">{hasWarnings ? i18n.t('Files merged with warning(s)', { count: warnings.length }) : i18n.t('Files merged!')}</ListItem>
      <ListItem icon={InfoSignIcon}>{i18n.t('Please test the output files in your desired player/editor before you delete the source files.')}</ListItem>
      <OutputIncorrectSeeHelpMenu />
      <Notices notices={notices} />
      <Warnings warnings={warnings} />
    </UnorderedList>
  );

  await openDirToast({ filePath, html, width: 800, position: 'center', timer: 30000 });
}
