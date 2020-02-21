import React, { memo, Fragment } from 'react';

import { FaVideo, FaVideoSlash, FaFileExport, FaFileImport, FaVolumeUp, FaVolumeMute, FaBan, FaTrashAlt, FaInfoCircle } from 'react-icons/fa';
import { GoFileBinary } from 'react-icons/go';
import { MdSubtitles } from 'react-icons/md';
import Swal from 'sweetalert2';

import withReactContent from 'sweetalert2-react-content';

const ReactSwal = withReactContent(Swal);

const { formatDuration } = require('./util');
const { getStreamFps } = require('./ffmpeg');


const Stream = memo(({ stream, onToggle, copyStream }) => {
  const bitrate = parseInt(stream.bit_rate, 10);
  const duration = parseInt(stream.duration, 10);

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

  function onInfoClick(s) {
    ReactSwal.fire({
      showCloseButton: true,
      icon: 'info',
      title: 'Stream info',
      html: <div style={{ whiteSpace: 'pre', textAlign: 'left', overflow: 'auto', maxHeight: 300, overflowY: 'scroll' }}>{JSON.stringify(s, null, 2)}</div>,
    });
  }

  const onClick = () => onToggle && onToggle(stream.index);

  return (
    <tr style={{ opacity: copyStream ? undefined : 0.4 }}>
      <td><Icon size={20} style={{ padding: '0 5px', cursor: 'pointer' }} role="button" onClick={onClick} /></td>
      <td>{stream.index}</td>
      <td>{stream.codec_type}</td>
      <td>{stream.codec_tag !== '0x0000' && stream.codec_tag_string}</td>
      <td>{stream.codec_name}</td>
      <td>{!Number.isNaN(duration) && `${formatDuration({ seconds: duration })}`}</td>
      <td>{stream.nb_frames}</td>
      <td>{!Number.isNaN(bitrate) && `${(bitrate / 1e6).toFixed(1)}MBit/s`}</td>
      <td>{stream.width && stream.height && `${stream.width}x${stream.height}`} {stream.channels && `${stream.channels}c`} {stream.channel_layout} {streamFps && `${streamFps.toFixed(1)}fps`}</td>
      <td><FaInfoCircle role="button" onClick={() => onInfoClick(stream)} size={26} /></td>
    </tr>
  );
});

const StreamsSelector = memo(({
  mainFilePath, streams: existingStreams, isCopyingStreamId, toggleCopyStreamId,
  setCopyStreamIdsForPath, onExtractAllStreamsPress, externalFiles, setExternalFiles,
  showAddStreamSourceDialog,
}) => {
  if (!existingStreams) return null;


  async function removeFile(path) {
    setCopyStreamIdsForPath(path, () => ({}));
    setExternalFiles((old) => {
      const { [path]: val, ...rest } = old;
      return rest;
    });
  }

  return (
    <div style={{ color: 'black', padding: 10 }}>
      <p>Click to select which tracks to keep when exporting:</p>

      <table style={{ marginBottom: 10 }}>
        <thead style={{ background: 'rgba(0,0,0,0.1)' }}>
          <tr>
            <th>Keep?</th>
            <th />
            <th>Type</th>
            <th>Tag</th>
            <th>Codec</th>
            <th>Duration</th>
            <th>Frames</th>
            <th>Bitrate</th>
            <th>Data</th>
            <th />
          </tr>
        </thead>

        <tbody>
          {existingStreams.map((stream) => (
            <Stream
              key={stream.index}
              stream={stream}
              copyStream={isCopyingStreamId(mainFilePath, stream.index)}
              onToggle={(streamId) => toggleCopyStreamId(mainFilePath, streamId)}
            />
          ))}

          {Object.entries(externalFiles).map(([path, { streams }]) => (
            <Fragment key={path}>
              <tr>
                <td><FaTrashAlt size={20} role="button" style={{ padding: '0 5px', cursor: 'pointer' }} onClick={() => removeFile(path)} /></td>
                <td colSpan={9} style={{ paddingTop: 15 }}>
                  {path}
                </td>
              </tr>

              {streams.map((stream) => (
                <Stream
                  key={stream.index}
                  stream={stream}
                  copyStream={isCopyingStreamId(path, stream.index)}
                  onToggle={(streamId) => toggleCopyStreamId(path, streamId)}
                />
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>

      <div style={{ cursor: 'pointer', padding: '10px 0' }} role="button" onClick={showAddStreamSourceDialog}>
        <FaFileImport size={30} style={{ verticalAlign: 'middle', marginRight: 5 }} /> Include tracks from other file
      </div>

      {Object.keys(externalFiles).length === 0 && (
        <div style={{ cursor: 'pointer', padding: '10px 0' }} role="button" onClick={onExtractAllStreamsPress}>
          <FaFileExport size={30} style={{ verticalAlign: 'middle', marginRight: 5 }} /> Export each track as individual files
        </div>
      )}
    </div>
  );
});

export default StreamsSelector;
