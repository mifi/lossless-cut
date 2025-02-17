import { useCallback, useMemo, useState } from 'react';
import invariant from 'tiny-invariant';

import { isStreamThumbnail, shouldCopyStreamByDefault } from '../util/streams';
import StreamsSelector from '../StreamsSelector';
import { FFprobeStream } from '../../../../ffprobe';


export default ({ mainStreams, filePath, autoExportExtraStreams }: {
  mainStreams: FFprobeStream[],
  filePath: string | undefined,
  autoExportExtraStreams: boolean,
}) => {
  const [copyStreamIdsByFile, setCopyStreamIdsByFile] = useState<Record<string, Record<string, boolean>>>({});

  const isCopyingStreamId = useCallback((path: string | undefined, streamId: number) => (
    !!((path != null && copyStreamIdsByFile[path]) || {})[streamId]
  ), [copyStreamIdsByFile]);

  const mainCopiedStreams = useMemo(() => mainStreams.filter((stream) => isCopyingStreamId(filePath, stream.index)), [filePath, isCopyingStreamId, mainStreams]);
  const mainCopiedThumbnailStreams = useMemo(() => mainCopiedStreams.filter((stream) => isStreamThumbnail(stream)), [mainCopiedStreams]);

  // Streams that are not copy enabled by default
  const extraStreams = useMemo(() => mainStreams.filter((stream) => !shouldCopyStreamByDefault(stream)), [mainStreams]);

  // Extra streams that the user has not selected for copy
  const nonCopiedExtraStreams = useMemo(() => extraStreams.filter((stream) => !isCopyingStreamId(filePath, stream.index)), [extraStreams, filePath, isCopyingStreamId]);

  const exportExtraStreams = autoExportExtraStreams && nonCopiedExtraStreams.length > 0;

  const copyFileStreams = useMemo(() => Object.entries(copyStreamIdsByFile).map(([path, streamIdsMap]) => ({
    path,
    streamIds: Object.entries(streamIdsMap).filter(([, shouldCopy]) => shouldCopy).map(([streamIdStr]) => parseInt(streamIdStr, 10)),
  })), [copyStreamIdsByFile]);

  // total number of streams to copy for ALL files
  const numStreamsToCopy = useMemo(() => copyFileStreams.reduce((acc, { streamIds }) => acc + streamIds.length, 0), [copyFileStreams]);

  const setCopyStreamIdsForPath = useCallback<Parameters<typeof StreamsSelector>[0]['setCopyStreamIdsForPath']>((path, cb) => {
    setCopyStreamIdsByFile((old) => {
      const oldIds = old[path] || {};
      return ({ ...old, [path]: cb(oldIds) });
    });
  }, []);

  const checkCopyingAnyTrackOfType = useCallback((filter: (s: FFprobeStream) => boolean) => mainStreams.some((stream) => isCopyingStreamId(filePath, stream.index) && filter(stream)), [filePath, isCopyingStreamId, mainStreams]);

  const toggleStripStream = useCallback((filter: (s: FFprobeStream) => boolean) => {
    const copyingAnyTrackOfType = checkCopyingAnyTrackOfType(filter);
    invariant(filePath != null);
    setCopyStreamIdsForPath(filePath, (old) => {
      const newCopyStreamIds = { ...old };
      mainStreams.forEach((stream) => {
        if (filter(stream)) newCopyStreamIds[stream.index] = !copyingAnyTrackOfType;
      });
      return newCopyStreamIds;
    });
  }, [checkCopyingAnyTrackOfType, filePath, mainStreams, setCopyStreamIdsForPath]);

  const toggleStripAudio = useCallback(() => toggleStripStream((stream) => stream.codec_type === 'audio'), [toggleStripStream]);
  const toggleStripThumbnail = useCallback(() => toggleStripStream(isStreamThumbnail), [toggleStripStream]);

  const copyAnyAudioTrack = useMemo(() => checkCopyingAnyTrackOfType((stream) => stream.codec_type === 'audio'), [checkCopyingAnyTrackOfType]);

  const toggleCopyStreamId = useCallback((path: string, index: number) => {
    setCopyStreamIdsForPath(path, (old) => ({ ...old, [index]: !old[index] }));
  }, [setCopyStreamIdsForPath]);

  return { nonCopiedExtraStreams, exportExtraStreams, mainCopiedThumbnailStreams, numStreamsToCopy, toggleStripAudio, toggleStripThumbnail, copyAnyAudioTrack, copyStreamIdsByFile, setCopyStreamIdsByFile, copyFileStreams, mainCopiedStreams, setCopyStreamIdsForPath, toggleCopyStreamId, isCopyingStreamId };
};
