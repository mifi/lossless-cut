import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { CropRect } from '../types';

const handleSize = 10;

const overlayStyle: CSSProperties = {
  position: 'absolute',
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  pointerEvents: 'none',
};

const cropBorderStyle: CSSProperties = {
  position: 'absolute',
  border: '2px solid rgba(255, 255, 255, 0.8)',
  boxSizing: 'border-box',
  cursor: 'move',
};

const handleStyle: CSSProperties = {
  position: 'absolute',
  width: handleSize,
  height: handleSize,
  backgroundColor: 'white',
  border: '1px solid rgba(0,0,0,0.5)',
};

type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

function CropOverlay({ crop, sourceVideoResolution, videoContainerRect, videoElementRect, onCropChange }: {
  crop: CropRect,
  sourceVideoResolution: { width: number, height: number },
  videoContainerRect: DOMRect | undefined,
  videoElementRect: { left: number, top: number, width: number, height: number } | undefined,
  onCropChange: (crop: CropRect) => void,
}) {
  const dragRef = useRef<{ mode: DragMode, startMouseX: number, startMouseY: number, startCrop: CropRect } | null>(null);
  const [dragging, setDragging] = useState(false);

  // Scale from source video pixels to screen pixels
  const scaleX = videoElementRect ? videoElementRect.width / sourceVideoResolution.width : 1;
  const scaleY = videoElementRect ? videoElementRect.height / sourceVideoResolution.height : 1;

  // Video element offset within the container
  const videoOffsetX = videoElementRect ? videoElementRect.left : 0;
  const videoOffsetY = videoElementRect ? videoElementRect.top : 0;

  // Crop rect on screen (relative to container)
  const screenCropX = videoOffsetX + crop.x * scaleX;
  const screenCropY = videoOffsetY + crop.y * scaleY;
  const screenCropW = crop.w * scaleX;
  const screenCropH = crop.h * scaleY;

  const containerW = videoContainerRect?.width ?? 0;
  const containerH = videoContainerRect?.height ?? 0;

  const onMouseDown = useCallback((e: React.MouseEvent, mode: DragMode) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      mode,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startCrop: { ...crop },
    };
    setDragging(true);
  }, [crop]);

  useEffect(() => {
    if (!dragging) return undefined;

    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const { mode, startMouseX, startMouseY, startCrop } = dragRef.current;
      const dx = (e.clientX - startMouseX) / scaleX;
      const dy = (e.clientY - startMouseY) / scaleY;

      let newCrop: CropRect;

      if (mode === 'move') {
        newCrop = { ...startCrop, x: Math.round(startCrop.x + dx), y: Math.round(startCrop.y + dy) };
      } else {
        let { x, y, w, h } = startCrop;
        if (mode.includes('w')) { x = Math.round(startCrop.x + dx); w = Math.round(startCrop.w - dx); }
        if (mode.includes('e')) { w = Math.round(startCrop.w + dx); }
        if (mode.includes('n')) { y = Math.round(startCrop.y + dy); h = Math.round(startCrop.h - dy); }
        if (mode.includes('s')) { h = Math.round(startCrop.h + dy); }
        // Enforce minimum size
        if (w < 16) { w = 16; if (mode.includes('w')) x = startCrop.x + startCrop.w - 16; }
        if (h < 16) { h = 16; if (mode.includes('n')) y = startCrop.y + startCrop.h - 16; }
        newCrop = { x, y, w, h };
      }

      onCropChange(newCrop);
    };

    const onMouseUp = () => {
      dragRef.current = null;
      setDragging(false);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging, scaleX, scaleY, onCropChange]);

  const handles: { mode: DragMode, style: CSSProperties }[] = [
    { mode: 'nw', style: { left: -handleSize / 2, top: -handleSize / 2, cursor: 'nwse-resize' } },
    { mode: 'ne', style: { right: -handleSize / 2, top: -handleSize / 2, cursor: 'nesw-resize' } },
    { mode: 'sw', style: { left: -handleSize / 2, bottom: -handleSize / 2, cursor: 'nesw-resize' } },
    { mode: 'se', style: { right: -handleSize / 2, bottom: -handleSize / 2, cursor: 'nwse-resize' } },
    { mode: 'n', style: { left: '50%', marginLeft: -handleSize / 2, top: -handleSize / 2, cursor: 'ns-resize' } },
    { mode: 's', style: { left: '50%', marginLeft: -handleSize / 2, bottom: -handleSize / 2, cursor: 'ns-resize' } },
    { mode: 'w', style: { left: -handleSize / 2, top: '50%', marginTop: -handleSize / 2, cursor: 'ew-resize' } },
    { mode: 'e', style: { right: -handleSize / 2, top: '50%', marginTop: -handleSize / 2, cursor: 'ew-resize' } },
  ];

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 5 }}>
      {/* Darkened overlay regions */}
      {/* Top */}
      <div style={{ ...overlayStyle, top: 0, left: 0, right: 0, height: Math.max(0, screenCropY) }} />
      {/* Bottom */}
      <div style={{ ...overlayStyle, top: screenCropY + screenCropH, left: 0, right: 0, bottom: 0, height: Math.max(0, containerH - (screenCropY + screenCropH)) }} />
      {/* Left */}
      <div style={{ ...overlayStyle, top: screenCropY, left: 0, width: Math.max(0, screenCropX), height: screenCropH }} />
      {/* Right */}
      <div style={{ ...overlayStyle, top: screenCropY, left: screenCropX + screenCropW, right: 0, width: Math.max(0, containerW - (screenCropX + screenCropW)), height: screenCropH }} />

      {/* Crop rectangle (interactive) */}
      <div
        style={{
          ...cropBorderStyle,
          left: screenCropX,
          top: screenCropY,
          width: screenCropW,
          height: screenCropH,
          pointerEvents: 'auto',
        }}
        onMouseDown={(e) => onMouseDown(e, 'move')}
        role="button"
        tabIndex={-1}
      >
        {/* Black fill for padding areas (areas outside source video but inside crop) */}
        {(() => {
          // Compute which part of the crop is outside the video
          const videoScreenLeft = videoOffsetX;
          const videoScreenTop = videoOffsetY;
          const videoScreenRight = videoOffsetX + sourceVideoResolution.width * scaleX;
          const videoScreenBottom = videoOffsetY + sourceVideoResolution.height * scaleY;
          const segments: { key: string, style: CSSProperties }[] = [];

          // Left padding (crop extends left of video)
          if (screenCropX < videoScreenLeft) {
            segments.push({ key: 'pad-left', style: { position: 'absolute', top: 0, left: 0, width: videoScreenLeft - screenCropX, height: '100%', backgroundColor: 'black' } });
          }
          // Right padding
          if (screenCropX + screenCropW > videoScreenRight) {
            segments.push({ key: 'pad-right', style: { position: 'absolute', top: 0, right: 0, width: (screenCropX + screenCropW) - videoScreenRight, height: '100%', backgroundColor: 'black' } });
          }
          // Top padding
          if (screenCropY < videoScreenTop) {
            const leftClamp = Math.max(0, videoScreenLeft - screenCropX);
            const rightClamp = Math.max(0, (screenCropX + screenCropW) - videoScreenRight);
            segments.push({ key: 'pad-top', style: { position: 'absolute', top: 0, left: leftClamp, right: rightClamp, height: videoScreenTop - screenCropY, backgroundColor: 'black' } });
          }
          // Bottom padding
          if (screenCropY + screenCropH > videoScreenBottom) {
            const leftClamp = Math.max(0, videoScreenLeft - screenCropX);
            const rightClamp = Math.max(0, (screenCropX + screenCropW) - videoScreenRight);
            segments.push({ key: 'pad-bottom', style: { position: 'absolute', bottom: 0, left: leftClamp, right: rightClamp, height: (screenCropY + screenCropH) - videoScreenBottom, backgroundColor: 'black' } });
          }

          return segments.map(({ key, style }) => <div key={key} style={style} />);
        })()}

        {/* Resize handles */}
        {handles.map(({ mode, style }) => (
          <div
            key={mode}
            style={{ ...handleStyle, ...style, pointerEvents: 'auto' }}
            onMouseDown={(e) => onMouseDown(e, mode)}
            role="button"
            tabIndex={-1}
          />
        ))}

        {/* Rule of thirds grid lines */}
        <div style={{ position: 'absolute', top: '33.33%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '66.67%', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: '33.33%', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', left: '66.67%', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} />

        {/* Dimension label */}
        <div style={{ position: 'absolute', bottom: 4, right: 4, fontSize: '10px', color: 'white', backgroundColor: 'rgba(0,0,0,0.6)', padding: '1px 4px', borderRadius: 2, pointerEvents: 'none' }}>
          {crop.w}×{crop.h}
        </div>
      </div>
    </div>
  );
}

export default memo(CropOverlay);
