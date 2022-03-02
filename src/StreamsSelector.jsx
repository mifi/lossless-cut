import React, { memo, useState, useMemo, useCallback } from 'react';

import { FaCheckCircle, FaPaperclip, FaVideo, FaVideoSlash, FaFileImport, FaVolumeUp, FaVolumeMute, FaBan, FaFileExport } from 'react-icons/fa';
import { GoFileBinary } from 'react-icons/go';
import { FiEdit, FiCheck, FiTrash } from 'react-icons/fi';
import { MdSubtitles } from 'react-icons/md';
import { BookIcon, Paragraph, TextInput, MoreIcon, Position, Popover, Menu, TrashIcon, EditIcon, InfoSignIcon, IconButton, Select, Heading, SortAscIcon, SortDescIcon, Dialog, Button, PlusIcon, Pane, ForkIcon, Alert } from 'evergreen-ui';
import { useTranslation } from 'react-i18next';

import AutoExportToggler from './components/AutoExportToggler';
import { askForMetadataKey, showJson5Dialog } from './dialogs';
import { formatDuration } from './util/duration';
import { getStreamFps } from './ffmpeg';
import { deleteDispositionValue } from './util';
import { getActiveDisposition } from './util/streams';


const activeColor = '#429777';

const dispositionOptions = ['default', 'dub', 'original', 'comment', 'lyrics', 'karaoke', 'forced', 'hearing_impaired', 'visual_impaired', 'clean_effects', 'attached_pic', 'captions', 'descriptions', 'dependent', 'metadata'];
const unchangedDispositionValue = 'llc_disposition_unchanged';

const TagEditor = memo(({ existingTags, customTags, onTagChange, onTagReset }) => {
  const { t } = useTranslation();

  const [editingTag, setEditingTag] = useState();
  const [editingTagVal, setEditingTagVal] = useState();
  const [newTag, setNewTag] = useState();

  const mergedTags = useMemo(() => ({ ...existingTags, ...customTags, ...(newTag ? { [newTag]: '' } : {}) }), [customTags, existingTags, newTag]);

  const onResetClick = useCallback(() => {
    onTagReset(editingTag);
    setEditingTag();
    setNewTag();
  }, [editingTag, onTagReset]);

  function onEditClick(tag) {
    if (newTag) {
      onTagChange(editingTag, editingTagVal);
      setEditingTag();
      setNewTag();
    } else if (editingTag != null) {
      if (editingTagVal !== existingTags[editingTag]) {
        onTagChange(editingTag, editingTagVal);
        setEditingTag();
      } else { // If not actually changed, no need to update
        onResetClick();
      }
    } else {
      setEditingTag(tag);
      setEditingTagVal(mergedTags[tag]);
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    onEditClick();
  }

  const onAddPress = useCallback(async () => {
    const tag = await askForMetadataKey();
    if (!tag || Object.keys(mergedTags).includes(tag)) return;
    setEditingTag(tag);
    setEditingTagVal('');
    setNewTag(tag);
  }, [mergedTags]);

  return (
    <>
      <table style={{ color: 'black' }}>
        <tbody>
          {Object.keys(mergedTags).map((tag) => {
            const editingThis = tag === editingTag;
            const Icon = editingThis ? FiCheck : FiEdit;
            const thisTagCustom = customTags[tag] != null;
            const thisTagNew = existingTags[tag] == null;

            return (
              <tr key={tag}>
                <td style={{ paddingRight: 20, color: thisTagNew ? activeColor : 'rgba(0,0,0,0.6)' }}>{tag}</td>

                <td style={{ paddingTop: 5, paddingBottom: 5 }}>
                  {editingThis ? (
                    <form style={{ display: 'inline' }} onSubmit={onSubmit}>
                      <TextInput placeholder={t('Enter value')} value={editingTagVal || ''} onChange={(e) => setEditingTagVal(e.target.value)} />
                    </form>
                  ) : (
                    <span style={{ color: thisTagCustom ? activeColor : undefined, fontWeight: thisTagCustom ? 'bold' : undefined }}>{mergedTags[tag]}</span>
                  )}
                  {(editingTag == null || editingThis) && <Icon title={t('Edit')} role="button" size={17} style={{ paddingLeft: 5, verticalAlign: 'middle', color: activeColor }} onClick={() => onEditClick(tag)} />}
                  {editingThis && <FiTrash title={t('Reset')} role="button" size={18} style={{ paddingLeft: 5, verticalAlign: 'middle' }} onClick={onResetClick} />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <Button style={{ marginTop: 10 }} iconBefore={PlusIcon} onClick={onAddPress}>Add metadata</Button>
    </>
  );
});

const EditFileDialog = memo(({ editingFile, allFilesMeta, customTagsByFile, setCustomTagsByFile }) => {
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

  return <TagEditor existingTags={existingTags} customTags={customTags} onTagChange={onTagChange} onTagReset={onTagReset} />;
});

const EditStreamDialog = memo(({ editingStream: { streamId: editingStreamId, path: editingFile }, allFilesMeta, customTagsByStreamId, setCustomTagsByStreamId, dispositionByStreamId, setDispositionByStreamId }) => {
  const { streams } = allFilesMeta[editingFile];
  const stream = useMemo(() => streams.find((s) => s.index === editingStreamId), [streams, editingStreamId]);

  const existingTags = useMemo(() => (stream && stream.tags) || {}, [stream]);
  const customTags = useMemo(() => (customTagsByStreamId[editingFile] || {})[editingStreamId] || {}, [customTagsByStreamId, editingFile, editingStreamId]);

  const customDisposition = useMemo(() => (dispositionByStreamId[editingFile] || {})[editingStreamId], [dispositionByStreamId, editingFile, editingStreamId]);
  const existingDispositionsObj = useMemo(() => (stream && stream.disposition) || {}, [stream]);
  const effectiveDisposition = useMemo(() => {
    if (customDisposition) return customDisposition;
    return getActiveDisposition(existingDispositionsObj);
  }, [customDisposition, existingDispositionsObj]);

  // console.log({ existingDispositionsObj, effectiveDisposition });

  const { t } = useTranslation();

  const onTagChange = useCallback((tag, value) => {
    setCustomTagsByStreamId((old) => ({
      ...old,
      [editingFile]: {
        ...old[editingFile],
        [editingStreamId]: {
          ...(old[editingFile] || {})[editingStreamId],
          [tag]: value,
        },
      },
    }));
  }, [editingFile, editingStreamId, setCustomTagsByStreamId]);

  const onTagReset = useCallback((tag) => {
    setCustomTagsByStreamId((old) => {
      const { [tag]: deleted, ...rest } = (old[editingFile] || {})[editingStreamId] || {};

      return {
        ...old,
        [editingFile]: {
          ...old[editingFile],
          [editingStreamId]: rest,
        },
      };
    });
  }, [editingFile, editingStreamId, setCustomTagsByStreamId]);

  const onDispositionChange = useCallback((e) => {
    let newDisposition;
    if (dispositionOptions.includes(e.target.value)) {
      newDisposition = e.target.value;
    } else if (e.target.value === deleteDispositionValue) {
      newDisposition = deleteDispositionValue; // needs a separate value (not a real disposition)
    } // else unchanged (undefined)

    setDispositionByStreamId((old) => ({
      ...old,
      [editingFile]: {
        ...old[editingFile],
        [editingStreamId]: newDisposition,
      },
    }));
  }, [editingFile, editingStreamId, setDispositionByStreamId]);

  if (!stream) return null;

  return (
    <>
      <Heading marginBottom={5}>{t('Track disposition')}</Heading>
      <Select marginBottom={20} value={effectiveDisposition || unchangedDispositionValue} onChange={onDispositionChange}>
        <option value={unchangedDispositionValue}>{t('Unchanged')}</option>
        <option value={deleteDispositionValue}>{t('Remove')}</option>

        {dispositionOptions.map((key) => (
          <option key={key} value={key}>{key}</option>
        ))}
      </Select>
      <Heading>Tags</Heading>
      <TagEditor existingTags={existingTags} customTags={customTags} onTagChange={onTagChange} onTagReset={onTagReset} />
    </>
  );
});

function onInfoClick(json, title) {
  showJson5Dialog({ title, json });
}

const Stream = memo(({ filePath, stream, onToggle, batchSetCopyStreamIds, copyStream, fileDuration, setEditingStream, onExtractStreamPress }) => {
  const { t } = useTranslation();

  const bitrate = parseInt(stream.bit_rate, 10);
  const streamDuration = parseInt(stream.duration, 10);
  const duration = !Number.isNaN(streamDuration) ? streamDuration : fileDuration;

  let Icon;
  let codecTypeHuman;
  if (stream.codec_type === 'audio') {
    Icon = copyStream ? FaVolumeUp : FaVolumeMute;
    codecTypeHuman = t('audio');
  } else if (stream.codec_type === 'video') {
    Icon = copyStream ? FaVideo : FaVideoSlash;
    codecTypeHuman = t('video');
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

  const onClick = () => onToggle && onToggle(stream.index);

  return (
    <tr style={{ opacity: copyStream ? undefined : 0.4 }}>
      <td style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>
        <IconButton title={t('Click to toggle track inclusion when exporting')} appearance="minimal" icon={<Icon color={copyStream ? '#52BD95' : '#D14343'} size={20} />} onClick={onClick} />
        <div style={{ width: 20, textAlign: 'center' }}>{stream.index}</div>
      </td>
      <td>
        {codecTypeHuman}
      </td>
      <td>{stream.codec_tag !== '0x0000' && stream.codec_tag_string}</td>
      <td style={{ maxWidth: '3em', overflow: 'hidden' }} title={stream.codec_name}>{stream.codec_name}</td>
      <td>{!Number.isNaN(duration) && `${formatDuration({ seconds: duration, shorten: true })}`}</td>
      <td>{stream.nb_frames}</td>
      <td>{!Number.isNaN(bitrate) && `${(bitrate / 1e6).toFixed(1)}MBit`}</td>
      <td style={{ maxWidth: '2.5em', overflow: 'hidden' }} title={language}>{language}</td>
      <td>{stream.width && stream.height && `${stream.width}x${stream.height}`} {stream.channels && `${stream.channels}c`} {stream.channel_layout} {streamFps && `${streamFps.toFixed(2)}fps`}</td>
      <td style={{ display: 'flex' }}>
        <IconButton icon={InfoSignIcon} onClick={() => onInfoClick(stream, t('Track info'))} appearance="minimal" iconSize={18} />
        <IconButton title={t('Extract this track as file')} icon={<FaFileExport size={18} />} onClick={onExtractStreamPress} appearance="minimal" iconSize={18} />

        <Popover
          position={Position.BOTTOM_LEFT}
          content={(
            <Menu>
              <Menu.Group>
                <Menu.Item icon={EditIcon} onClick={() => setEditingStream({ streamId: stream.index, path: filePath })}>
                  {t('Edit track metadata')}
                </Menu.Item>
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
    <div style={{ display: 'flex', marginBottom: 15, marginLeft: 5, marginRight: 5, marginTop: 5, alignItems: 'center' }}>
      <Heading title={path} style={{ wordBreak: 'break-all', marginRight: 10 }}>{path.replace(/.*\/([^/]+)$/, '$1')}</Heading>

      <div style={{ flexGrow: 1 }} />

      <IconButton icon={InfoSignIcon} onClick={() => onInfoClick(formatData, t('File info'))} appearance="minimal" iconSize={18} />
      {chapters && chapters.length > 0 && <IconButton icon={BookIcon} onClick={() => onInfoClick(chapters, t('Chapters'))} appearance="minimal" iconSize={18} />}
      {onEditClick && <IconButton icon={EditIcon} onClick={onEditClick} appearance="minimal" iconSize={18} />}
      {onTrashClick && <IconButton icon={TrashIcon} onClick={onTrashClick} appearance="minimal" iconSize={18} />}
      <IconButton icon={<FaCheckCircle color="#52BD95" size={18} />} onClick={() => setCopyAllStreams(true)} appearance="minimal" />
      <IconButton icon={<FaBan color="#D14343" size={18} />} onClick={() => setCopyAllStreams(false)} appearance="minimal" />
      {onExtractAllStreamsPress && <IconButton title={t('Export each track as individual files')} icon={<ForkIcon size={16} />} onClick={onExtractAllStreamsPress} appearance="minimal" />}
    </div>
  );
};

const Thead = () => {
  const { t } = useTranslation();
  return (
    <thead style={{ color: 'rgba(0,0,0,0.6)', textAlign: 'left' }}>
      <tr>
        <th>{t('Keep?')}</th>
        <th style={{ paddingLeft: 20 }}>{t('Type')}</th>
        <th>{t('Tag')}</th>
        <th>{t('Codec')}</th>
        <th>{t('Duration')}</th>
        <th>{t('Frames')}</th>
        <th>{t('Bitrate')}</th>
        <th>{t('Lang')}</th>
        <th>{t('Data')}</th>
        <th />
      </tr>
    </thead>
  );
};

const tableStyle = { fontSize: 14, width: '100%' };
const fileStyle = { marginBottom: 20, padding: 5, minWidth: '100%', overflowX: 'auto' };

const StreamsSelector = memo(({
  mainFilePath, mainFileFormatData, streams: mainFileStreams, mainFileChapters, isCopyingStreamId, toggleCopyStreamId,
  setCopyStreamIdsForPath, onExtractStreamPress, onExtractAllStreamsPress, allFilesMeta, externalFilesMeta, setExternalFilesMeta,
  showAddStreamSourceDialog, shortestFlag, setShortestFlag, nonCopiedExtraStreams,
  customTagsByFile, setCustomTagsByFile, customTagsByStreamId, setCustomTagsByStreamId,
  dispositionByStreamId, setDispositionByStreamId,
}) => {
  const [editingFile, setEditingFile] = useState();
  const [editingStream, setEditingStream] = useState();
  const { t } = useTranslation();

  if (!mainFileStreams) return null;

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
      <div style={{ color: 'black', padding: 10 }}>
        <Paragraph marginBottom={10}>{t('Click to select which tracks to keep when exporting:')}</Paragraph>

        <Pane elevation={1} style={fileStyle}>
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
                />
              ))}
            </tbody>
          </table>
        </Pane>

        {externalFilesEntries.map(([path, { streams, formatData }]) => (
          <Pane elevation={1} key={path} style={fileStyle}>
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
                  />
                ))}
              </tbody>
            </table>
          </Pane>
        ))}

        {externalFilesEntries.length > 0 && (
          <Alert intent="warning" appearance="card" marginBottom={5}>{t('Note: Cutting and including external tracks at the same time does not yet work. If you want to do both, it must be done as separate operations. See github issue #896.')}</Alert>
        )}

        <Button iconBefore={<FaFileImport size={16} />} onClick={showAddStreamSourceDialog}>
          {t('Include more tracks from other file')}
        </Button>

        {nonCopiedExtraStreams.length > 0 && (
          <div style={{ margin: '10px 0' }}>
            <span style={{ marginRight: 10 }}>{t('Discard or extract unprocessable tracks to separate files?')}</span>
            <AutoExportToggler />
          </div>
        )}

        {externalFilesEntries.length > 0 && (
          <div style={{ margin: '10px 0' }}>
            <span style={{ marginRight: 10 }}>{t('When tracks have different lengths, do you want to make the output file as long as the longest or the shortest track?')}</span>
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
      >
        <EditFileDialog editingFile={editingFile} allFilesMeta={allFilesMeta} customTagsByFile={customTagsByFile} setCustomTagsByFile={setCustomTagsByFile} />
      </Dialog>

      <Dialog
        title={t('Edit track {{trackNum}} metadata', { trackNum: editingStream && editingStream.streamId })}
        isShown={!!editingStream}
        hasCancel={false}
        confirmLabel={t('Done')}
        onCloseComplete={() => setEditingStream()}
      >
        <EditStreamDialog editingStream={editingStream} allFilesMeta={allFilesMeta} customTagsByStreamId={customTagsByStreamId} setCustomTagsByStreamId={setCustomTagsByStreamId} dispositionByStreamId={dispositionByStreamId} setDispositionByStreamId={setDispositionByStreamId} />
      </Dialog>
    </>
  );
});

export default StreamsSelector;
