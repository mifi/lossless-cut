import type { Dispatch, SetStateAction, CSSProperties, ReactNode, ChangeEventHandler, DragEventHandler } from 'react';
import { memo, useState, useMemo, useCallback } from 'react';

import { FaImage, FaPaperclip, FaVideo, FaVideoSlash, FaFileImport, FaVolumeUp, FaVolumeMute, FaBan, FaFileExport, FaBook, FaInfoCircle, FaFilter, FaEye, FaEdit, FaTrash, FaSortNumericDown, FaSortNumericUp, FaHamburger, FaMap, FaLanguage, FaUndo } from 'react-icons/fa';
import { GoFileBinary } from 'react-icons/go';
import { MdSubtitles } from 'react-icons/md';
import { useTranslation, Trans } from 'react-i18next';
import prettyBytes from 'pretty-bytes';
import { Button as ThemesButton, Callout, Tabs, TextField } from '@radix-ui/themes';
import { produce } from 'immer';

import * as DropdownMenu from './components/DropdownMenu';
import * as Dialog from './components/Dialog';
import AutoExportToggler from './components/AutoExportToggler';
import Select from './components/Select';
import type { FileStream } from './ffmpeg';
import { getStreamFps } from './ffmpeg';
import { getActiveDisposition, attachedPicDisposition, isGpsStream, isMov, hasFileEdits, hasStreamEdits } from './util/streams';
import { fileMetadataKeys, getCodecTagSuggestions, getCopyableMetadata, getEffectiveMetadata, getLanguageSuggestions, getNonNativeMovMetadataKeys, isValidCodecTag, isValidCreationTime, isValidLanguageCode, needsHvc1Tag, streamMetadataKeys } from './util/metadata';
import useUserSettings from './hooks/useUserSettings';
import TagEditor, { cancelTagEditOnEscape, type TagInfo } from './components/TagEditor';
import SuggestionTextField from './components/SuggestionTextField';
import Warning from './components/Warning';
import type { FFprobeChapter, FFprobeFormat, FFprobeStream } from '../../common/ffprobe';
import { contentDispositionOptionsSchema, deleteDispositionValue, dispositionOptions, type ContentDispositionOptions, type FileParams, type FilesMeta, type FormatTimecode, type ParamsByFile, type StreamParams } from './types';
import Button, { DialogButton } from './components/Button';
import styles from './StreamsSelector.module.css';
import Json5Dialog from './components/Json5Dialog';
import GpsMap from './components/GpsMap';
import Switch from './components/Switch';
import type { ConfirmDialog } from './components/GenericDialog';
import { basename } from './util/path';


// for "Copy from": the source's metadata including the user's changes, without muxer-written keys
function getCopyFromSource({ key, getLabel, existing, custom }: { key: string, getLabel: (metadata: Record<string, string>) => string, existing: Record<string, string> | undefined, custom: Record<string, string> | undefined }) {
  const metadata = getCopyableMetadata(getEffectiveMetadata(existing, custom));
  return Object.keys(metadata).length > 0 ? { key, label: getLabel(metadata), metadata } : undefined;
}

type ResetParams = (path: string, streamId?: number) => void;

// highlighted when there are changes
function EditButton({ title, onClick, highlighted }: { title: string, onClick: () => void, highlighted: boolean }) {
  return <Button title={title} onClick={onClick}><FaEdit style={{ verticalAlign: 'middle', color: highlighted ? 'var(--accent-11)' : undefined }} /></Button>;
}

// Without streamId: resets the file's own params (not its tracks). Keeps disposition (see hasStreamEdits)
function resetParamsDraft(fileParams: FileParams, streamId?: number) {
  if (streamId == null) {
    // eslint-disable-next-line no-param-reassign
    fileParams.metadata = {};
    // eslint-disable-next-line no-param-reassign
    delete fileParams.offset;
    return;
  }
  const disposition = fileParams.paramsByStream.get(streamId)?.disposition;
  if (disposition != null) fileParams.paramsByStream.set(streamId, { metadata: {}, disposition });
  else fileParams.paramsByStream.delete(streamId);
}

type UpdateStreamParams = (fileId: string, streamId: number, setter: (a: StreamParams) => void) => void;

interface EditingStream {
  streamId: number;
  path: string;
}

const getStreamDispositionsObj = (stream: FFprobeStream) => ((stream && stream.disposition) || {});

const getStreamParams = ({ paramsByFile, filePath, streamId }: { paramsByFile: ParamsByFile, filePath: string, streamId: number }) => (
  paramsByFile.get(filePath)?.paramsByStream.get(streamId)
);

function getStreamEffectiveDisposition(paramsByFile: ParamsByFile, fileId: string, stream: FFprobeStream) {
  const customDisposition = getStreamParams({ paramsByFile, filePath: fileId, streamId: stream.index })?.disposition;
  const existingDispositionsObj = getStreamDispositionsObj(stream);

  if (customDisposition) return customDisposition;
  return getActiveDisposition(existingDispositionsObj);
}


// Tag info shared by file and track metadata
function useCommonTagInfo(): TagInfo {
  const { t } = useTranslation();
  return useMemo(() => ({
    creation_time: {
      // resolved by ffmpeg at export time
      suggestions: [{ value: 'now', label: t('Now') }],
      validate: (value) => (isValidCreationTime(value) ? undefined : t('Invalid date, use e.g. {{example}} or {{now}}', { example: '2024-12-31T23:59:59Z', now: 'now' })),
    },
    comment: { multiline: true },
    description: { multiline: true },
  }), [t]);
}

function ActionCallout({ color, style, text, actionText, onAction }: { color: 'amber' | 'blue', style?: CSSProperties, text: string, actionText: string, onAction: () => void }) {
  return (
    <Callout.Root size="1" color={color} style={style}>
      <Callout.Icon><FaInfoCircle /></Callout.Icon>
      <Callout.Text>
        {text}{' '}
        <ThemesButton size="1" variant="soft" onClick={onAction}>{actionText}</ThemesButton>
      </Callout.Text>
    </Callout.Root>
  );
}

// MP4/MOV only stores certain keys, unless "use_metadata_tags" is enabled
function MovMetadataNotice({ outFormat, metadata, isStream }: { outFormat: string | undefined, metadata: Record<string, string> | undefined, isStream: boolean }) {
  const { t } = useTranslation();
  const { preserveMovData, setPreserveMovData } = useUserSettings();
  const nonNativeKeys = getNonNativeMovMetadataKeys({ metadata, outFormat, isStream });
  if (!isMov(outFormat) || preserveMovData || nonNativeKeys.length === 0) return null;
  return (
    <ActionCallout
      color="amber"
      style={{ marginBottom: '1em' }}
      text={t('MP4/MOV may not keep these keys unless "{{option}}" is enabled: {{keys}}', { option: t('Preserve all MP4/MOV metadata?'), keys: nonNativeKeys.join(', ') })}
      actionText={t('Enable')}
      onAction={() => setPreserveMovData(true)}
    />
  );
}

function ResetButton({ disabled, onClick }: { disabled: boolean, onClick: () => void }) {
  const { t } = useTranslation();
  return <DialogButton disabled={disabled} onClick={onClick}><FaUndo style={{ verticalAlign: 'baseline', fontSize: '.8em', marginRight: '.3em' }} />{t('Reset')}</DialogButton>;
}

function KeyValue({ name, value }: { name: ReactNode, value: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '1em', marginBottom: '.3em', justifyContent: 'space-between' }}>
      <div>{name}</div>
      <div>{value}</div>
    </div>
  );
}

function AspectEditor({ stream, streamParams, updateStreamParams }: {
  stream: FFprobeStream,
  streamParams: StreamParams | undefined,
  updateStreamParams: (setter: (a: StreamParams) => void) => void,
}) {
  const { t } = useTranslation();

  const currentAr = streamParams?.aspectRatio ?? { num: 0, den: 0 };

  const updateAr = (field: 'num' | 'den', value: string) => {
    const parsed = parseInt(value, 10);
    const val = Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
    updateStreamParams((params) => {
      // eslint-disable-next-line no-param-reassign
      params.aspectRatio = { ...currentAr, [field]: val };
    });
  };

  const isSar = stream.codec_name === 'h264' || stream.codec_name === 'hevc';

  return (
    <>
      <div style={{ fontSize: '.85em', color: 'var(--gray-11)', marginBottom: '.4em' }}>
        {isSar ? t('Losslessly change the sample aspect ratio (SAR) of this track with a bitstream filter.') : t('Losslessly change the display aspect ratio of this track at the container level.')}
        {' '}
        {t('Note that this is not supported in all video players.')}
      </div>
      <KeyValue name={t('Width')} value={<TextField.Root type="number" min="0" style={{ width: '5em' }} placeholder="W" value={currentAr.num > 0 ? String(currentAr.num) : ''} onChange={(e) => updateAr('num', e.target.value)} />} />
      <KeyValue name={t('Height')} value={<TextField.Root type="number" min="0" style={{ width: '5em' }} placeholder="H" value={currentAr.den > 0 ? String(currentAr.den) : ''} onChange={(e) => updateAr('den', e.target.value)} />} />
    </>
  );
}

function CropEditor({ stream, streamParams, updateStreamParams }: {
  stream: FFprobeStream,
  streamParams: StreamParams | undefined,
  updateStreamParams: (setter: (a: StreamParams) => void) => void,
}) {
  const { t } = useTranslation();

  const currentCrop = streamParams?.crop ?? { left: 0, right: 0, top: 0, bottom: 0 };

  const updateCrop = (field: 'left' | 'right' | 'top' | 'bottom', value: string) => {
    const parsed = parseInt(value, 10);
    const val = Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
    updateStreamParams((params) => {
      // eslint-disable-next-line no-param-reassign
      params.crop = { ...currentCrop, [field]: val };
    });
  };

  if (!(stream.codec_name === 'h264' || stream.codec_name === 'hevc')) {
    return null;
  }

  return (
    <>
      <div style={{ fontSize: '.85em', color: 'var(--gray-11)', marginBottom: '.4em' }}>
        {t('Losslessly crop pixels from each edge.')}
        {' '}
        {t('Note that this is not supported in all video players.')}
      </div>
      <KeyValue name={t('Left')} value={<TextField.Root type="number" min="0" step="2" style={{ width: '5em' }} value={String(currentCrop.left)} onChange={(e) => updateCrop('left', e.target.value)} />} />
      <KeyValue name={t('Right')} value={<TextField.Root type="number" min="0" step="2" style={{ width: '5em' }} value={String(currentCrop.right)} onChange={(e) => updateCrop('right', e.target.value)} />} />
      <KeyValue name={t('Top')} value={<TextField.Root type="number" min="0" step="2" style={{ width: '5em' }} value={String(currentCrop.top)} onChange={(e) => updateCrop('top', e.target.value)} />} />
      <KeyValue name={t('Bottom')} value={<TextField.Root type="number" min="0" step="2" style={{ width: '5em' }} value={String(currentCrop.bottom)} onChange={(e) => updateCrop('bottom', e.target.value)} />} />
    </>
  );
}

function OffsetEditor({ fileParams, updateFileParams }: {
  fileParams: FileParams | undefined,
  updateFileParams: (setter: (a: FileParams) => void) => void,
}) {
  const { t } = useTranslation();
  const [valid, setValid] = useState(true);

  const handleChange = useCallback<ChangeEventHandler<HTMLInputElement>>((e) => {
    if (e.target.value.trim() === '') {
      updateFileParams((params) => {
        // eslint-disable-next-line no-param-reassign
        params.offset = undefined;
      });
      setValid(true);
      return;
    }

    const offset = Number(e.target.value);
    if (Number.isNaN(offset)) {
      setValid(false);
    } else {
      setValid(true);
      updateFileParams((params) => {
        // eslint-disable-next-line no-param-reassign
        params.offset = offset;
      });
    }
  }, [updateFileParams]);

  return (
    <>
      <div style={{ fontSize: '.85em', color: 'var(--gray-11)', marginBottom: '.4em' }}>
        {t('Shift the timestamps of all tracks in this file by a specified number of seconds, relative to other files. Positive values will delay the file\'s tracks, negative will advance it.')}
      </div>
      <KeyValue name={t('Shift by seconds')} value={<TextField.Root variant="soft" color={valid ? undefined : 'red'} type="text" style={{ width: '5em' }} placeholder="0.0" defaultValue={fileParams?.offset ?? ''} onChange={handleChange} />} />
    </>
  );
}

// eslint-disable-next-line react/display-name
const EditFileDialog = memo(({ editingFile, allFilesMeta, paramsByFile, setParamsByFile, editingKey, setEditingKey, enableMetadata, outFormat }: {
  editingFile: string,
  outFormat: string | undefined,
  allFilesMeta: FilesMeta,
  paramsByFile: ParamsByFile,
  setParamsByFile: Dispatch<SetStateAction<ParamsByFile>>,
  editingKey: string | undefined,
  setEditingKey: (key: string | undefined) => void,
  enableMetadata: boolean,
}) => {
  const { t } = useTranslation();

  const format = allFilesMeta[editingFile]?.format;
  const existingMetadata = useMemo(() => format?.tags ?? {}, [format?.tags]);
  const fileParams = paramsByFile.get(editingFile);

  const updateFileParams = useCallback((updater: (a: FileParams) => void) => {
    setParamsByFile(produce((draft) => {
      let params = draft.get(editingFile);
      if (params == null) {
        params = { metadata: {}, paramsByStream: new Map() };
        draft.set(editingFile, params);
      }
      updater(params);
    }));
  }, [editingFile, setParamsByFile]);

  const onMetadataChange = useCallback((keyValues: Record<string, string>) => {
    updateFileParams((params) => {
      // eslint-disable-next-line no-param-reassign
      params.metadata = { ...params.metadata, ...keyValues };
    });
  }, [updateFileParams]);

  const onMetadataReset = useCallback((key: string) => {
    updateFileParams((params) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [key]: deleted, ...rest } = params.metadata;
      // eslint-disable-next-line no-param-reassign
      params.metadata = rest;
    });
  }, [updateFileParams]);

  const copyFromSources = useMemo(() => Object.entries(allFilesMeta).flatMap(([path, { format: otherFormat }]) => (
    (path !== editingFile && getCopyFromSource({ key: path, getLabel: () => basename(path), existing: otherFormat.tags, custom: paramsByFile.get(path)?.metadata })) || []
  )), [allFilesMeta, editingFile, paramsByFile]);

  const commonTagInfo = useCommonTagInfo();
  const tagInfo = useMemo<TagInfo>(() => ({
    ...commonTagInfo,
    encoder: {
      description: t('This is hardcoded by FFmpeg and cannot be changed.'),
    },
  }), [commonTagInfo, t]);

  return (
    <Tabs.Root defaultValue={enableMetadata ? 'metadata' : 'offset'} style={{ minHeight: '20em' }}>
      <Tabs.List>
        {enableMetadata && <Tabs.Trigger value="metadata">{t('Metadata')}</Tabs.Trigger>}
        <Tabs.Trigger value="offset">{t('Offset')}</Tabs.Trigger>
      </Tabs.List>

      <div style={{ marginTop: '.5em' }}>
        {enableMetadata && (
          <Tabs.Content value="metadata">
            <MovMetadataNotice outFormat={outFormat} metadata={fileParams?.metadata} isStream={false} />
            <TagEditor existingTags={existingMetadata} customTags={fileParams?.metadata} editingTag={editingKey} setEditingTag={setEditingKey} onTagsChange={onMetadataChange} onTagReset={onMetadataReset} addTagTitle={t('Add metadata')} tagInfo={tagInfo} keySuggestions={fileMetadataKeys} copyFromSources={copyFromSources} canDeleteExisting />
          </Tabs.Content>
        )}

        <Tabs.Content value="offset">
          <OffsetEditor fileParams={fileParams} updateFileParams={updateFileParams} />
        </Tabs.Content>
      </div>
    </Tabs.Root>
  );
});

// eslint-disable-next-line react/display-name
const EditStreamDialog = memo(({ editingStream: { streamId: editingStreamId, path: editingFile }, setEditingStream, allFilesMeta, paramsByFile, updateStreamParams, outFormat, resetParams }: {
  editingStream: EditingStream,
  setEditingStream: Dispatch<SetStateAction<EditingStream | undefined>>,
  allFilesMeta: FilesMeta,
  paramsByFile: ParamsByFile,
  updateStreamParams: UpdateStreamParams,
  outFormat: string | undefined,
  resetParams: ResetParams,
}) => {
  const { t, i18n } = useTranslation();
  const [editingKey, setEditingKey] = useState<string>();

  const { streams } = allFilesMeta[editingFile]!;
  const editingStream = useMemo(() => streams.find((s) => s.index === editingStreamId), [streams, editingStreamId]);

  const existingMetadata = useMemo(() => editingStream?.tags ?? {}, [editingStream]);

  const streamParams = useMemo(() => getStreamParams({ paramsByFile, filePath: editingFile, streamId: editingStreamId }), [editingFile, editingStreamId, paramsByFile]);

  const setStreamMetadata = useCallback((streamId: number, keyValues: Record<string, string>) => {
    updateStreamParams(editingFile, streamId, (params) => {
      // eslint-disable-next-line no-param-reassign
      if (params.metadata == null) params.metadata = {};
      const { metadata } = params;
      Object.entries(keyValues).forEach(([tag, value]) => {
        metadata[tag] = tag === 'language' ? value.toLowerCase() : value;
      });
    });
  }, [editingFile, updateStreamParams]);

  const onMetadataChange = useCallback((keyValues: Record<string, string>) => setStreamMetadata(editingStreamId, keyValues), [editingStreamId, setStreamMetadata]);

  // cover art counts as its own type
  const otherStreamsOfSameType = useMemo(() => {
    if (editingStream == null) return [];
    const isCoverArt = (stream: FFprobeStream) => getStreamEffectiveDisposition(paramsByFile, editingFile, stream) === attachedPicDisposition;
    return streams.filter((s) => s.index !== editingStreamId && s.codec_type === editingStream.codec_type && isCoverArt(s) === isCoverArt(editingStream));
  }, [editingFile, editingStream, editingStreamId, paramsByFile, streams]);

  const onApplyToAll = useCallback((tag: string, value: string) => {
    otherStreamsOfSameType.forEach((s) => setStreamMetadata(s.index, { [tag]: value }));
  }, [otherStreamsOfSameType, setStreamMetadata]);

  const onMetadataReset = useCallback((key: string) => {
    updateStreamParams(editingFile, editingStreamId, (params) => {
      if (params.metadata == null) return;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [key]: deleted, ...rest } = params.metadata;
      // eslint-disable-next-line no-param-reassign
      params.metadata = rest;
    });
  }, [editingFile, editingStreamId, updateStreamParams]);

  const copyFromSources = useMemo(() => {
    const multipleFiles = Object.keys(allFilesMeta).length > 1;
    return Object.entries(allFilesMeta).flatMap(([path, { streams: fileStreams }]) => fileStreams.flatMap((s) => {
      // attachments only have metadata describing the attached file itself
      if ((path === editingFile && s.index === editingStreamId) || s.codec_type === 'attachment') return [];
      return getCopyFromSource({
        key: `${path}:${s.index}`,
        getLabel: ({ title }) => `${multipleFiles ? `${basename(path)}: ` : ''}#${s.index + 1} ${s.codec_type}${title ? ` – ${title}` : ''}`,
        existing: s.tags,
        custom: getStreamParams({ paramsByFile, filePath: path, streamId: s.index })?.metadata,
      }) ?? [];
    }));
  }, [allFilesMeta, editingFile, editingStreamId, paramsByFile]);

  const commonTagInfo = useCommonTagInfo();
  const tagInfo = useMemo<TagInfo>(() => ({
    ...commonTagInfo,
    language: {
      description: t('The language tag (ISO 639-2 code). For example "eng" for English. This is used by some players to select the appropriate audio/subtitle track based on the user\'s language preferences.'),
      url: 'https://en.wikipedia.org/wiki/List_of_ISO_639-2_codes',
      suggestions: getLanguageSuggestions(i18n.language),
      validate: (value) => (isValidLanguageCode(value.toLowerCase()) ? undefined : t('Language should be a 3-letter ISO 639-2 code')),
    },
  }), [commonTagInfo, i18n.language, t]);

  const codecTagSuggestions = useMemo(() => (isMov(outFormat) ? getCodecTagSuggestions(editingStream?.codec_name).map((value) => ({ value })) : []), [editingStream?.codec_name, outFormat]);
  const suggestHvc1 = editingStream != null && needsHvc1Tag({ stream: editingStream, outFormat, customTag: streamParams?.tag });

  const updateCurrentStreamParams = (setter: (a: StreamParams) => void) => updateStreamParams(editingFile, editingStreamId, setter);

  return (
    <Dialog.Root open={editingStream != null} onOpenChange={(v) => v === false && setEditingStream(undefined)}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content style={{ width: '40em' }} aria-describedby={undefined} onEscapeKeyDown={cancelTagEditOnEscape(editingKey, setEditingKey)}>
          <Dialog.Title>{t('Edit track {{trackNum}} metadata', { trackNum: editingStream && (editingStream.index + 1) })}</Dialog.Title>

          <Tabs.Root defaultValue="metadata" style={{ minHeight: '20em' }}>
            <Tabs.List>
              <Tabs.Trigger value="metadata">{t('Metadata')}</Tabs.Trigger>
              {editingStream?.codec_type === 'video' && (
                <>
                  <Tabs.Trigger value="crop">{t('Crop')}</Tabs.Trigger>
                  <Tabs.Trigger value="aspectratio">{t('Aspect ratio')}</Tabs.Trigger>
                </>
              )}
              <Tabs.Trigger value="parameters">{t('Parameters')}</Tabs.Trigger>
            </Tabs.List>

            <div style={{ marginTop: '.5em' }}>
              <Tabs.Content value="metadata">
                <MovMetadataNotice outFormat={outFormat} metadata={streamParams?.metadata} isStream />
                <TagEditor existingTags={existingMetadata} customTags={streamParams?.metadata} editingTag={editingKey} setEditingTag={setEditingKey} onTagsChange={onMetadataChange} onTagReset={onMetadataReset} addTagTitle={t('Add metadata')} tagInfo={tagInfo} keySuggestions={streamMetadataKeys} canDeleteExisting onApplyToAll={otherStreamsOfSameType.length > 0 ? onApplyToAll : undefined} applyToAllTitle={t('Apply to all other tracks of this type')} copyFromSources={copyFromSources} />
              </Tabs.Content>

              {editingStream != null && (
                <>
                  <Tabs.Content value="crop">
                    <CropEditor stream={editingStream} streamParams={streamParams} updateStreamParams={updateCurrentStreamParams} />
                  </Tabs.Content>

                  <Tabs.Content value="aspectratio">
                    <AspectEditor stream={editingStream} streamParams={streamParams} updateStreamParams={updateCurrentStreamParams} />
                  </Tabs.Content>

                  <Tabs.Content value="parameters">
                    {/* https://github.com/mifi/lossless-cut/issues/1680#issuecomment-1682915193 */}
                    {editingStream.codec_name === 'h264' && (
                      <KeyValue
                        name={t('Enable "{{filterName}}" bitstream filter.', { filterName: 'h264_mp4toannexb' })}
                        // eslint-disable-next-line no-param-reassign
                        value={<Switch checked={!!streamParams?.bsfH264Mp4toannexb} onCheckedChange={(checked) => updateCurrentStreamParams((params) => { params.bsfH264Mp4toannexb = checked === true; })} />}
                      />
                    )}

                    {editingStream.codec_name === 'hevc' && (
                      <>
                        <KeyValue
                          name={t('Enable "{{filterName}}" bitstream filter.', { filterName: 'hevc_mp4toannexb' })}
                          // eslint-disable-next-line no-param-reassign
                          value={<Switch checked={!!streamParams?.bsfHevcMp4toannexb} onCheckedChange={(checked) => updateCurrentStreamParams((params) => { params.bsfHevcMp4toannexb = checked === true; })} />}
                        />

                        <KeyValue
                          name={t('Enable "{{filterName}}" bitstream filter.', { filterName: 'hevc_metadata=aud=insert' })}
                          // eslint-disable-next-line no-param-reassign
                          value={<Switch checked={!!streamParams?.bsfHevcAudInsert} onCheckedChange={(checked) => updateCurrentStreamParams((params) => { params.bsfHevcAudInsert = checked === true; })} />}
                        />
                      </>
                    )}

                    {(editingStream.codec_type === 'video' || editingStream.codec_type === 'audio') && (
                      <>
                        <KeyValue
                          name={t('Codec tag')}
                          // eslint-disable-next-line no-param-reassign
                          value={<SuggestionTextField placeholder={editingStream?.codec_tag_string ?? t('Default')} value={streamParams?.tag ?? ''} suggestions={codecTagSuggestions} onValueChange={(value) => updateCurrentStreamParams((params) => { params.tag = value.trim() === '' ? undefined : value; })} />}
                        />

                        {streamParams?.tag != null && !isValidCodecTag(streamParams.tag) && <Warning>{t('Codec tag should be 4 characters')}</Warning>}

                        {suggestHvc1 && (
                          <ActionCallout
                            color="blue"
                            style={{ marginTop: '.5em' }}
                            text={t('Apple devices (QuickTime, Safari, iOS) require the "{{tag}}" codec tag to play HEVC in MP4/MOV.', { tag: 'hvc1' })}
                            actionText={t('Use "{{tag}}"', { tag: 'hvc1' })}
                            // eslint-disable-next-line no-param-reassign
                            onAction={() => updateCurrentStreamParams((params) => { params.tag = 'hvc1'; })}
                          />
                        )}
                      </>
                    )}
                  </Tabs.Content>
                </>
              )}
            </div>
          </Tabs.Root>

          <Dialog.ButtonRow>
            <ResetButton disabled={editingKey != null || !hasStreamEdits(streamParams)} onClick={() => resetParams(editingFile, editingStreamId)} />
            <Dialog.Close asChild>
              <DialogButton disabled={editingKey != null} primary>{t('Done')}</DialogButton>
            </Dialog.Close>
          </Dialog.ButtonRow>

          <Dialog.CloseButton />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
});

const unchangedDispositionValue = 'llc_disposition_unchanged';

// eslint-disable-next-line react/display-name
const Stream = memo(({ filePath, stream, onToggle, toggleCopyStreamIds, copyStream, fileDuration, setEditingStream, onExtractStreamPress, paramsByFile, updateStreamParams, formatTimecode, loadSubtitleTrackToSegments }: {
  filePath: string,
  stream: FileStream,
  onToggle: (a: number) => void,
  toggleCopyStreamIds: (filter: (a: FFprobeStream) => boolean) => void,
  copyStream: boolean, fileDuration: number | undefined,
  setEditingStream: (a: EditingStream) => void,
  onExtractStreamPress?: () => void,
  paramsByFile: ParamsByFile,
  updateStreamParams: UpdateStreamParams,
  formatTimecode: FormatTimecode,
  loadSubtitleTrackToSegments?: (index: number) => void,
}) => {
  const { t } = useTranslation();

  const effectiveDisposition = useMemo(() => getStreamEffectiveDisposition(paramsByFile, filePath, stream), [filePath, paramsByFile, stream]);
  const streamParams = getStreamParams({ paramsByFile, filePath, streamId: stream.index });
  const effectiveLanguage = streamParams?.metadata['language'] ?? stream.tags?.language;

  const bitrate = parseInt(stream.bit_rate!, 10);
  const streamDuration = parseInt(stream.duration, 10);
  const duration = !Number.isNaN(streamDuration) ? streamDuration : fileDuration;

  let Icon: typeof FaBan;
  let codecTypeHuman;
  // eslint-disable-next-line unicorn-js/prefer-switch
  if (stream.codec_type === 'audio') {
    Icon = copyStream ? FaVolumeUp : FaVolumeMute;
    codecTypeHuman = t('audio');
  } else if (stream.codec_type === 'video') {
    if (effectiveDisposition === attachedPicDisposition) {
      Icon = copyStream ? FaImage : FaBan;
      codecTypeHuman = t('thumbnail');
    } else {
      Icon = copyStream ? FaVideo : FaVideoSlash;
      codecTypeHuman = t('video');
    }
  } else if (stream.codec_type === 'subtitle') {
    Icon = copyStream ? MdSubtitles : FaBan;
    codecTypeHuman = t('subtitle');
  } else if (stream.codec_type === 'attachment') {
    Icon = copyStream ? FaPaperclip : FaBan;
    codecTypeHuman = t('attachment');
  } else {
    Icon = copyStream ? GoFileBinary : FaBan;
    codecTypeHuman = stream.codec_type;
  }

  const streamFps = stream.codec_type === 'audio' ? undefined : getStreamFps(stream);
  const sampleRate = Number(stream.sample_rate);
  const title = stream.tags?.title;

  const onClick = () => onToggle && onToggle(stream.index);

  const onDispositionChange = useCallback<ChangeEventHandler<HTMLSelectElement>>((e) => {
    let newDisposition: ContentDispositionOptions | 'llc_disposition_remove' | undefined;
    const dispositionParsed = contentDispositionOptionsSchema.safeParse(e.target.value);
    if (dispositionParsed.success) {
      newDisposition = dispositionParsed.data;
    } else if (e.target.value === deleteDispositionValue) {
      newDisposition = deleteDispositionValue; // needs a separate value (not a real disposition)
    } // else unchanged (undefined)

    updateStreamParams(filePath, stream.index, (params) => {
      // eslint-disable-next-line no-param-reassign
      params.disposition = newDisposition;
    });
  }, [filePath, updateStreamParams, stream.index]);

  const onLoadSubtitleTrackToSegmentsClick = useCallback(() => {
    loadSubtitleTrackToSegments?.(stream.index);
  }, [loadSubtitleTrackToSegments, stream.index]);

  const codecTag = stream.codec_tag !== '0x0000' && stream.codec_tag_string;

  return (
    <tr style={{ opacity: copyStream ? undefined : 0.4 }}>
      <td style={{ whiteSpace: 'nowrap' }}>
        <Button style={{ marginRight: '.5em', color: copyStream ? '#52BD95' : '#D14343' }} title={`${t('Click to toggle track inclusion when exporting')} (type ${codecTypeHuman})`} onClick={onClick}>
          <Icon style={{ verticalAlign: 'middle', fontSize: '1.5em', padding: '.1em' }} />
        </Button>
        <span style={{ verticalAlign: 'middle', width: '.15em', textAlign: 'center' }}>{stream.index + 1}</span>
      </td>
      <td style={{ maxWidth: '3em', overflow: 'hidden' }} title={stream.codec_name}>{stream.codec_name} {codecTag}</td>
      <td>
        {duration != null && !Number.isNaN(duration) && formatTimecode({ seconds: duration, shorten: true })}
        {stream.nb_frames != null ? <span> {stream.nb_frames}f</span> : null}
      </td>
      <td>{!Number.isNaN(bitrate) && (stream.codec_type === 'audio' ? `${Math.round(bitrate / 1000)} kbps` : prettyBytes(bitrate, { bits: true }))}</td>
      <td style={{ maxWidth: '2.5em', wordBreak: 'break-word' }} title={title}>{title}</td>
      <td style={{ maxWidth: '2.5em', overflow: 'hidden' }} title={effectiveLanguage}>{effectiveLanguage}</td>
      <td>{stream.width && stream.height && `${stream.width}x${stream.height}`} {stream.channels && `${stream.channels}c`} {stream.channel_layout} {sampleRate > 0 && `${sampleRate / 1000}kHz`} {streamFps && `${streamFps.toFixed(2)}fps`}</td>
      <td>
        <Select style={{ width: '6em' }} value={effectiveDisposition || unchangedDispositionValue} onChange={onDispositionChange}>
          <option value="" disabled>{t('Disposition')}</option>
          <option value={unchangedDispositionValue}>{t('Unchanged')}</option>
          <option value={deleteDispositionValue}>{t('Remove')}</option>

          {dispositionOptions.map((key) => (
            <option key={key} value={key}>{key}</option>
          ))}
        </Select>
      </td>

      <td style={{ textAlign: 'right', fontSize: '1.1em', whiteSpace: 'nowrap' }}>
        {hasStreamEdits(streamParams) && <EditButton title={t('This track has been edited')} onClick={() => setEditingStream({ streamId: stream.index, path: filePath })} highlighted />}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button><FaHamburger style={{ verticalAlign: 'middle', padding: '.4em' }} /></Button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content sideOffset={5}>
              <Json5Dialog title={t('Track {{num}} info', { num: stream.index + 1 })} json={stream}>
                <DropdownMenu.Item onSelect={(e) => e.preventDefault()}>
                  <FaInfoCircle style={{ verticalAlign: 'middle', marginRight: '.3em' }} />
                  {t('Track {{num}} info', { num: stream.index + 1 })}
                </DropdownMenu.Item>
              </Json5Dialog>

              <DropdownMenu.Item onClick={() => setEditingStream({ streamId: stream.index, path: filePath })}>
                <FaEdit style={{ marginRight: '.3em' }} />
                {t('Edit track metadata')}
              </DropdownMenu.Item>

              <DropdownMenu.Separator />

              {onExtractStreamPress && (
                <DropdownMenu.Item onClick={onExtractStreamPress}>
                  <FaFileExport style={{ marginRight: '.3em' }} />
                  {t('Extract this track as file')}
                </DropdownMenu.Item>
              )}

              {stream.codec_type === 'subtitle' && (
                <DropdownMenu.Item onClick={onLoadSubtitleTrackToSegmentsClick}>
                  <MdSubtitles style={{ marginRight: '.3em' }} />
                  {t('Create segments from subtitles')}
                </DropdownMenu.Item>
              )}

              {isGpsStream(stream) && (
                <Dialog.Root>
                  <Dialog.Trigger asChild>
                    {/* https://github.com/radix-ui/primitives/issues/1836#issuecomment-1674338372 */}
                    <DropdownMenu.Item onSelect={(e) => e.preventDefault()}>
                      <FaMap style={{ marginRight: '.3em' }} />
                      {t('Show GPS map')}
                    </DropdownMenu.Item>
                  </Dialog.Trigger>

                  <Dialog.Portal>
                    <Dialog.Overlay />

                    <Dialog.Content aria-describedby={undefined}>
                      <Dialog.Title>
                        <Trans>GPS track</Trans>
                      </Dialog.Title>

                      <GpsMap filePath={filePath} streamIndex={stream.index} />
                    </Dialog.Content>
                  </Dialog.Portal>
                </Dialog.Root>
              )}

              <DropdownMenu.Separator />

              <DropdownMenu.Item onClick={() => toggleCopyStreamIds((s) => s.codec_type === stream.codec_type)}>
                <FaEye style={{ marginRight: '.3em' }} />
                {t('Toggle {{type}} tracks', { type: codecTypeHuman })}
              </DropdownMenu.Item>

              <DropdownMenu.Arrow />
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </td>
    </tr>
  );
});

function FileHeading({ path, format, onEditClick, edited, toggleCopyAllStreams, chapters, onTrashClick, onExtractAllStreamsPress, changeEnabledStreamsFilter }: {
  path: string,
  edited: boolean,
  format: FFprobeFormat | undefined,
  onEditClick?: (() => void) | undefined,
  toggleCopyAllStreams: () => void,
  chapters?: FFprobeChapter[] | undefined,
  onTrashClick?: (() => void) | undefined,
  onExtractAllStreamsPress?: () => Promise<void>,
  changeEnabledStreamsFilter?: (() => void) | undefined,
}) {
  const { t } = useTranslation();

  return (
    <div style={{ display: 'flex', marginBottom: '.2em', borderBottom: '1px solid var(--gray-7)' }}>
      <div title={path} style={{ wordBreak: 'break-all', marginRight: '1em', fontWeight: 'bold' }}>{basename(path)}</div>

      <div style={{ flexGrow: 1 }} />

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '.2em', fontSize: '1.3em', marginBottom: '.2em' }}>
        {chapters && chapters.length > 0 && (
          <Json5Dialog title={t('Chapters')} json={chapters}>
            <Button title={t('Chapters')}><FaBook style={{ verticalAlign: 'middle' }} /></Button>
          </Json5Dialog>
        )}
        <Json5Dialog title={t('File info')} json={format}>
          <Button title={t('File info')}><FaInfoCircle style={{ verticalAlign: 'middle' }} /></Button>
        </Json5Dialog>
        {onEditClick && <EditButton title={t('Edit file metadata')} onClick={onEditClick} highlighted={edited} />}
        <Button title={t('Toggle all tracks')} onClick={() => toggleCopyAllStreams()}><FaEye style={{ verticalAlign: 'middle' }} /></Button>
        {changeEnabledStreamsFilter && <Button title={t('Filter tracks')} onClick={changeEnabledStreamsFilter}><FaFilter style={{ verticalAlign: 'middle' }} /></Button>}
        {onExtractAllStreamsPress && <Button title={t('Export each track as individual files')} onClick={onExtractAllStreamsPress}><FaFileExport style={{ verticalAlign: 'middle' }} /></Button>}

        {onTrashClick && <Button onClick={onTrashClick}><FaTrash style={{ verticalAlign: 'middle' }} /></Button>}
      </div>
    </div>
  );
}

function Thead() {
  const { t } = useTranslation();
  return (
    <thead style={{ color: 'var(--gray-12)', textAlign: 'left', fontSize: '.9em' }}>
      <tr>
        <th>{t('Keep?')}</th>
        <th>{t('Codec')}</th>
        <th>{t('Duration')}</th>
        <th>{t('Bitrate')}</th>
        <th>{t('Title')}</th>
        <th title={t('Language')}><FaLanguage style={{ fontSize: '1.9em', verticalAlign: 'top' }} /></th>
        <th>{t('Data')}</th>
        <th>{t('Disposition')}</th>
        <th />
      </tr>
    </thead>
  );
}

const fileStyle: CSSProperties = { marginBottom: '2em', padding: '.5em 0', overflowX: 'auto' };


function StreamsSelector({
  mainFilePath, mainFileFormat, mainFileStreams, mainFileChapters, isCopyingStreamId, toggleCopyStreamId, setCopyStreamIdsForPath, onExtractStreamPress, onExtractAllStreamsPress, allFilesMeta, externalFilesMeta, setExternalFilesMeta, showAddStreamSourceDialog, shortestFlag, setShortestFlag, nonCopiedExtraStreams, paramsByFile, setParamsByFile, updateStreamParams, formatTimecode, loadSubtitleTrackToSegments, toggleCopyStreamIds, changeEnabledStreamsFilter, toggleCopyAllStreamsForPath, onStreamSourceFileDrop, outFormat, confirmDialog,
}: {
  mainFilePath: string,
  mainFileFormat: FFprobeFormat | undefined,
  mainFileStreams: FileStream[],
  mainFileChapters: FFprobeChapter[] | undefined,
  isCopyingStreamId: (path: string | undefined, streamId: number) => boolean,
  toggleCopyStreamId: (path: string, index: number) => void,
  setCopyStreamIdsForPath: (path: string, cb: (a: Record<string, boolean>) => Record<string, boolean>) => void,
  onExtractStreamPress: (index: number) => void,
  onExtractAllStreamsPress: () => Promise<void>,
  allFilesMeta: FilesMeta,
  externalFilesMeta: FilesMeta,
  setExternalFilesMeta: Dispatch<SetStateAction<FilesMeta>>,
  showAddStreamSourceDialog: () => Promise<void>,
  shortestFlag: boolean,
  setShortestFlag: Dispatch<SetStateAction<boolean>>,
  nonCopiedExtraStreams: FFprobeStream[],
  paramsByFile: ParamsByFile,
  setParamsByFile: Dispatch<SetStateAction<ParamsByFile>>,
  updateStreamParams: UpdateStreamParams,
  formatTimecode: FormatTimecode,
  loadSubtitleTrackToSegments: (index: number) => void,
  toggleCopyStreamIds: (path: string, filter: (a: FFprobeStream) => boolean) => void,
  changeEnabledStreamsFilter: () => void,
  toggleCopyAllStreamsForPath: (path: string) => void,
  onStreamSourceFileDrop: DragEventHandler<HTMLDivElement>,
  outFormat: string | undefined,
  confirmDialog: ConfirmDialog,
}) {
  const [editingFile, setEditingFile] = useState<string>();
  const [editingStream, setEditingStream] = useState<EditingStream>();
  const [editingKey, setEditingKey] = useState<string>();
  const { t } = useTranslation();

  function getFormatDuration(format: FFprobeFormat | undefined) {
    if (!format || !format.duration) return undefined;
    const parsed = parseFloat(format.duration);
    if (Number.isNaN(parsed)) return undefined;
    return parsed;
  }

  function removeFile(path: string) {
    setCopyStreamIdsForPath(path, () => ({}));
    setExternalFilesMeta((old) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [path]: val, ...rest } = old;
      return rest;
    });
  }

  const externalFilesEntries = Object.entries(externalFilesMeta);

  const resetParams = useCallback<ResetParams>((path, streamId) => setParamsByFile(produce((draft) => {
    const fileParams = draft.get(path);
    if (fileParams != null) resetParamsDraft(fileParams, streamId);
  })), [setParamsByFile]);

  const haveEdits = useMemo(() => [...paramsByFile.values()].some((fileParams) => hasFileEdits(fileParams) || [...fileParams.paramsByStream.values()].some((streamParams) => hasStreamEdits(streamParams))), [paramsByFile]);

  const onResetAllClick = useCallback(async () => {
    if (!(await confirmDialog({ description: t('Reset all changes to files and tracks?') }))) return;
    setParamsByFile(produce((draft) => {
      for (const fileParams of draft.values()) {
        resetParamsDraft(fileParams);
        for (const streamId of fileParams.paramsByStream.keys()) resetParamsDraft(fileParams, streamId);
      }
    }));
  }, [confirmDialog, setParamsByFile, t]);

  return (
    <>
      <div style={fileStyle} onDrop={onStreamSourceFileDrop}>
        {/* We only support editing main file metadata for now */}
        <FileHeading path={mainFilePath} format={mainFileFormat} edited={hasFileEdits(paramsByFile.get(mainFilePath))} chapters={mainFileChapters} onEditClick={() => setEditingFile(mainFilePath)} toggleCopyAllStreams={() => toggleCopyAllStreamsForPath(mainFilePath)} onExtractAllStreamsPress={onExtractAllStreamsPress} changeEnabledStreamsFilter={changeEnabledStreamsFilter} />
        <table className={styles['table']}>
          <Thead />

          <tbody>
            {mainFileStreams.map((stream) => (
              <Stream
                key={stream.index}
                filePath={mainFilePath}
                stream={stream}
                copyStream={isCopyingStreamId(mainFilePath, stream.index)}
                onToggle={(streamId) => toggleCopyStreamId(mainFilePath, streamId)}
                toggleCopyStreamIds={(filter: (a: FFprobeStream) => boolean) => toggleCopyStreamIds(mainFilePath, filter)}
                setEditingStream={setEditingStream}
                fileDuration={getFormatDuration(mainFileFormat)}
                onExtractStreamPress={() => onExtractStreamPress(stream.index)}
                paramsByFile={paramsByFile}
                updateStreamParams={updateStreamParams}
                formatTimecode={formatTimecode}
                loadSubtitleTrackToSegments={loadSubtitleTrackToSegments}
              />
            ))}
          </tbody>
        </table>
      </div>

      {externalFilesEntries.map(([path, { streams: externalFileStreams, format }]) => (
        <div key={path} style={fileStyle}>
          <FileHeading path={path} format={format} edited={hasFileEdits(paramsByFile.get(path))} onEditClick={() => setEditingFile(path)} toggleCopyAllStreams={() => toggleCopyAllStreamsForPath(path)} onTrashClick={() => removeFile(path)} />

          <table className={styles['table']}>
            <Thead />
            <tbody>
              {externalFileStreams.map((stream) => (
                <Stream
                  key={stream.index}
                  filePath={path}
                  stream={stream}
                  copyStream={isCopyingStreamId(path, stream.index)}
                  onToggle={(streamId) => toggleCopyStreamId(path, streamId)}
                  toggleCopyStreamIds={(filter: (a: FFprobeStream) => boolean) => toggleCopyStreamIds(path, filter)}
                  setEditingStream={setEditingStream}
                  fileDuration={getFormatDuration(format)}
                  paramsByFile={paramsByFile}
                  updateStreamParams={updateStreamParams}
                  formatTimecode={formatTimecode}
                />
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <div style={{ margin: '1em 0' }}>
        <Button style={{ marginBottom: '1em', padding: '0.3em 1em' }} onClick={showAddStreamSourceDialog}>
          <FaFileImport style={{ verticalAlign: 'middle', marginRight: '.5em' }} /> {t('Include more tracks from other file')}
        </Button>

        {haveEdits && (
          <Button style={{ marginBottom: '1em', marginLeft: '.5em', padding: '0.3em 1em' }} onClick={onResetAllClick}>
            <FaUndo style={{ verticalAlign: 'middle', marginRight: '.5em' }} /> {t('Reset all changes')}
          </Button>
        )}

        {nonCopiedExtraStreams.length > 0 && (
          <div style={{ marginBottom: '1em' }}>
            <span style={{ marginRight: 10 }}>{t('Discard or extract unprocessable tracks to separate files?')}</span>
            <AutoExportToggler />
          </div>
        )}

        {externalFilesEntries.length > 0 && (
          <div style={{ marginBottom: '1em' }}>
            <div style={{ marginBottom: '.5em' }}>{t('When tracks have different lengths, do you want to make the output file as long as the longest or the shortest track?')}</div>
            <Button style={{ padding: '0.3em 1em' }} onClick={() => setShortestFlag((value) => !value)}>
              {shortestFlag ? <><FaSortNumericDown style={{ verticalAlign: 'middle', marginRight: '.5em' }} />{t('Shortest')}</> : <><FaSortNumericUp style={{ verticalAlign: 'middle', marginRight: '.5em' }} />{t('Longest')}</>}
            </Button>
          </div>
        )}
      </div>

      {editingFile != null && (
        <Dialog.Root defaultOpen onOpenChange={(v) => v === false && setEditingFile(undefined)}>
          <Dialog.Portal>
            <Dialog.Overlay />
            <Dialog.Content style={{ width: '40em' }} aria-describedby={undefined} onEscapeKeyDown={cancelTagEditOnEscape(editingKey, setEditingKey)}>
              <Dialog.Title>{t('Edit file metadata')}</Dialog.Title>

              <EditFileDialog editingFile={editingFile} editingKey={editingKey} setEditingKey={setEditingKey} allFilesMeta={allFilesMeta} paramsByFile={paramsByFile} setParamsByFile={setParamsByFile} enableMetadata={editingFile === mainFilePath} outFormat={outFormat} />

              <Dialog.ButtonRow>
                <ResetButton disabled={editingKey != null || !hasFileEdits(paramsByFile.get(editingFile))} onClick={() => resetParams(editingFile)} />
                <Dialog.Close asChild>
                  <DialogButton primary disabled={editingKey != null}>{t('Done')}</DialogButton>
                </Dialog.Close>
              </Dialog.ButtonRow>

              <Dialog.CloseButton />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      {editingStream != null && (
        <EditStreamDialog
          editingStream={editingStream}
          setEditingStream={setEditingStream}
          allFilesMeta={allFilesMeta}
          paramsByFile={paramsByFile}
          updateStreamParams={updateStreamParams}
          outFormat={outFormat}
          resetParams={resetParams}
        />
      )}
    </>
  );
}

export default memo(StreamsSelector);
