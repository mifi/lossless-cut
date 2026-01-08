import { useCallback, useEffect, useRef, useState } from 'react';
import { extractSubtitleTrackVtt } from '../ffmpeg';
import type { FFprobeStream } from '../../../common/ffprobe';


export default () => {
  const [subtitlesByStreamId, setSubtitlesByStreamId] = useState<Record<string, { url: string, lang?: string }>>({});

  const loadSubtitle = useCallback(async ({ filePath, index, subtitleStream }: { filePath: string, index: number, subtitleStream: FFprobeStream }) => {
    const url = await extractSubtitleTrackVtt(filePath, index);
    setSubtitlesByStreamId((old) => ({ ...old, [index]: { url, lang: subtitleStream.tags && subtitleStream.tags.language } }));
  }, []);

  // Cleanup removed subtitles
  const subtitlesByStreamIdRef = useRef<typeof subtitlesByStreamId>({});
  useEffect(() => {
    Object.values(subtitlesByStreamIdRef.current).forEach(({ url, lang }) => {
      if (!Object.values(subtitlesByStreamId).some((existingSubtitle) => existingSubtitle.url === url)) {
        console.log('Cleanup subtitle', lang);
        URL.revokeObjectURL(url);
      }
    });
    subtitlesByStreamIdRef.current = subtitlesByStreamId;
  }, [subtitlesByStreamId]);

  return {
    loadSubtitle,
    subtitlesByStreamId,
    setSubtitlesByStreamId,
  };
};
