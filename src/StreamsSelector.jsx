import React, { memo, useState } from 'react';

import { FaVideo, FaVideoSlash, FaFileExport, FaFileImport, FaVolumeUp, FaVolumeMute, FaBan, FaTrashAlt, FaInfoCircle } from 'react-icons/fa';
import { GoFileBinary } from 'react-icons/go';
import { FiEdit, FiCheck, FiTrash } from 'react-icons/fi';
import { MdSubtitles } from 'react-icons/md';
import { SegmentedControl, Dialog, Button } from 'evergreen-ui';
import { useTranslation } from 'react-i18next';

import { askForMetadataKey, showJson5Dialog } from './dialogs';
import { formatDuration } from './util/duration';
import { getStreamFps } from './ffmpeg';


const activeColor = '#9f5f80';

const TagEditor = memo(({ existingTags, customTags, onTagChange, onTagReset }) => {
  const { t } = useTranslation();

  const [editingTag, setEditingTag] = useState();
  const [editingTagVal, setEditingTagVal] = useState();
  const [newTag, setNewTag] = useState();

  const mergedTags = { ...existingTags, ...customTags, ...(newTag ? { [newTag]: '' } : {}) };

  function onResetClick() {
    onTagReset(editingTag);
    setEditingTag();
    setNewTag();
  }

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

  async function onAddPress() {
    const tag = await askForMetadataKey();
    if (!tag || Object.keys(mergedTags).includes(tag)) return;
    setEditingTag(tag);
    setEditingTagVal('');
    setNewTag(tag);
  }

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
                    <form style={{ display: 'inline' }} onSubmit={onSubmit}><input placeholder={t('Enter value')} style={{ fontSize: 'inherit', borderRadius: 2, border: '1px solid black' }} value={editingTagVal || ''} type="text" onChange={(e) => setEditingTagVal(e.target.value)} /></form>
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

      <Button style={{ marginTop: 10 }} iconBefore="plus" onClick={onAddPress}>Add metadata</Button>
    </>
  );
});

const EditFileDialog = memo(({ editingFile, externalFiles, mainFileFormatData, mainFilePath, customTagsByFile, setCustomTagsByFile }) => {
  const formatData = editingFile === mainFilePath ? mainFileFormatData : externalFiles[editingFile].formatData;
  const existingTags = formatData.tags;
  const customTags = customTagsByFile[editingFile] || {};

  function onTagChange(tag, value) {
    setCustomTagsByFile((old) => ({ ...old, [editingFile]: { ...old[editingFile], [tag]: value } }));
  }

  function onTagReset(tag) {
    setCustomTagsByFile((old) => {
      const { [tag]: deleted, ...rest } = old[editingFile] || {};
      return { ...old, [editingFile]: rest };
    });
  }

  return <TagEditor existingTags={existingTags} customTags={customTags} onTagChange={onTagChange} onTagReset={onTagReset} />;
});

const EditStreamDialog = memo(({ editingStream: { streamId: editingStreamId, path: editingFile }, externalFiles, mainFilePath, mainFileStreams, customTagsByStreamId, setCustomTagsByStreamId }) => {
  const streams = editingFile === mainFilePath ? mainFileStreams : externalFiles[editingFile].streams;
  const stream = streams.find((s) => s.index === editingStreamId);
  if (!stream) return null;

  const existingTags = stream.tags;
  const customTags = (customTagsByStreamId[editingFile] || {})[editingStreamId] || {};

  // This is deep!
  function onTagChange(tag, value) {
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
  }

  function onTagReset(tag) {
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
  }

  return <TagEditor existingTags={existingTags} customTags={customTags} onTagChange={onTagChange} onTagReset={onTagReset} />;
});

function onInfoClick(json, title) {
  showJson5Dialog({ title, json });
}

const Stream = memo(({ filePath, stream, onToggle, copyStream, fileDuration, setEditingStream, onExtractStreamPress }) => {
  const { t } = useTranslation();

  const bitrate = parseInt(stream.bit_rate, 10);
  const streamDuration = parseInt(stream.duration, 10);
  const duration = !Number.isNaN(streamDuration) ? streamDuration : fileDuration;

  let Icon;
  if (stream.codec_type === 'audio') {
    Icon = copyStream ? FaVolumeUp : FaVolumeMute;
  } else if (stream.codec_type === 'video') {
    Icon = copyStream ? FaVideo : FaVideoSlash;
  } else if (stream.codec_type === 'subtitle') {
    Icon = copyStream ? MdSubtitles : FaBan;
  } else {
    Icon = copyStream ? GoFileBinary : FaBan;
  }

  const streamFps = getStreamFps(stream);
  const language = stream.tags && stream.tags.language;

  const onClick = () => onToggle && onToggle(stream.index);

  return (
    <tr style={{ opacity: copyStream ? undefined : 0.4 }}>
      <td style={{ whiteSpace: 'nowrap' }} title={t('Click to toggle track inclusion when exporting')}>
        {stream.index}
        <Icon size={20} style={{ padding: '0px 5px 0px 10px', cursor: 'pointer', verticalAlign: 'bottom' }} role="button" onClick={onClick} />
      </td>
      <td>{stream.codec_type}</td>
      <td>{stream.codec_tag !== '0x0000' && stream.codec_tag_string}</td>
      <td style={{ maxWidth: '3em', overflow: 'hidden' }} title={stream.codec_name}>{stream.codec_name}</td>
      <td>{!Number.isNaN(duration) && `${formatDuration({ seconds: duration, shorten: true })}`}</td>
      <td>{stream.nb_frames}</td>
      <td>{!Number.isNaN(bitrate) && `${(bitrate / 1e6).toFixed(1)}MBit`}</td>
      <td style={{ maxWidth: '2.5em', overflow: 'hidden' }} title={language}>{language}</td>
      <td>{stream.width && stream.height && `${stream.width}x${stream.height}`} {stream.channels && `${stream.channels}c`} {stream.channel_layout} {streamFps && `${streamFps.toFixed(2)}fps`}</td>
      <td>
        <FaInfoCircle role="button" onClick={() => onInfoClick(stream, t('Track info'))} size={22} />
        <FiEdit title={t('Edit track metadata')} role="button" size={20} style={{ padding: '0 5px' }} onClick={() => setEditingStream({ streamId: stream.index, path: filePath })} />
        <FaFileExport title={t('Extract this track as file')} role="button" onClick={onExtractStreamPress} size={18} />
      </td>
    </tr>
  );
});

const FileHeading = ({ path, formatData, onTrashClick, onEditClick }) => {
  const { t } = useTranslation();

  return (
    <div style={{ display: 'flex', marginBottom: 10, alignItems: 'center' }}>
      <div title={path} style={{ wordBreak: 'break-all', fontWeight: 'bold' }}>{path.replace(/.*\/([^/]+)$/, '$1')}</div>
      <FaInfoCircle role="button" onClick={() => onInfoClick(formatData, t('File info'))} size={20} style={{ padding: '0 5px 0 10px' }} />
      {onEditClick && <FiEdit title={t('Edit file metadata')} role="button" size={20} style={{ padding: '0 5px' }} onClick={onEditClick} />}
      {onTrashClick && <FaTrashAlt size={20} role="button" style={{ padding: '0 5px', cursor: 'pointer' }} onClick={onTrashClick} />}
    </div>
  );
};

const Thead = () => {
  const { t } = useTranslation();
  return (
    <thead>
      <tr>
        <th>{t('Keep?')}</th>
        <th>{t('Type')}</th>
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
const fileStyle = { marginBottom: 10, backgroundColor: 'rgba(0,0,0,0.04)', padding: 5, borderRadius: 7 };

const StreamsSelector = memo(({
  mainFilePath, mainFileFormatData, streams: mainFileStreams, isCopyingStreamId, toggleCopyStreamId,
  setCopyStreamIdsForPath, onExtractStreamPress, onExtractAllStreamsPress, externalFiles, setExternalFiles,
  showAddStreamSourceDialog, shortestFlag, setShortestFlag, nonCopiedExtraStreams,
  AutoExportToggler, customTagsByFile, setCustomTagsByFile, customTagsByStreamId, setCustomTagsByStreamId,
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
    setExternalFiles((old) => {
      const { [path]: val, ...rest } = old;
      return rest;
    });
  }

  const externalFilesEntries = Object.entries(externalFiles);

  return (
    <>
      <div style={{ color: 'black', padding: 10 }}>
        <p>{t('Click to select which tracks to keep when exporting:')}</p>

        <div style={fileStyle}>
          {/* We only support editing main file metadata for now */}
          <FileHeading path={mainFilePath} formatData={mainFileFormatData} onEditClick={() => setEditingFile(mainFilePath)} />
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
                  setEditingStream={setEditingStream}
                  fileDuration={getFormatDuration(mainFileFormatData)}
                  onExtractStreamPress={() => onExtractStreamPress(stream.index)}
                />
              ))}
            </tbody>
          </table>
        </div>

        {externalFilesEntries.map(([path, { streams, formatData }]) => (
          <div key={path} style={fileStyle}>
            <FileHeading path={path} formatData={formatData} onTrashClick={() => removeFile(path)} />
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
                    setEditingStream={setEditingStream}
                    fileDuration={getFormatDuration(formatData)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {externalFilesEntries.length > 0 && (
          <div style={{ margin: '10px 0' }}>
            <div>
              {t('When tracks have different lengths, do you want to make the output file as long as the longest or the shortest track?')}
            </div>
            <SegmentedControl
              options={[{ label: t('Longest'), value: 'longest' }, { label: t('Shortest'), value: 'shortest' }]}
              value={shortestFlag ? 'shortest' : 'longest'}
              onChange={value => setShortestFlag(value === 'shortest')}
            />
          </div>
        )}

        <div style={{ cursor: 'pointer', padding: '10px 0' }} role="button" onClick={showAddStreamSourceDialog}>
          <FaFileImport size={30} style={{ verticalAlign: 'middle', marginRight: 5 }} /> {t('Include more tracks from other file')}
        </div>

        {nonCopiedExtraStreams.length > 0 && (
          <div style={{ margin: '10px 0' }}>
            {t('Discard or extract unprocessable tracks to separate files?')}
            <AutoExportToggler />
          </div>
        )}

        {externalFilesEntries.length === 0 && (
          <div style={{ cursor: 'pointer', padding: '10px 0' }} role="button" onClick={onExtractAllStreamsPress}>
            <FaFileExport size={30} style={{ verticalAlign: 'middle', marginRight: 5 }} /> {t('Export each track as individual files')}
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
        <EditFileDialog editingFile={editingFile} externalFiles={externalFiles} mainFileFormatData={mainFileFormatData} mainFilePath={mainFilePath} customTagsByFile={customTagsByFile} setCustomTagsByFile={setCustomTagsByFile} />
      </Dialog>

      <Dialog
        title={t('Edit track {{trackNum}} metadata', { trackNum: editingStream && editingStream.streamId })}
        isShown={!!editingStream}
        hasCancel={false}
        confirmLabel={t('Done')}
        onCloseComplete={() => setEditingStream()}
      >
        <EditStreamDialog editingStream={editingStream} externalFiles={externalFiles} mainFilePath={mainFilePath} mainFileStreams={mainFileStreams} customTagsByStreamId={customTagsByStreamId} setCustomTagsByStreamId={setCustomTagsByStreamId} />
      </Dialog>
    </>
  );
});

export default StreamsSelector;
