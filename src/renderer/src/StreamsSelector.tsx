import { memo, useState, useMemo, useCallback, Dispatch, SetStateAction, CSSProperties, ReactNode, ChangeEventHandler, DragEventHandler } from 'react';

import { FaImage, FaPaperclip, FaVideo, FaVideoSlash, FaFileImport, FaVolumeUp, FaVolumeMute, FaBan, FaFileExport, FaBook, FaInfoCircle, FaFilter, FaEye, FaEdit, FaTrash, FaSortNumericDown, FaSortNumericUp, FaHamburger, FaMap } from 'react-icons/fa';
import { GoFileBinary } from 'react-icons/go';
import { MdSubtitles } from 'react-icons/md';
import { useTranslation, Trans } from 'react-i18next';
import prettyBytes from 'pretty-bytes';

import * as DropdownMenu from './components/DropdownMenu';
import * as Dialog from './components/Dialog';
import AutoExportToggler from './components/AutoExportToggler';
import Select from './components/Select';
import { FileStream, getStreamFps } from './ffmpeg';
import { deleteDispositionValue } from './util';
import { getActiveDisposition, attachedPicDisposition, isGpsStream } from './util/streams';
import TagEditor from './components/TagEditor';
import { FFprobeChapter, FFprobeFormat, FFprobeStream } from '../../common/ffprobe';
import { CustomTagsByFile, FilesMeta, FormatTimecode, ParamsByStreamId, StreamParams } from './types';
import Button, { DialogButton } from './components/Button';
import Checkbox from './components/Checkbox';
import styles from './StreamsSelector.module.css';
import Json5Dialog from './components/Json5Dialog';
import GpsMap from './components/GpsMap';


const dispositionOptions = ['default', 'dub', 'original', 'comment', 'lyrics', 'karaoke', 'forced', 'hearing_impaired', 'visual_impaired', 'clean_effects', 'attached_pic', 'captions', 'descriptions', 'dependent', 'metadata'];
const unchangedDispositionValue = 'llc_disposition_unchanged';

type UpdateStreamParams = (fileId: string, streamId: number, setter: (a: StreamParams) => void) => void;

interface EditingStream {
  streamId: number;
  path: string;
}

// eslint-disable-next-line react/display-name
const EditFileDialog = memo(({ editingFile, allFilesMeta, customTagsByFile, setCustomTagsByFile, editingTag, setEditingTag }: {
  editingFile: string,
  allFilesMeta: FilesMeta,
  customTagsByFile: CustomTagsByFile,
  setCustomTagsByFile: Dispatch<SetStateAction<CustomTagsByFile>>,
  editingTag: string | undefined,
  setEditingTag: (tag: string | undefined) => void,
}) => {
  const { t } = useTranslation();

  const { formatData } = allFilesMeta[editingFile]!;
  const existingTags = formatData.tags || {};
  const customTags = customTagsByFile[editingFile] || {};

  const onTagsChange = useCallback((keyValues: Record<string, string>) => {
    setCustomTagsByFile((old) => ({ ...old, [editingFile]: { ...old[editingFile], ...keyValues } }));
  }, [editingFile, setCustomTagsByFile]);

  const onTagReset = useCallback((tag: string) => {
    setCustomTagsByFile((old) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [tag]: deleted, ...rest } = old[editingFile] || {};
      return { ...old, [editingFile]: rest };
    });
  }, [editingFile, setCustomTagsByFile]);

  return <TagEditor existingTags={existingTags} customTags={customTags} editingTag={editingTag} setEditingTag={setEditingTag} onTagsChange={onTagsChange} onTagReset={onTagReset} addTagTitle={t('Add metadata')} />;
});

const getStreamDispositionsObj = (stream: FFprobeStream) => ((stream && stream.disposition) || {});

function getStreamEffectiveDisposition(paramsByStreamId: ParamsByStreamId, fileId: string, stream: FFprobeStream) {
  const customDisposition = paramsByStreamId.get(fileId)?.get(stream.index)?.disposition;
  const existingDispositionsObj = getStreamDispositionsObj(stream);

  if (customDisposition) return customDisposition;
  return getActiveDisposition(existingDispositionsObj);
}


function StreamParametersEditor({ stream, streamParams, updateStreamParams }: {
  stream: FFprobeStream, streamParams: StreamParams, updateStreamParams: (setter: (a: StreamParams) => void) => void,
}) {
  const { t } = useTranslation();

  const ui: ReactNode[] = [];
  // https://github.com/mifi/lossless-cut/issues/1680#issuecomment-1682915193
  if (stream.codec_name === 'h264') {
    ui.push(
      // eslint-disable-next-line no-param-reassign
      <Checkbox key="bsfH264Mp4toannexb" checked={!!streamParams.bsfH264Mp4toannexb} label={t('Enable "{{filterName}}" bitstream filter.', { filterName: 'h264_mp4toannexb' })} onCheckedChange={(checked) => updateStreamParams((params) => { params.bsfH264Mp4toannexb = checked === true; })} />,
    );
  }
  if (stream.codec_name === 'hevc') {
    ui.push(
      // eslint-disable-next-line no-param-reassign
      <Checkbox key="bsfHevcMp4toannexb" checked={!!streamParams.bsfHevcMp4toannexb} label={t('Enable "{{filterName}}" bitstream filter.', { filterName: 'hevc_mp4toannexb' })} onCheckedChange={(checked) => updateStreamParams((params) => { params.bsfHevcMp4toannexb = checked === true; })} />,
    );
  }

  return (
    <div style={{ marginBottom: '1em' }}>
      {ui.length > 0
        ? ui
        : t('No editable parameters for this stream.')}
    </div>
  );
}

// eslint-disable-next-line react/display-name
const EditStreamDialog = memo(({ editingStream: { streamId: editingStreamId, path: editingFile }, setEditingStream, allFilesMeta, paramsByStreamId, updateStreamParams }: {
  editingStream: EditingStream,
  setEditingStream: Dispatch<SetStateAction<EditingStream | undefined>>,
  allFilesMeta: FilesMeta,
  paramsByStreamId: ParamsByStreamId,
  updateStreamParams: UpdateStreamParams,
}) => {
  const { t } = useTranslation();
  const [editingTag, setEditingTag] = useState<string>();

  const { streams } = allFilesMeta[editingFile]!;
  const editingStream = useMemo(() => streams.find((s) => s.index === editingStreamId), [streams, editingStreamId]);

  const existingTags = useMemo(() => (editingStream && editingStream.tags) || {}, [editingStream]);

  const streamParams = useMemo(() => paramsByStreamId.get(editingFile)?.get(editingStreamId) ?? {}, [editingFile, editingStreamId, paramsByStreamId]);
  const customTags = useMemo(() => streamParams.customTags, [streamParams]);

  const onTagsChange = useCallback((keyValues: Record<string, string>) => {
    updateStreamParams(editingFile, editingStreamId, (params) => {
      // eslint-disable-next-line no-param-reassign
      if (params.customTags == null) params.customTags = {};
      const tags = params.customTags;
      Object.entries(keyValues).forEach(([tag, value]) => {
        tags[tag] = value;
      });
    });
  }, [editingFile, editingStreamId, updateStreamParams]);

  const onTagReset = useCallback((tag: string) => {
    updateStreamParams(editingFile, editingStreamId, (params) => {
      if (params.customTags == null) return;
      // todo
      // eslint-disable-next-line no-param-reassign, @typescript-eslint/no-dynamic-delete
      delete params.customTags[tag];
    });
  }, [editingFile, editingStreamId, updateStreamParams]);

  return (
    <Dialog.Root open={editingStream != null} onOpenChange={(v) => v === false && setEditingStream(undefined)}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content style={{ width: '40em' }} aria-describedby={undefined}>
          <Dialog.Title>{t('Edit track {{trackNum}} metadata', { trackNum: editingStream && (editingStream.index + 1) })}</Dialog.Title>

          <h2>{t('Parameters')}</h2>
          {editingStream != null && <StreamParametersEditor stream={editingStream} streamParams={streamParams} updateStreamParams={(setter) => updateStreamParams(editingFile, editingStreamId, setter)} />}

          <h2>Tags</h2>
          <TagEditor existingTags={existingTags} customTags={customTags} editingTag={editingTag} setEditingTag={setEditingTag} onTagsChange={onTagsChange} onTagReset={onTagReset} addTagTitle={t('Add metadata')} />

          <Dialog.ButtonRow>
            <Dialog.Close asChild>
              <DialogButton primary>{t('Done')}</DialogButton>
            </Dialog.Close>
          </Dialog.ButtonRow>

          <Dialog.CloseButton />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
});

// eslint-disable-next-line react/display-name
const Stream = memo(({ filePath, stream, onToggle, toggleCopyStreamIds, copyStream, fileDuration, setEditingStream, onExtractStreamPress, paramsByStreamId, updateStreamParams, formatTimecode, loadSubtitleTrackToSegments }: {
  filePath: string,
  stream: FileStream,
  onToggle: (a: number) => void,
  toggleCopyStreamIds: (filter: (a: FFprobeStream) => boolean) => void,
  copyStream: boolean, fileDuration: number | undefined,
  setEditingStream: (a: EditingStream) => void,
  onExtractStreamPress?: () => void,
  paramsByStreamId: ParamsByStreamId,
  updateStreamParams: UpdateStreamParams,
  formatTimecode: FormatTimecode,
  loadSubtitleTrackToSegments?: (index: number) => void,
}) => {
  const { t } = useTranslation();

  const effectiveDisposition = useMemo(() => getStreamEffectiveDisposition(paramsByStreamId, filePath, stream), [filePath, paramsByStreamId, stream]);

  const bitrate = parseInt(stream.bit_rate!, 10);
  const streamDuration = parseInt(stream.duration, 10);
  const duration = !Number.isNaN(streamDuration) ? streamDuration : fileDuration;

  let Icon: typeof FaBan;
  let codecTypeHuman;
  // eslint-disable-next-line unicorn/prefer-switch
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

  const streamFps = getStreamFps(stream);
  const language = stream.tags && stream.tags.language;
  const title = stream.tags && stream.tags.title;

  const onClick = () => onToggle && onToggle(stream.index);

  const onDispositionChange = useCallback<ChangeEventHandler<HTMLSelectElement>>((e) => {
    let newDisposition: string;
    if (dispositionOptions.includes(e.target.value)) {
      newDisposition = e.target.value;
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
        {duration != null && !Number.isNaN(duration) && `${formatTimecode({ seconds: duration, shorten: true })}`}
        {stream.nb_frames != null ? <span> {stream.nb_frames}f</span> : null}
      </td>
      <td>{!Number.isNaN(bitrate) && (stream.codec_type === 'audio' ? `${Math.round(bitrate / 1000)} kbps` : prettyBytes(bitrate, { bits: true }))}</td>
      <td style={{ maxWidth: '2.5em', wordBreak: 'break-word' }} title={title}>{title}</td>
      <td style={{ maxWidth: '2.5em', overflow: 'hidden' }} title={language}>{language}</td>
      <td>{stream.width && stream.height && `${stream.width}x${stream.height}`} {stream.channels && `${stream.channels}c`} {stream.channel_layout} {streamFps && `${streamFps.toFixed(2)}fps`}</td>
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

      <td style={{ textAlign: 'right', fontSize: '1.1em' }}>
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

function FileHeading({ path, formatData, chapters, onTrashClick, onEditClick, toggleCopyAllStreams, onExtractAllStreamsPress, changeEnabledStreamsFilter }: {
  path: string,
  formatData: FFprobeFormat | undefined,
  chapters?: FFprobeChapter[] | undefined,
  onTrashClick?: (() => void) | undefined,
  onEditClick?: (() => void) | undefined,
  toggleCopyAllStreams: () => void,
  onExtractAllStreamsPress?: () => Promise<void>,
  changeEnabledStreamsFilter?: (() => void) | undefined,
}) {
  const { t } = useTranslation();

  return (
    <div style={{ display: 'flex', marginBottom: '.2em', borderBottom: '1px solid var(--gray-7)' }}>
      <div title={path} style={{ wordBreak: 'break-all', marginRight: '1em', fontWeight: 'bold' }}>{path.replace(/.*\/([^/]+)$/, '$1')}</div>

      <div style={{ flexGrow: 1 }} />

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '.2em', fontSize: '1.3em', marginBottom: '.2em' }}>
        {chapters && chapters.length > 0 && (
          <Json5Dialog title={t('Chapters')} json={chapters}>
            <Button title={t('Chapters')}><FaBook style={{ verticalAlign: 'middle' }} /></Button>
          </Json5Dialog>
        )}
        <Json5Dialog title={t('File info')} json={formatData}>
          <Button title={t('File info')}><FaInfoCircle style={{ verticalAlign: 'middle' }} /></Button>
        </Json5Dialog>
        {onEditClick && <Button title={t('Edit file metadata')} onClick={onEditClick}><FaEdit style={{ verticalAlign: 'middle' }} /></Button>}
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
        <th>{t('Lang')}</th>
        <th>{t('Data')}</th>
        <th>{t('Disposition')}</th>
        <th />
      </tr>
    </thead>
  );
}

const fileStyle: CSSProperties = { marginBottom: '2em', padding: '.5em 0', overflowX: 'auto' };


function StreamsSelector({
  mainFilePath, mainFileFormatData, mainFileStreams, mainFileChapters, isCopyingStreamId, toggleCopyStreamId, setCopyStreamIdsForPath, onExtractStreamPress, onExtractAllStreamsPress, allFilesMeta, externalFilesMeta, setExternalFilesMeta, showAddStreamSourceDialog, shortestFlag, setShortestFlag, nonCopiedExtraStreams, customTagsByFile, setCustomTagsByFile, paramsByStreamId, updateStreamParams, formatTimecode, loadSubtitleTrackToSegments, toggleCopyStreamIds, changeEnabledStreamsFilter, toggleCopyAllStreamsForPath, onStreamSourceFileDrop,
}: {
  mainFilePath: string,
  mainFileFormatData: FFprobeFormat | undefined,
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
  customTagsByFile: CustomTagsByFile,
  setCustomTagsByFile: Dispatch<SetStateAction<CustomTagsByFile>>,
  paramsByStreamId: ParamsByStreamId,
  updateStreamParams: UpdateStreamParams,
  formatTimecode: FormatTimecode,
  loadSubtitleTrackToSegments: (index: number) => void,
  toggleCopyStreamIds: (path: string, filter: (a: FFprobeStream) => boolean) => void,
  changeEnabledStreamsFilter: () => void,
  toggleCopyAllStreamsForPath: (path: string) => void,
  onStreamSourceFileDrop: DragEventHandler<HTMLDivElement>,
}) {
  const [editingFile, setEditingFile] = useState<string>();
  const [editingStream, setEditingStream] = useState<EditingStream>();
  const [editingTag, setEditingTag] = useState<string>();
  const { t } = useTranslation();

  function getFormatDuration(formatData: FFprobeFormat | undefined) {
    if (!formatData || !formatData.duration) return undefined;
    const parsed = parseFloat(formatData.duration);
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

  return (
    <>
      <div style={fileStyle} onDrop={onStreamSourceFileDrop}>
        {/* We only support editing main file metadata for now */}
        <FileHeading path={mainFilePath} formatData={mainFileFormatData} chapters={mainFileChapters} onEditClick={() => setEditingFile(mainFilePath)} toggleCopyAllStreams={() => toggleCopyAllStreamsForPath(mainFilePath)} onExtractAllStreamsPress={onExtractAllStreamsPress} changeEnabledStreamsFilter={changeEnabledStreamsFilter} />
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
                fileDuration={getFormatDuration(mainFileFormatData)}
                onExtractStreamPress={() => onExtractStreamPress(stream.index)}
                paramsByStreamId={paramsByStreamId}
                updateStreamParams={updateStreamParams}
                formatTimecode={formatTimecode}
                loadSubtitleTrackToSegments={loadSubtitleTrackToSegments}
              />
            ))}
          </tbody>
        </table>
      </div>

      {externalFilesEntries.map(([path, { streams: externalFileStreams, formatData }]) => (
        <div key={path} style={fileStyle}>
          <FileHeading path={path} formatData={formatData} onTrashClick={() => removeFile(path)} toggleCopyAllStreams={() => toggleCopyAllStreamsForPath(path)} />

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
                  fileDuration={getFormatDuration(formatData)}
                  paramsByStreamId={paramsByStreamId}
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
            <Dialog.Content style={{ width: '40em' }} aria-describedby={undefined}>
              <Dialog.Title>{t('Edit file metadata')}</Dialog.Title>

              <EditFileDialog editingFile={editingFile} editingTag={editingTag} setEditingTag={setEditingTag} allFilesMeta={allFilesMeta} customTagsByFile={customTagsByFile} setCustomTagsByFile={setCustomTagsByFile} />

              <Dialog.ButtonRow>
                <Dialog.Close asChild>
                  <DialogButton primary>{t('Done')}</DialogButton>
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
          paramsByStreamId={paramsByStreamId}
          updateStreamParams={updateStreamParams}
        />
      )}
    </>
  );
}

export default memo(StreamsSelector);
