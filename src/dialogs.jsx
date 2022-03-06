import React, { useState, useCallback } from 'react';
import { Checkbox, RadioGroup, Paragraph } from 'evergreen-ui';
import Swal from 'sweetalert2';
import i18n from 'i18next';
import { Trans } from 'react-i18next';
import withReactContent from 'sweetalert2-react-content';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { tomorrow as style } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import JSON5 from 'json5';

import { parseDuration } from './util/duration';
import { parseYouTube } from './edlFormats';
import CopyClipboardButton from './components/CopyClipboardButton';

const electron = window.require('electron'); // eslint-disable-line

const { dialog, app } = electron.remote;

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


export async function askForHtml5ifySpeed({ allowedOptions, showRemember, initialOption }) {
  const availOptions = {
    fastest: i18n.t('Fastest: Low playback speed (no audio)'),
    'fastest-audio': i18n.t('Fastest: Low playback speed'),
    'fastest-audio-remux': i18n.t('Fastest: Low playback speed (audio remux), likely to fail'),
    fast: i18n.t('Fast: Full quality remux (no audio), likely to fail'),
    'fast-audio-remux': i18n.t('Fast: Full quality remux, likely to fail'),
    'fast-audio': i18n.t('Fast: Remux video, encode audio (fails if unsupported video codec)'),
    slow: i18n.t('Slow: Low quality encode (no audio)'),
    'slow-audio': i18n.t('Slow: Low quality encode'),
    slowest: i18n.t('Slowest: High quality encode'),
  };
  const inputOptions = {};
  allowedOptions.forEach((allowedOption) => {
    inputOptions[allowedOption] = availOptions[allowedOption];
  });

  let selectedOption = inputOptions[initialOption] ? initialOption : Object.keys(inputOptions)[0];
  let rememberChoice = !!initialOption;

  const Html = () => {
    const [option, setOption] = useState(selectedOption);
    const [remember, setRemember] = useState(rememberChoice);
    const onOptionChange = useCallback((e) => {
      selectedOption = e.target.value;
      setOption(selectedOption);
    }, []);
    const onRememberChange = useCallback((e) => {
      rememberChoice = e.target.checked;
      setRemember(rememberChoice);
    }, []);
    return (
      <div style={{ textAlign: 'left' }}>
        <Paragraph>{i18n.t('These options will let you convert files to a format that is supported by the player. You can try different options and see which works with your file. Note that the conversion is for preview only. When you run an export, the output will still be lossless with full quality')}</Paragraph>
        <RadioGroup
          options={Object.entries(inputOptions).map(([value, label]) => ({ label, value }))}
          value={option}
          onChange={onOptionChange}
        />
        {showRemember && <Checkbox checked={remember} onChange={onRememberChange} label={i18n.t('Use this for all files until LosslessCut is restarted?')} />}
      </div>
    );
  };

  const { value: response } = await ReactSwal.fire({
    title: i18n.t('Convert to supported format'),
    html: <Html />,
    showCancelButton: true,
  });

  return {
    selectedOption: response && selectedOption,
    remember: rememberChoice,
  };
}

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
  const { filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    defaultPath,
    title: i18n.t('Please confirm folder'),
    message: i18n.t('Press confirm to grant LosslessCut permissions to write the project file (This is due to App Sandbox restrictions)'),
    buttonLabel: i18n.t('Confirm'),
  });
  return (filePaths && filePaths.length === 1) ? filePaths[0] : undefined;
}

export async function askForOutDir(defaultPath) {
  const { filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    defaultPath,
    title: i18n.t('Where do you want to save output files?'),
    message: i18n.t('Where do you want to save output files? Make sure there is enough free space in this folder'),
    buttonLabel: i18n.t('Select output folder'),
  });
  return (filePaths && filePaths.length === 1) ? filePaths[0] : undefined;
}

export async function askForFfPath(defaultPath) {
  const { filePaths } = await dialog.showOpenDialog({
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
  return parseValue(value);
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
  const onChange = (key, val) => setChoices((c) => {
    const newChoices = { ...c, [key]: val };
    onChangeProp(newChoices);
    return newChoices;
  });

  return (
    <div style={{ textAlign: 'left' }}>
      <p>{i18n.t('Do you want to move the original file and/or any generated files to trash?')}</p>

      <Checkbox label={i18n.t('Trash auto-generated files')} checked={getVal('tmpFiles')} onChange={(e) => onChange('tmpFiles', e.target.checked)} />
      <Checkbox label={i18n.t('Trash project LLC file')} checked={getVal('projectFile')} onChange={(e) => onChange('projectFile', e.target.checked)} />
      <Checkbox label={i18n.t('Trash original source file')} checked={getVal('sourceFile')} onChange={(e) => onChange('sourceFile', e.target.checked)} />

      <div style={{ marginTop: 25 }}>
        <Checkbox label={i18n.t('Don\'t show dialog again until restarting app')} checked={getVal('dontShowAgain')} onChange={(e) => onChange('dontShowAgain', e.target.checked)} />
      </div>
    </div>
  );
};

export async function showCleanupFilesDialog(cleanupChoicesIn = {}) {
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

export async function showCutFailedDialog({ detectedFileFormat }) {
  const html = (
    <div style={{ textAlign: 'left' }}>
      <Trans>Try one of the following before exporting again:</Trans>
      <ol>
        {detectedFileFormat === 'mp4' && <li><Trans>Change output <b>Format</b> from <b>MP4</b> to <b>MOV</b></Trans></li>}
        <li><Trans>Select a different output <b>Format</b> (<b>matroska</b> and <b>mp4</b> support most codecs)</Trans></li>
        <li><Trans>Disable unnecessary <b>Tracks</b></Trans></li>
        <li><Trans>Try both <b>Normal cut</b> and <b>Keyframe cut</b></Trans></li>
        <li><Trans>Set a different <b>Working directory</b></Trans></li>
        <li><Trans>Try with a <b>Different file</b></Trans></li>
        <li><Trans>See <b>Help</b></Trans></li>
        <li><Trans>If nothing helps, you can send an <b>Error report</b></Trans></li>
      </ol>
    </div>
  );

  const { value } = await ReactSwal.fire({ title: i18n.t('Unable to export this file'), html, timer: null, showConfirmButton: true, showCancelButton: true, cancelButtonText: i18n.t('OK'), confirmButtonText: i18n.t('Report'), reverseButtons: true, focusCancel: true });
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

export function openAbout() {
  Swal.fire({
    icon: 'info',
    title: i18n.t('About LosslessCut'),
    text: i18n.t('You are running version {{version}}', { version: app.getVersion() }),
  });
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
