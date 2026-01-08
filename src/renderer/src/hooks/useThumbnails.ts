import { useEffect, useMemo, useState } from 'react';
import { useDebounce } from 'use-debounce';
import invariant from 'tiny-invariant';
import sortBy from 'lodash/sortBy';

import { renderThumbnails as ffmpegRenderThumbnails } from '../ffmpeg';
import type { Thumbnail } from '../types';
import { isDurationValid } from '../segments';
import { isExecaError } from '../util';


export default ({ filePath, zoomedDuration, zoomWindowStartTime, showThumbnails }: {
  filePath: string | undefined,
  zoomedDuration: number | undefined,
  zoomWindowStartTime: number,
  showThumbnails: boolean,
}) => {
  const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]);

  const [debounced] = useDebounce({ zoomedDuration, filePath, zoomWindowStartTime, showThumbnails }, 300, {
    equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  });

  useEffect(() => {
    const abortController = new AbortController();
    const thumbnails2: Thumbnail[] = [];

    (async () => {
      if (!isDurationValid(debounced.zoomedDuration) || !debounced.showThumbnails) return;

      try {
        invariant(debounced.filePath != null);
        invariant(debounced.zoomedDuration != null);

        const addThumbnail = (t: Thumbnail) => {
          if (abortController.signal.aborted) return; // because the bridge is async
          thumbnails2.push(t);
          setThumbnails((v) => [...v, t]);
        };

        await ffmpegRenderThumbnails({ signal: abortController.signal, filePath: debounced.filePath, from: debounced.zoomWindowStartTime, duration: debounced.zoomedDuration, onThumbnail: addThumbnail });
      } catch (err) {
        if ((err as Error).name !== 'AbortError' && !(isExecaError(err) && err.isCanceled)) {
          console.error('Failed to render thumbnails', err);
        }
      }
    })();

    return () => {
      abortController.abort();
      if (thumbnails2.length > 0) console.log('Cleanup thumbnails', thumbnails2.map((t) => t.time));
      thumbnails2.forEach((thumbnail) => URL.revokeObjectURL(thumbnail.url));
      setThumbnails([]);
    };
  }, [debounced]);

  const thumbnailsSorted = useMemo(() => sortBy(thumbnails, (thumbnail) => thumbnail.time), [thumbnails]);

  return {
    thumbnailsSorted,
    setThumbnails,
  };
};
