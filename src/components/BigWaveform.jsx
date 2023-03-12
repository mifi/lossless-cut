import React, { Fragment, memo, useEffect, useState, useCallback, useRef } from 'react';
import { ffmpegExtractWindow } from '../util/constants';


const BigWaveform = memo(({ waveforms, relevantTime, playing, durationSafe, zoom, seekRel }) => {
  const windowSize = ffmpegExtractWindow * 2;
  const windowStart = Math.max(0, relevantTime - windowSize);
  const windowEnd = relevantTime + windowSize;
  const filtered = waveforms.filter((waveform) => waveform.from >= windowStart && waveform.to <= windowEnd);

  const scaleFactor = zoom;

  const [smoothTime, setSmoothTime] = useState(relevantTime);

  const mouseDownRef = useRef();
  const containerRef = useRef();

  const getRect = useCallback(() => containerRef.current.getBoundingClientRect(), []);

  const handleMouseDown = useCallback((e) => {
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;

    mouseDownRef.current = { relevantTime, x };
    e.preventDefault();
  }, [relevantTime]);

  const scaleToTime = useCallback((v) => (((v) / getRect().width) * windowSize) / zoom, [getRect, windowSize, zoom]);

  const handleMouseMove = useCallback((e) => {
    if (mouseDownRef.current == null) return;

    seekRel(-scaleToTime(e.movementX));

    e.preventDefault();
  }, [scaleToTime, seekRel]);

  const handleWheel = useCallback((e) => {
    seekRel(scaleToTime(e.deltaX));
  }, [scaleToTime, seekRel]);

  const handleMouseUp = useCallback((e) => {
    if (!mouseDownRef.current) return;
    mouseDownRef.current = undefined;
    e.preventDefault();
  }, []);


  useEffect(() => {
    let time = relevantTime;
    setSmoothTime(time);
    const startTime = new Date().getTime();

    if (playing) {
      let raf;
      // eslint-disable-next-line no-inner-declarations
      function render() {
        raf = window.requestAnimationFrame(() => {
          time = new Date().getTime() / 1000;
          setSmoothTime(relevantTime + (new Date().getTime() - startTime) / 1000);
          render();
        });
      }

      render();
      return () => window.cancelAnimationFrame(raf);
    }

    return undefined;
  }, [relevantTime, playing]);

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      ref={containerRef}
      style={{ height: '100%', width: '100%', position: 'relative', cursor: 'grab' }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onMouseMove={handleMouseMove}
      onWheel={handleWheel}
    >
      {filtered.map((waveform) => {
        const left = 0.5 + ((waveform.from - smoothTime) / windowSize) * scaleFactor;
        const width = ((waveform.to - waveform.from) / windowSize) * scaleFactor;
        const leftPercent = `${left * 100}%`;
        const widthPercent = `${width * 100}%`;

        return (
          <Fragment key={`${waveform.from}-${waveform.to}`}>
            <img
              src={waveform.url}
              draggable={false}
              alt=""
              style={{
                pointerEvents: 'none',
                backgroundColor: 'var(--gray3)',
                position: 'absolute',
                height: '100%',
                width: widthPercent,
                left: leftPercent,
                borderLeft: waveform.from === 0 ? '1px solid var(--gray11)' : undefined,
                borderRight: waveform.to >= durationSafe ? '1px solid var(--gray11)' : undefined,
              }}
            />
            <div style={{ pointerEvents: 'none', position: 'absolute', width: widthPercent, backgroundColor: 'var(--gray12)', height: 1, top: '50%', left: leftPercent }} />
          </Fragment>
        );
      })}

      <div style={{ pointerEvents: 'none', position: 'absolute', height: '100%', backgroundColor: 'var(--red11)', width: 1, left: '50%', top: 0 }} />
    </div>
  );
});

export default BigWaveform;
