import React, { memo, useState, useMemo, useCallback } from 'react';

import { FaImage, FaCheckCircle, FaPaperclip, FaVideo, FaVideoSlash, FaFileImport, FaVolumeUp, FaVolumeMute, FaBan, FaFileExport } from 'react-icons/fa';
import { GoFileBinary } from 'react-icons/go';
import { MdSubtitles } from 'react-icons/md';
import { Checkbox, BookIcon, MoreIcon, Position, Popover, Menu, TrashIcon, EditIcon, InfoSignIcon, IconButton, Heading, SortAscIcon, SortDescIcon, Dialog, Button, ForkIcon, WarningSignIcon } from 'evergreen-ui';
import { useTranslation } from 'react-i18next';
import prettyBytes from 'pretty-bytes';

import AutoExportToggler from './components/AutoExportToggler';
import Select from './components/Select';
import { showJson5Dialog } from './dialogs';
import { formatDuration } from './util/duration';
import { getStreamFps } from './ffmpeg';
import { deleteDispositionValue } from './util';
import { getActiveDisposition, attachedPicDisposition } from './util/streams';
import TagEditor from './components/TagEditor';


const dispositionOptions = ['default', 'dub', 'original', 'comment', 'lyrics', 'karaoke', 'forced', 'hearing_impaired', 'visual_impaired', 'clean_effects', 'attached_pic', 'captions', 'descriptions', 'dependent', 'metadata'];
const unchangedDispositionValue = 'llc_disposition_unchanged';


const EditFileDialog = memo(({ editingFile, allFilesMeta, customTagsByFile, setCustomTagsByFile, editingTag, setEditingTag }) => {
  const { t } = useTranslation();

  const { formatData } = allFilesMeta[editingFile];
  const existingTags = formatData.tags || {};
  const customTags = customTagsByFile[editingFile] || {};

  const onTagChange = useCallback((tag, value) => {
    setCustomTagsByFile((old) => ({ ...old, [editingFile]: { ...old[editingFile], [tag]: value } }));
  }, [editingFile, setCustomTagsByFile]);

  const onTagReset = useCallback((tag) => {
    setCustomTagsByFile((old) => {
      const { [tag]: deleted, ...rest } = old[editingFile] || {};
      return { ...old, [editingFile]: rest };
    });
  }, [editingFile, setCustomTagsByFile]);

  return <TagEditor existingTags={existingTags} customTags={customTags} editingTag={editingTag} setEditingTag={setEditingTag} onTagChange={onTagChange} onTagReset={onTagReset} addTagTitle={t('Add metadata')} addTagText={t('Enter metadata key')} />;
});

const getStreamDispositionsObj = (stream) => ((stream && stream.disposition) || {});

function getStreamEffectiveDisposition(paramsByStreamId, fileId, stream) {
  const customDisposition = paramsByStreamId.get(fileId)?.get(stream.index)?.get('disposition');
  const existingDispositionsObj = getStreamDispositionsObj(stream);

  if (customDisposition) return customDisposition;
  return getActiveDisposition(existingDispositionsObj);
}


const StreamParametersEditor = ({ stream, streamParams, updateStreamParams }) => {
  const { t } = useTranslation();

  const ui = [];
  // https://github.com/mifi/lossless-cut/issues/1680#issuecomment-1682915193
  if (stream.codec_name === 'h264') {
    ui.push(
      <Checkbox key="bsfH264Mp4toannexb" checked={!!streamParams.get('bsfH264Mp4toannexb')} label={t('Enable "{{filterName}}" bitstream filter.', { filterName: 'h264_mp4toannexb' })} onChange={(e) => updateStreamParams((params) => params.set('bsfH264Mp4toannexb', e.target.checked))} />,
    );
  }
  if (stream.codec_name === 'hevc') {
    ui.push(
      <Checkbox key="bsfHevcMp4toannexb" checked={!!streamParams.get('bsfHevcMp4toannexb')} label={t('Enable "{{filterName}}" bitstream filter.', { filterName: 'hevc_mp4toannexb' })} onChange={(e) => updateStreamParams((params) => params.set('bsfHevcMp4toannexb', e.target.checked))} />,
    );
  }

  return (
    <div style={{ marginBottom: '1em' }}>
      {ui.length > 0
        ? ui
        : t('No editable parameters for this stream.')}
    </div>
  );
};

const EditStreamDialog = memo(({ editingStream: { streamId: editingStreamId, path: editingFile }, setEditingStream, allFilesMeta, paramsByStreamId, updateStreamParams }) => {
  const { t } = useTranslation();
  const [editingTag, setEditingTag] = useState();

  const { streams } = allFilesMeta[editingFile];
  const editingStream = useMemo(() => streams.find((s) => s.index === editingStreamId), [streams, editingStreamId]);

  const existingTags = useMemo(() => (editingStream && editingStream.tags) || {}, [editingStream]);

  const streamParams = useMemo(() => paramsByStreamId.get(editingFile)?.get(editingStreamId) ?? new Map(), [editingFile, editingStreamId, paramsByStreamId]);
  const customTags = useMemo(() => streamParams.get('customTags') ?? {}, [streamParams]);

  const onTagChange = useCallback((tag, value) => {
    updateStreamParams(editingFile, editingStreamId, (params) => {
      if (!params.has('customTags')) params.set('customTags', {});
      const tags = params.get('customTags');
      tags[tag] = value;
    });
  }, [editingFile, editingStreamId, updateStreamParams]);

  const onTagReset = useCallback((tag) => {
    updateStreamParams(editingFile, editingStreamId, (params) => {
      if (!params.has('customTags')) return;
      // eslint-disable-next-line no-param-reassign
      delete params.get('customTags')[tag];
    });
  }, [editingFile, editingStreamId, updateStreamParams]);

  return (
    <Dialog
      title={t('Edit track {{trackNum}} metadata', { trackNum: editingStream && (editingStream.index + 1) })}
      isShown={!!editingStream}
      hasCancel={false}
      isConfirmDisabled={editingTag != null}
      confirmLabel={t('Done')}
      onCloseComplete={() => setEditingStream()}
    >
      <div style={{ color: 'black' }}>
        <Heading>Parameters</Heading>
        <StreamParametersEditor stream={editingStream} streamParams={streamParams} updateStreamParams={(setter) => updateStreamParams(editingFile, editingStreamId, setter)} />
        <Heading>Tags</Heading>
        <TagEditor existingTags={existingTags} customTags={customTags} editingTag={editingTag} setEditingTag={setEditingTag} onTagChange={onTagChange} onTagReset={onTagReset} addTagTitle={t('Add metadata')} addTagText={t('Enter metadata key')} />
      </div>
    </Dialog>
  );
});

function onInfoClick(json, title) {
  showJson5Dialog({ title, json });
}

const Stream = memo(({ filePath, stream, onToggle, batchSetCopyStreamIds, copyStream, fileDuration, setEditingStream, onExtractStreamPress, paramsByStreamId, updateStreamParams }) => {
  const { t } = useTranslation();

  const effectiveDisposition = useMemo(() => getStreamEffectiveDisposition(paramsByStreamId, filePath, stream), [filePath, paramsByStreamId, stream]);

  const bitrate = parseInt(stream.bit_rate, 10);
  const streamDuration = parseInt(stream.duration, 10);
  const duration = !Number.isNaN(streamDuration) ? streamDuration : fileDuration;

  let Icon;
  let codecTypeHuman;
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

  const onDispositionChange = useCallback((e) => {
    let newDisposition;
    if (dispositionOptions.includes(e.target.value)) {
      newDisposition = e.target.value;
    } else if (e.target.value === deleteDispositionValue) {
      newDisposition = deleteDispositionValue; // needs a separate value (not a real disposition)
    } // else unchanged (undefined)

    updateStreamParams(filePath, stream.index, (params) => params.set('disposition', newDisposition));
  }, [filePath, updateStreamParams, stream.index]);

  const codecTag = stream.codec_tag !== '0x0000' && stream.codec_tag_string;

  return (
    <tr style={{ opacity: copyStream ? undefined : 0.4 }}>
      <td style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>
        <IconButton iconSize={20} color={copyStream ? '#52BD95' : '#D14343'} title={`${t('Click to toggle track inclusion when exporting')} (type ${codecTypeHuman})`} appearance="minimal" icon={Icon} onClick={onClick} />
        <div style={{ width: 20, textAlign: 'center' }}>{stream.index + 1}</div>
      </td>
      <td style={{ maxWidth: '3em', overflow: 'hidden' }} title={stream.codec_name}>{stream.codec_name} {codecTag}</td>
      <td>
        {!Number.isNaN(duration) && `${formatDuration({ seconds: duration, shorten: true })}`}
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
        <IconButton icon={InfoSignIcon} title={t('Track {{trackNum}} info', { trackNum: stream.index + 1 })} onClick={() => onInfoClick(stream, t('Track {{trackNum}} info', { trackNum: stream.index + 1 }))} appearance="minimal" iconSize={18} />

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

const FileHeading = ({ path, formatData, chapters, onTrashClick, onEditClick, setCopyAllStreams, onExtractAllStreamsPress }) => {
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
};

const thStyle = { borderBottom: '1px solid var(--gray6)', paddingBottom: '.5em' };

const Thead = () => {
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
};

const tableStyle = { fontSize: 14, width: '100%', borderCollapse: 'collapse' };
const fileStyle = { margin: '1.5em 1em 1.5em 1em', padding: 5, overflowX: 'auto' };

const StreamsSelector = memo(({
  mainFilePath, mainFileFormatData, mainFileStreams, mainFileChapters, isCopyingStreamId, toggleCopyStreamId,
  setCopyStreamIdsForPath, onExtractStreamPress, onExtractAllStreamsPress, allFilesMeta, externalFilesMeta, setExternalFilesMeta,
  showAddStreamSourceDialog, shortestFlag, setShortestFlag, nonCopiedExtraStreams,
  customTagsByFile, setCustomTagsByFile, paramsByStreamId, updateStreamParams,
}) => {
  const [editingFile, setEditingFile] = useState();
  const [editingStream, setEditingStream] = useState();
  const { t } = useTranslation();
  const [editingTag, setEditingTag] = useState();

  function getFormatDuration(formatData) {
    if (!formatData || !formatData.duration) return undefined;
    const parsed = parseFloat(formatData.duration, 10);
    if (Number.isNaN(parsed)) return undefined;
    return parsed;
  }

  async function removeFile(path) {
    setCopyStreamIdsForPath(path, () => ({}));
    setExternalFilesMeta((old) => {
      const { [path]: val, ...rest } = old;
      return rest;
    });
  }

  async function batchSetCopyStreamIdsForPath(path, streams, filter, enabled) {
    setCopyStreamIdsForPath(path, (old) => {
      const ret = { ...old };
      streams.filter(filter).forEach(({ index }) => {
        ret[index] = enabled;
      });
      return ret;
    });
  }

  async function setCopyAllStreamsForPath(path, enabled) {
    setCopyStreamIdsForPath(path, (old) => Object.fromEntries(Object.entries(old).map(([streamId]) => [streamId, enabled])));
  }

  const externalFilesEntries = Object.entries(externalFilesMeta);

  return (
    <>
      <p style={{ margin: '.5em 1em' }}>{t('Click to select which tracks to keep when exporting:')}</p>

      <div style={fileStyle}>
        {/* We only support editing main file metadata for now */}
        <FileHeading path={mainFilePath} formatData={mainFileFormatData} chapters={mainFileChapters} onEditClick={() => setEditingFile(mainFilePath)} setCopyAllStreams={(enabled) => setCopyAllStreamsForPath(mainFilePath, enabled)} onExtractAllStreamsPress={onExtractAllStreamsPress} />
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
                batchSetCopyStreamIds={(filter, enabled) => batchSetCopyStreamIdsForPath(mainFilePath, mainFileStreams, filter, enabled)}
                setEditingStream={setEditingStream}
                fileDuration={getFormatDuration(mainFileFormatData)}
                onExtractStreamPress={() => onExtractStreamPress(stream.index)}
                paramsByStreamId={paramsByStreamId}
                updateStreamParams={updateStreamParams}
              />
            ))}
          </tbody>
        </table>
      </div>

      {externalFilesEntries.map(([path, { streams, formatData }]) => (
        <div key={path} style={fileStyle}>
          <FileHeading path={path} formatData={formatData} onTrashClick={() => removeFile(path)} setCopyAllStreams={(enabled) => setCopyAllStreamsForPath(path, enabled)} />

          <table style={tableStyle}>
            <Thead />
            <tbody>
              {streams.map((stream) => (
                <Stream
                  key={stream.index}
                  filePath={path}
                  stream={stream}
                  copyStream={isCopyingStreamId(path, stream.index)}
                  onToggle={(streamId) => toggleCopyStreamId(path, streamId)}
                  batchSetCopyStreamIds={(filter, enabled) => batchSetCopyStreamIdsForPath(path, streams, filter, enabled)}
                  setEditingStream={setEditingStream}
                  fileDuration={getFormatDuration(formatData)}
                  paramsByStreamId={paramsByStreamId}
                  updateStreamParams={updateStreamParams}
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

        <Button iconBefore={<FaFileImport size={16} />} marginBottom="1em" onClick={showAddStreamSourceDialog}>
          {t('Include more tracks from other file')}
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
            <Button iconBefore={shortestFlag ? SortDescIcon : SortAscIcon} onClick={() => setShortestFlag((value) => !value)}>
              {shortestFlag ? t('Shortest') : t('Longest')}
            </Button>
          </div>
        )}
      </div>

      <Dialog
        title={t('Edit file metadata')}
        isShown={editingFile != null}
        hasCancel={false}
        confirmLabel={t('Done')}
        onCloseComplete={() => setEditingFile()}
        isConfirmDisabled={editingTag != null}
      >
        <EditFileDialog editingFile={editingFile} editingTag={editingTag} setEditingTag={setEditingTag} allFilesMeta={allFilesMeta} customTagsByFile={customTagsByFile} setCustomTagsByFile={setCustomTagsByFile} />
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
});

export default StreamsSelector;
