import { memo, useState, useMemo, useCallback, Dispatch, SetStateAction, CSSProperties, ReactNode, ChangeEventHandler } from 'react';

import { FaImage, FaCheckCircle, FaPaperclip, FaVideo, FaVideoSlash, FaFileImport, FaVolumeUp, FaVolumeMute, FaBan, FaFileExport } from 'react-icons/fa';
import { GoFileBinary } from 'react-icons/go';
import { MdSubtitles } from 'react-icons/md';
import { Checkbox, BookIcon, MoreIcon, Position, Popover, Menu, TrashIcon, EditIcon, InfoSignIcon, IconButton, Heading, SortAscIcon, SortDescIcon, Dialog, ForkIcon, WarningSignIcon } from 'evergreen-ui';
import { useTranslation } from 'react-i18next';
import prettyBytes from 'pretty-bytes';

import AutoExportToggler from './components/AutoExportToggler';
import Select from './components/Select';
import { showJson5Dialog } from './dialogs';
import { getStreamFps } from './ffmpeg';
import { deleteDispositionValue } from './util';
import { getActiveDisposition, attachedPicDisposition, isGpsStream } from './util/streams';
import TagEditor from './components/TagEditor';
import { FFprobeChapter, FFprobeFormat, FFprobeStream } from '../../../ffprobe';
import { CustomTagsByFile, FilesMeta, FormatTimecode, ParamsByStreamId, StreamParams } from './types';
import useUserSettings from './hooks/useUserSettings';
import tryShowGpsMap from './gps';
import Button from './components/Button';


const dispositionOptions = ['default', 'dub', 'original', 'comment', 'lyrics', 'karaoke', 'forced', 'hearing_impaired', 'visual_impaired', 'clean_effects', 'attached_pic', 'captions', 'descriptions', 'dependent', 'metadata'];
const unchangedDispositionValue = 'llc_disposition_unchanged';

type UpdateStreamParams = (fileId: string, streamId: number, setter: (a: StreamParams) => void) => void;

interface EditingStream {
  streamId: number;
  path: string;
}

// eslint-disable-next-line react/display-name
const EditFileDialog = memo(({ editingFile, allFilesMeta, customTagsByFile, setCustomTagsByFile, editingTag, setEditingTag }: {
  editingFile: string, allFilesMeta: FilesMeta, customTagsByFile: CustomTagsByFile, setCustomTagsByFile: Dispatch<SetStateAction<CustomTagsByFile>>, editingTag: string | undefined, setEditingTag: (tag: string | undefined) => void
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

  return <TagEditor existingTags={existingTags} customTags={customTags} editingTag={editingTag} setEditingTag={setEditingTag} onTagsChange={onTagsChange} onTagReset={onTagReset} addTagTitle={t('Add metadata')} addTagText={t('Enter metadata key')} />;
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
      <Checkbox key="bsfH264Mp4toannexb" checked={!!streamParams.bsfH264Mp4toannexb} label={t('Enable "{{filterName}}" bitstream filter.', { filterName: 'h264_mp4toannexb' })} onChange={(e) => updateStreamParams((params) => { params.bsfH264Mp4toannexb = e.target.checked; })} />,
    );
  }
  if (stream.codec_name === 'hevc') {
    ui.push(
      // eslint-disable-next-line no-param-reassign
      <Checkbox key="bsfHevcMp4toannexb" checked={!!streamParams.bsfHevcMp4toannexb} label={t('Enable "{{filterName}}" bitstream filter.', { filterName: 'hevc_mp4toannexb' })} onChange={(e) => updateStreamParams((params) => { params.bsfHevcMp4toannexb = e.target.checked; })} />,
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
  editingStream: EditingStream, setEditingStream: Dispatch<SetStateAction<EditingStream | undefined>>, allFilesMeta: FilesMeta, paramsByStreamId: ParamsByStreamId, updateStreamParams: UpdateStreamParams,
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
    <Dialog
      title={t('Edit track {{trackNum}} metadata', { trackNum: editingStream && (editingStream.index + 1) })}
      isShown={!!editingStream}
      hasCancel={false}
      isConfirmDisabled={editingTag != null}
      confirmLabel={t('Done')}
      onCloseComplete={() => setEditingStream(undefined)}
    >
      <div style={{ color: 'black' }}>
        <Heading>Parameters</Heading>
        {editingStream != null && <StreamParametersEditor stream={editingStream} streamParams={streamParams} updateStreamParams={(setter) => updateStreamParams(editingFile, editingStreamId, setter)} />}
        <Heading>Tags</Heading>
        <TagEditor existingTags={existingTags} customTags={customTags} editingTag={editingTag} setEditingTag={setEditingTag} onTagsChange={onTagsChange} onTagReset={onTagReset} addTagTitle={t('Add metadata')} addTagText={t('Enter metadata key')} />
      </div>
    </Dialog>
  );
});

// eslint-disable-next-line react/display-name
const Stream = memo(({ filePath, stream, onToggle, batchSetCopyStreamIds, copyStream, fileDuration, setEditingStream, onExtractStreamPress, paramsByStreamId, updateStreamParams, formatTimecode, loadSubtitleTrackToSegments, onInfoClick }: {
  filePath: string, stream: FFprobeStream, onToggle: (a: number) => void, batchSetCopyStreamIds: (filter: (a: FFprobeStream) => boolean, enabled: boolean) => void, copyStream: boolean, fileDuration: number | undefined, setEditingStream: (a: EditingStream) => void, onExtractStreamPress?: () => void, paramsByStreamId: ParamsByStreamId, updateStreamParams: UpdateStreamParams, formatTimecode: FormatTimecode, loadSubtitleTrackToSegments?: (index: number) => void, onInfoClick: (json: unknown, title: string) => void,
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

  const onLoadGpsTrackClick = useCallback(async () => {
    await tryShowGpsMap(filePath, stream.index);
  }, [filePath, stream.index]);

  const codecTag = stream.codec_tag !== '0x0000' && stream.codec_tag_string;

  return (
    <tr style={{ opacity: copyStream ? undefined : 0.4 }}>
      <td style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>
        <IconButton iconSize={20} color={copyStream ? '#52BD95' : '#D14343'} title={`${t('Click to toggle track inclusion when exporting')} (type ${codecTypeHuman})`} appearance="minimal" icon={Icon} onClick={onClick} />
        <div style={{ width: 20, textAlign: 'center' }}>{stream.index + 1}</div>
      </td>
      <td style={{ maxWidth: '3em', overflow: 'hidden' }} title={stream.codec_name}>{stream.codec_name} {codecTag}</td>
      <td>
        {duration != null && !Number.isNaN(duration) && `${formatTimecode({ seconds: duration, shorten: true })}`}
        {stream.nb_frames != null ? <div>{stream.nb_frames}f</div> : null}
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

      <td style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <IconButton icon={InfoSignIcon} title={t('Track {{num}} info', { num: stream.index + 1 })} onClick={() => onInfoClick(stream, t('Track {{num}} info', { num: stream.index + 1 }))} appearance="minimal" iconSize={18} />

        <Popover
          position={Position.BOTTOM_LEFT}
          content={(
            <Menu>
              <Menu.Group>
                <Menu.Item icon={EditIcon} onClick={() => setEditingStream({ streamId: stream.index, path: filePath })}>
                  {t('Edit track metadata')}
                </Menu.Item>
                {onExtractStreamPress && (
                  <Menu.Item icon={<FaFileExport color="black" />} onClick={onExtractStreamPress}>
                    {t('Extract this track as file')}
                  </Menu.Item>
                )}
                {stream.codec_type === 'subtitle' && (
                  <Menu.Item icon={<MdSubtitles color="black" />} onClick={onLoadSubtitleTrackToSegmentsClick}>
                    {t('Create segments from subtitles')}
                  </Menu.Item>
                )}
                {isGpsStream(stream) && (
                  <Menu.Item icon={<MdSubtitles color="black" />} onClick={onLoadGpsTrackClick}>
                    {t('Show GPS map')}
                  </Menu.Item>
                )}
              </Menu.Group>
              <Menu.Divider />
              <Menu.Group>
                <Menu.Item icon={<Icon color="black" />} intent="success" onClick={() => batchSetCopyStreamIds((s) => s.codec_type === stream.codec_type, true)}>
                  {t('Keep all {{type}} tracks', { type: codecTypeHuman })}
                </Menu.Item>
                <Menu.Item icon={<FaBan color="black" />} intent="danger" onClick={() => batchSetCopyStreamIds((s) => s.codec_type === stream.codec_type, false)}>
                  {t('Discard all {{type}} tracks', { type: codecTypeHuman })}
                </Menu.Item>
              </Menu.Group>
            </Menu>
          )}
        >
          <IconButton icon={MoreIcon} appearance="minimal" />
        </Popover>
      </td>
    </tr>
  );
});

function FileHeading({ path, formatData, chapters, onTrashClick, onEditClick, setCopyAllStreams, onExtractAllStreamsPress, onInfoClick }: {
  path: string, formatData: FFprobeFormat | undefined, chapters?: FFprobeChapter[] | undefined, onTrashClick?: (() => void) | undefined, onEditClick?: (() => void) | undefined, setCopyAllStreams: (a: boolean) => void, onExtractAllStreamsPress?: () => Promise<void>, onInfoClick: (json: unknown, title: string) => void,
}) {
  const { t } = useTranslation();

  return (
    <div style={{ display: 'flex', marginBottom: '.2em', borderBottom: '1px solid var(--gray7)' }}>
      <div title={path} style={{ wordBreak: 'break-all', marginRight: '1em', fontWeight: 'bold' }}>{path.replace(/.*\/([^/]+)$/, '$1')}</div>

      <div style={{ flexGrow: 1 }} />

      <IconButton icon={InfoSignIcon} title={t('File info')} onClick={() => onInfoClick(formatData, t('File info'))} appearance="minimal" iconSize={18} />
      {chapters && chapters.length > 0 && <IconButton icon={BookIcon} onClick={() => onInfoClick(chapters, t('Chapters'))} appearance="minimal" iconSize={18} />}
      {onEditClick && <IconButton icon={EditIcon} title={t('Edit file metadata')} onClick={onEditClick} appearance="minimal" iconSize={18} />}
      {onTrashClick && <IconButton icon={TrashIcon} onClick={onTrashClick} appearance="minimal" iconSize={18} />}
      <IconButton iconSize={18} color="#52BD95" icon={FaCheckCircle} title={t('Keep all tracks')} onClick={() => setCopyAllStreams(true)} appearance="minimal" />
      <IconButton iconSize={18} color="#D14343" icon={FaBan} title={t('Discard all tracks')} onClick={() => setCopyAllStreams(false)} appearance="minimal" />
      {onExtractAllStreamsPress && <IconButton iconSize={16} title={t('Export each track as individual files')} icon={ForkIcon} onClick={onExtractAllStreamsPress} appearance="minimal" />}
    </div>
  );
}

const thStyle: CSSProperties = { borderBottom: '1px solid var(--gray6)', paddingBottom: '.5em' };

function Thead() {
  const { t } = useTranslation();
  return (
    <thead style={{ color: 'var(--gray12)', textAlign: 'left', fontSize: '.9em' }}>
      <tr>
        <th style={thStyle}>{t('Keep?')}</th>
        <th style={thStyle}>{t('Codec')}</th>
        <th style={thStyle}>{t('Duration')}</th>
        <th style={thStyle}>{t('Bitrate')}</th>
        <th style={thStyle}>{t('Title')}</th>
        <th style={thStyle}>{t('Lang')}</th>
        <th style={thStyle}>{t('Data')}</th>
        <th style={thStyle}>{t('Disposition')}</th>
        <th style={thStyle} />
      </tr>
    </thead>
  );
}

const tableStyle: CSSProperties = { fontSize: 14, width: '100%', borderCollapse: 'collapse' };
const fileStyle: CSSProperties = { margin: '1.5em 1em 1.5em 1em', padding: 5, overflowX: 'auto' };


function StreamsSelector({
  mainFilePath, mainFileFormatData, mainFileStreams, mainFileChapters, isCopyingStreamId, toggleCopyStreamId, setCopyStreamIdsForPath, onExtractStreamPress, onExtractAllStreamsPress, allFilesMeta, externalFilesMeta, setExternalFilesMeta, showAddStreamSourceDialog, shortestFlag, setShortestFlag, nonCopiedExtraStreams, customTagsByFile, setCustomTagsByFile, paramsByStreamId, updateStreamParams, formatTimecode, loadSubtitleTrackToSegments,
}: {
  mainFilePath: string,
  mainFileFormatData: FFprobeFormat | undefined,
  mainFileStreams: FFprobeStream[],
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
}) {
  const [editingFile, setEditingFile] = useState<string>();
  const [editingStream, setEditingStream] = useState<EditingStream>();
  const [editingTag, setEditingTag] = useState<string>();
  const { t } = useTranslation();
  const { darkMode } = useUserSettings();

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

  function batchSetCopyStreamIdsForPath(path: string, streams: FFprobeStream[], filter: (a: FFprobeStream) => boolean, enabled: boolean) {
    setCopyStreamIdsForPath(path, (old) => {
      const ret = { ...old };
      // eslint-disable-next-line unicorn/no-array-callback-reference
      streams.filter(filter).forEach(({ index }) => {
        ret[index] = enabled;
      });
      return ret;
    });
  }

  function setCopyAllStreamsForPath(path: string, enabled: boolean) {
    setCopyStreamIdsForPath(path, (old) => Object.fromEntries(Object.entries(old).map(([streamId]) => [streamId, enabled])));
  }

  const externalFilesEntries = Object.entries(externalFilesMeta);

  const onInfoClick = useCallback((json: unknown, title: string) => {
    showJson5Dialog({ title, json, darkMode });
  }, [darkMode]);

  return (
    <>
      <p style={{ margin: '.5em 2em .5em 1em' }}>{t('Click to select which tracks to keep when exporting:')}</p>

      <div style={fileStyle}>
        {/* We only support editing main file metadata for now */}
        <FileHeading onInfoClick={onInfoClick} path={mainFilePath} formatData={mainFileFormatData} chapters={mainFileChapters} onEditClick={() => setEditingFile(mainFilePath)} setCopyAllStreams={(enabled) => setCopyAllStreamsForPath(mainFilePath, enabled)} onExtractAllStreamsPress={onExtractAllStreamsPress} />
        <table style={tableStyle}>
          <Thead />

          <tbody>
            {mainFileStreams.map((stream) => (
              <Stream
                key={stream.index}
                filePath={mainFilePath}
                stream={stream}
                copyStream={isCopyingStreamId(mainFilePath, stream.index)}
                onToggle={(streamId) => toggleCopyStreamId(mainFilePath, streamId)}
                batchSetCopyStreamIds={(filter: (a: FFprobeStream) => boolean, enabled: boolean) => batchSetCopyStreamIdsForPath(mainFilePath, mainFileStreams, filter, enabled)}
                setEditingStream={setEditingStream}
                fileDuration={getFormatDuration(mainFileFormatData)}
                onExtractStreamPress={() => onExtractStreamPress(stream.index)}
                paramsByStreamId={paramsByStreamId}
                updateStreamParams={updateStreamParams}
                formatTimecode={formatTimecode}
                loadSubtitleTrackToSegments={loadSubtitleTrackToSegments}
                onInfoClick={onInfoClick}
              />
            ))}
          </tbody>
        </table>
      </div>

      {externalFilesEntries.map(([path, { streams: externalFileStreams, formatData }]) => (
        <div key={path} style={fileStyle}>
          <FileHeading path={path} formatData={formatData} onTrashClick={() => removeFile(path)} setCopyAllStreams={(enabled) => setCopyAllStreamsForPath(path, enabled)} onInfoClick={onInfoClick} />

          <table style={tableStyle}>
            <Thead />
            <tbody>
              {externalFileStreams.map((stream) => (
                <Stream
                  key={stream.index}
                  filePath={path}
                  stream={stream}
                  copyStream={isCopyingStreamId(path, stream.index)}
                  onToggle={(streamId) => toggleCopyStreamId(path, streamId)}
                  batchSetCopyStreamIds={(filter: (a: FFprobeStream) => boolean, enabled: boolean) => batchSetCopyStreamIdsForPath(path, externalFileStreams, filter, enabled)}
                  setEditingStream={setEditingStream}
                  fileDuration={getFormatDuration(formatData)}
                  paramsByStreamId={paramsByStreamId}
                  updateStreamParams={updateStreamParams}
                  formatTimecode={formatTimecode}
                  onInfoClick={onInfoClick}
                />
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <div style={{ margin: '1em 1em' }}>
        {externalFilesEntries.length > 0 && (
          <div style={{ marginBottom: '1em' }}><WarningSignIcon color="warning" /> {t('Note: Cutting and including external tracks at the same time does not yet work. If you want to do both, it must be done as separate operations. See github issue #896.')}</div>
        )}

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
              {shortestFlag ? <><SortDescIcon verticalAlign="middle" marginRight=".5em" />{t('Shortest')}</> : <><SortAscIcon verticalAlign="middle" marginRight=".5em" />{t('Longest')}</>}
            </Button>
          </div>
        )}
      </div>

      <Dialog
        title={t('Edit file metadata')}
        isShown={editingFile != null}
        hasCancel={false}
        confirmLabel={t('Done')}
        onCloseComplete={() => setEditingFile(undefined)}
        isConfirmDisabled={editingTag != null}
      >
        <div style={{ color: 'black' }}>
          {editingFile != null && <EditFileDialog editingFile={editingFile} editingTag={editingTag} setEditingTag={setEditingTag} allFilesMeta={allFilesMeta} customTagsByFile={customTagsByFile} setCustomTagsByFile={setCustomTagsByFile} />}
        </div>
      </Dialog>

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
