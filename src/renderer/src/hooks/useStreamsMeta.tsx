import { useCallback, useMemo, useState } from 'react';
import pMap from 'p-map';
import invariant from 'tiny-invariant';
import { Trans, useTranslation } from 'react-i18next';

import { isStreamThumbnail, shouldCopyStreamByDefault } from '../util/streams';
import StreamsSelector from '../StreamsSelector';
import { FFprobeStream } from '../../../common/ffprobe';
import { FilesMeta } from '../types';
import safeishEval from '../worker/eval';
import i18n from '../i18n';
import Action from '../components/Action';
import ExpressionDialog from '../components/ExpressionDialog';
import { ShowGenericDialog } from '../components/GenericDialog';


export default function useStreamsMeta({ mainStreams, externalFilesMeta, filePath, autoExportExtraStreams, showGenericDialog }: {
  mainStreams: FFprobeStream[],
  externalFilesMeta: FilesMeta,
  filePath: string | undefined,
  autoExportExtraStreams: boolean,
  showGenericDialog: ShowGenericDialog,
}) {
  const { t } = useTranslation();

  const [copyStreamIdsByFile, setCopyStreamIdsByFile] = useState<Record<string, Record<string, boolean>>>({});
  // this will be remembered between files:
  const [enabledStreamsFilter, setEnabledStreamsFilter] = useState<string>();

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

  const toggleCopyStreamIdsInternal = useCallback((path: string, streams: FFprobeStream[]) => {
    setCopyStreamIdsForPath(path, (old) => {
      const ret = { ...old };
      // eslint-disable-next-line unicorn/no-array-callback-reference
      streams.forEach(({ index }) => {
        ret[index] = !ret[index];
      });
      return ret;
    });
  }, [setCopyStreamIdsForPath]);

  const toggleCopyStreamIds = useCallback((path: string, filter: (a: FFprobeStream) => boolean) => {
    const streams = path === filePath ? mainStreams : externalFilesMeta[path]?.streams;
    if (!streams) return;
    toggleCopyStreamIdsInternal(path, streams.filter((stream) => filter(stream)));
  }, [externalFilesMeta, filePath, mainStreams, toggleCopyStreamIdsInternal]);

  const filterEnabledStreams = useCallback(async (expr: string) => (await pMap(mainStreams, async (stream) => (
    (await safeishEval(expr, { track: stream })) === true ? [stream] : []
  ), { concurrency: 5 })).flat(), [mainStreams]);

  const applyEnabledStreamsFilter = useCallback(async (expr = enabledStreamsFilter) => {
    if (expr == null) return;
    invariant(filePath != null);

    const filteredStreams = await filterEnabledStreams(expr);

    toggleCopyStreamIdsInternal(filePath, filteredStreams);
  }, [enabledStreamsFilter, filePath, filterEnabledStreams, toggleCopyStreamIdsInternal]);

  const changeEnabledStreamsFilter = useCallback(async () => {
    invariant(filePath != null);

    const isEmpty = (v: string) => v.trim().length === 0;

    showGenericDialog({
      isAlert: true,
      content: (
        <ExpressionDialog
          confirmButtonText={t('Apply filter')}
          onSubmit={async (value: string) => {
            try {
              if (isEmpty(value)) return undefined;
              const streams = await filterEnabledStreams(value);
              if (streams.length === 0) return { error: i18n.t('No tracks match this expression.') };

              if (isEmpty(value)) {
                // allow user to reset filter
                setEnabledStreamsFilter(undefined);
                return undefined;
              }

              setEnabledStreamsFilter(value);

              await applyEnabledStreamsFilter(value);
              return undefined;
            } catch (err) {
              if (err instanceof Error) {
                return { error: i18n.t('Expression failed: {{errorMessage}}', { errorMessage: err.message }) };
              }
              throw err;
            }
          }}
          examples={[
            { name: i18n.t('Audio tracks'), code: "track.codec_type === 'audio'" },
            { name: i18n.t('Video tracks'), code: "track.codec_type === 'video'" },
            { name: i18n.t('English language tracks'), code: "track.tags?.language === 'eng'" },
            { name: i18n.t('Tracks with at least 720p video'), code: 'track.height >= 720' },
            { name: i18n.t('Tracks with H264 codec'), code: "track.codec_name === 'h264'" },
            { name: i18n.t('1st, 2nd and 3rd track'), code: 'track.index >= 0 && track.index <= 2' },
          ]}
          title={i18n.t('Toggle tracks by expression')}
          description={<Trans>Enter a JavaScript filter expression which will be evaluated for each track of the current file. Tracks for which the expression evaluates to &quot;true&quot; will be selected or deselected. You may also the <Action name="toggleStripCurrentFilter" /> keyboard action to run this filter.</Trans>}
          inputValue={enabledStreamsFilter ?? ''}
        />
      ),
    });
  }, [applyEnabledStreamsFilter, enabledStreamsFilter, filePath, filterEnabledStreams, showGenericDialog, t]);

  const toggleStripCodecType = useCallback((codecType: FFprobeStream['codec_type']) => toggleCopyStreamIds(filePath!, (stream) => stream.codec_type === codecType), [filePath, toggleCopyStreamIds]);
  const toggleStripAudio = useCallback(() => toggleStripCodecType('audio'), [toggleStripCodecType]);
  const toggleStripVideo = useCallback(() => toggleStripCodecType('video'), [toggleStripCodecType]);
  const toggleStripSubtitle = useCallback(() => toggleStripCodecType('subtitle'), [toggleStripCodecType]);
  const toggleStripThumbnail = useCallback(() => toggleCopyStreamIds(filePath!, isStreamThumbnail), [filePath, toggleCopyStreamIds]);
  const toggleCopyAllStreamsForPath = useCallback((path: string) => toggleCopyStreamIds(path, () => true), [toggleCopyStreamIds]);
  const toggleStripAll = useCallback(() => toggleCopyAllStreamsForPath(filePath!), [filePath, toggleCopyAllStreamsForPath]);

  const toggleCopyStreamId = useCallback((path: string, index: number) => {
    setCopyStreamIdsForPath(path, (old) => ({ ...old, [index]: !old[index] }));
  }, [setCopyStreamIdsForPath]);

  return { nonCopiedExtraStreams, exportExtraStreams, mainCopiedThumbnailStreams, numStreamsToCopy, toggleStripAudio, toggleStripVideo, toggleStripSubtitle, toggleStripThumbnail, toggleStripAll, copyStreamIdsByFile, setCopyStreamIdsByFile, copyFileStreams, mainCopiedStreams, setCopyStreamIdsForPath, toggleCopyStreamId, isCopyingStreamId, toggleCopyStreamIds, changeEnabledStreamsFilter, applyEnabledStreamsFilter, enabledStreamsFilter, toggleCopyAllStreamsForPath };
}
