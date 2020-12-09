import React, { memo } from 'react';

import { FaVideo, FaVideoSlash, FaFileExport, FaFileImport, FaVolumeUp, FaVolumeMute, FaBan, FaTrashAlt, FaInfoCircle } from 'react-icons/fa';
import { GoFileBinary } from 'react-icons/go';
import { MdSubtitles } from 'react-icons/md';
import Swal from 'sweetalert2';
import { SegmentedControl } from 'evergreen-ui';
import withReactContent from 'sweetalert2-react-content';
import { useTranslation } from 'react-i18next';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { tomorrow as style } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import JSON5 from 'json5';

import { formatDuration } from './util';
import { getStreamFps } from './ffmpeg';

const ReactSwal = withReactContent(Swal);


function onInfoClick(s, title) {
  const html = (
    <SyntaxHighlighter language="javascript" style={style} customStyle={{ textAlign: 'left', maxHeight: 300, overflowY: 'auto', fontSize: 14 }}>
      {JSON5.stringify(s, null, 2)}
    </SyntaxHighlighter>
  );

  ReactSwal.fire({
    showCloseButton: true,
    title,
    html,
  });
}

const Stream = memo(({ stream, onToggle, copyStream, fileDuration }) => {
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
      <td>
        {stream.index}
        <Icon size={20} style={{ padding: '0px 5px 0px 10px', cursor: 'pointer', verticalAlign: 'bottom' }} role="button" onClick={onClick} />
      </td>
      <td>{stream.codec_type}</td>
      <td>{stream.codec_tag !== '0x0000' && stream.codec_tag_string}</td>
      <td>{stream.codec_name}</td>
      <td>{!Number.isNaN(duration) && `${formatDuration({ seconds: duration })}`}</td>
      <td>{stream.nb_frames}</td>
      <td>{!Number.isNaN(bitrate) && `${(bitrate / 1e6).toFixed(1)}MBit/s`}</td>
      <td style={{ maxWidth: '2.5em', overflow: 'hidden' }}>{language}</td>
      <td>{stream.width && stream.height && `${stream.width}x${stream.height}`} {stream.channels && `${stream.channels}c`} {stream.channel_layout} {streamFps && `${streamFps.toFixed(2)}fps`}</td>
      <td><FaInfoCircle role="button" onClick={() => onInfoClick(stream, t('Stream info'))} size={22} /></td>
    </tr>
  );
});

const FileHeading = ({ path, formatData, onTrashClick }) => {
  const { t } = useTranslation();

  return (
    <div style={{ display: 'flex', marginBottom: 10, alignItems: 'center' }}>
      <div title={path} style={{ wordBreak: 'break-all', fontWeight: 'bold' }}>{path.replace(/.*\/([^/]+)$/, '$1')}</div>
      <FaInfoCircle role="button" onClick={() => onInfoClick(formatData, t('File info'))} size={20} style={{ padding: '0 5px 0 10px' }} />
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
  mainFilePath, mainFileFormatData, streams: existingStreams, isCopyingStreamId, toggleCopyStreamId,
  setCopyStreamIdsForPath, onExtractAllStreamsPress, externalFiles, setExternalFiles,
  showAddStreamSourceDialog, shortestFlag, setShortestFlag, nonCopiedExtraStreams,
  AutoExportToggler,
}) => {
  const { t } = useTranslation();

  if (!existingStreams) return null;

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
    <div style={{ color: 'black', padding: 10 }}>
      <p>{t('Click to select which tracks to keep when exporting:')}</p>

      <div style={fileStyle}>
        <FileHeading path={mainFilePath} formatData={mainFileFormatData} />
        <table style={tableStyle}>
          <Thead />
          <tbody>
            {existingStreams.map((stream) => (
              <Stream
                key={stream.index}
                stream={stream}
                copyStream={isCopyingStreamId(mainFilePath, stream.index)}
                onToggle={(streamId) => toggleCopyStreamId(mainFilePath, streamId)}
                fileDuration={getFormatDuration(mainFileFormatData)}
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
                  stream={stream}
                  copyStream={isCopyingStreamId(path, stream.index)}
                  onToggle={(streamId) => toggleCopyStreamId(path, streamId)}
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
  );
});

export default StreamsSelector;
