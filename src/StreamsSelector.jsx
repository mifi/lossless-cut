import React, { memo } from 'react';

import { FaVideo, FaVideoSlash, FaFileExport, FaVolumeUp, FaVolumeMute, FaBan } from 'react-icons/fa';
import { GoFileBinary } from 'react-icons/go';
import { MdSubtitles } from 'react-icons/md';

const { formatDuration } = require('./util');
const { getStreamFps } = require('./ffmpeg');


const StreamsSelector = memo(({
  streams, copyStreamIds, toggleCopyStreamId, onExtractAllStreamsPress,
}) => {
  if (!streams) return null;

  return (
    <div style={{ color: 'black', padding: 10 }}>
      <p>Click to select which tracks to keep:</p>

      <table>
        <thead style={{ background: 'rgba(0,0,0,0.1)' }}>
          <tr>
            <td />
            <td />
            <td>Type</td>
            <td>Tag</td>
            <td>Codec</td>
            <td>Duration</td>
            <td>Frames</td>
            <td>Bitrate</td>
            <td>Data</td>
          </tr>
        </thead>
        <tbody>
          {streams.map((stream) => {
            const bitrate = parseInt(stream.bit_rate, 10);
            const duration = parseInt(stream.duration, 10);

            function onToggle() {
              toggleCopyStreamId(stream.index);
            }

            const copyStream = copyStreamIds[stream.index];

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

            return (
              <tr key={stream.index} style={{ opacity: copyStream ? undefined : 0.4 }} onClick={onToggle}>
                <td><Icon size={20} style={{ padding: '0 5px', cursor: 'pointer' }} /></td>
                <td>{stream.index}</td>
                <td>{stream.codec_type}</td>
                <td>{stream.codec_tag !== '0x0000' && stream.codec_tag_string}</td>
                <td>{stream.codec_name}</td>
                <td>{!Number.isNaN(duration) && `${formatDuration({ seconds: duration })}`}</td>
                <td>{stream.nb_frames}</td>
                <td>{!Number.isNaN(bitrate) && `${(bitrate / 1e6).toFixed(1)}MBit/s`}</td>
                <td>{stream.width && stream.height && `${stream.width}x${stream.height}`} {stream.channels && `${stream.channels}c`} {stream.channel_layout} {streamFps && `${streamFps.toFixed(1)}fps`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ cursor: 'pointer', padding: 20 }} role="button" onClick={onExtractAllStreamsPress}>
        <FaFileExport size={30} style={{ verticalAlign: 'middle' }} /> Export each track as individual files
      </div>
    </div>
  );
});

export default StreamsSelector;
