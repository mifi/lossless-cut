import { useEffect, useMemo, useRef, useState } from 'react';
import useDebounceOld from 'react-use/lib/useDebounce'; // Want to phase out this
import invariant from 'tiny-invariant';
import sortBy from 'lodash/sortBy';

import { renderThumbnails as ffmpegRenderThumbnails } from '../ffmpeg';
import { Thumbnail } from '../types';
import { isDurationValid } from '../segments';


export default ({ filePath, zoomedDuration, zoomWindowStartTime, showThumbnails }: {
  filePath: string | undefined,
  zoomedDuration: number | undefined,
  zoomWindowStartTime: number,
  showThumbnails: boolean,
}) => {
  const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]);
  const thumnailsRef = useRef<Thumbnail[]>([]);
  const thumnailsRenderingPromiseRef = useRef<Promise<void>>();

  function addThumbnail(thumbnail) {
    // console.log('Rendered thumbnail', thumbnail.url);
    setThumbnails((v) => [...v, thumbnail]);
  }

  const [, cancelRenderThumbnails] = useDebounceOld(() => {
    async function renderThumbnails() {
      if (!showThumbnails || thumnailsRenderingPromiseRef.current) return;

      try {
        setThumbnails([]);
        invariant(filePath != null);
        invariant(zoomedDuration != null);
        const promise = ffmpegRenderThumbnails({ filePath, from: zoomWindowStartTime, duration: zoomedDuration, onThumbnail: addThumbnail });
        thumnailsRenderingPromiseRef.current = promise;
        await promise;
      } catch (err) {
        console.error('Failed to render thumbnail', err);
      } finally {
        thumnailsRenderingPromiseRef.current = undefined;
      }
    }

    if (isDurationValid(zoomedDuration)) renderThumbnails();
  }, 500, [zoomedDuration, filePath, zoomWindowStartTime, showThumbnails]);

  // Cleanup removed thumbnails
  useEffect(() => {
    thumnailsRef.current.forEach((thumbnail) => {
      if (!thumbnails.some((nextThumbnail) => nextThumbnail.url === thumbnail.url)) {
        console.log('Cleanup thumbnail', thumbnail.time);
        URL.revokeObjectURL(thumbnail.url);
      }
    });
    thumnailsRef.current = thumbnails;
  }, [thumbnails]);

  const thumbnailsSorted = useMemo(() => sortBy(thumbnails, (thumbnail) => thumbnail.time), [thumbnails]);

  return {
    thumbnailsSorted,
    setThumbnails,
    cancelRenderThumbnails,
  };
};
