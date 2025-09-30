import React, { useState, useCallback, useRef, useEffect } from 'react';
import { pdfRectToCanvasRect, canvasRectToPdfRect } from '@/core/coords';
import type { PdfRect, PdfPageMeta, ViewportInfo } from '@/core/types';

interface CropOverlayProps {
  cropRect: PdfRect;
  page: PdfPageMeta;
  viewport: ViewportInfo;
  onUpdate: (rect: PdfRect) => void;
  onClear: () => void;
}

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'move';

export default function CropOverlay({
  cropRect,
  page,
  viewport,
  onUpdate,
  onClear
}: CropOverlayProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragHandle, setDragHandle] = useState<ResizeHandle | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; rect: any } | null>(null);

  const overlayRef = useRef<HTMLDivElement>(null);

  // 将PDF坐标转换为画布坐标
  const canvasRect = pdfRectToCanvasRect(cropRect, page, viewport);

  // 处理鼠标按下
  const handleMouseDown = useCallback((e: React.MouseEvent, handle: ResizeHandle) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    setDragHandle(handle);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      rect: { ...canvasRect }
    });
  }, [canvasRect]);

  // 处理鼠标移动
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !dragStart || !dragHandle) return;

    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    let newRect = { ...dragStart.rect };

    switch (dragHandle) {
      case 'nw':
        newRect.x += deltaX;
        newRect.y += deltaY;
        newRect.w -= deltaX;
        newRect.h -= deltaY;
        break;
      case 'n':
        newRect.y += deltaY;
        newRect.h -= deltaY;
        break;
      case 'ne':
        newRect.y += deltaY;
        newRect.w += deltaX;
        newRect.h -= deltaY;
        break;
      case 'e':
        newRect.w += deltaX;
        break;
      case 'se':
        newRect.w += deltaX;
        newRect.h += deltaY;
        break;
      case 's':
        newRect.h += deltaY;
        break;
      case 'sw':
        newRect.x += deltaX;
        newRect.w -= deltaX;
        newRect.h += deltaY;
        break;
      case 'w':
        newRect.x += deltaX;
        newRect.w -= deltaX;
        break;
      case 'move':
        newRect.x += deltaX;
        newRect.y += deltaY;
        break;
    }

    // 限制在视口范围内
    newRect.x = Math.max(0, Math.min(newRect.x, viewport.width - 10));
    newRect.y = Math.max(0, Math.min(newRect.y, viewport.height - 10));
    newRect.w = Math.max(10, Math.min(newRect.w, viewport.width - newRect.x));
    newRect.h = Math.max(10, Math.min(newRect.h, viewport.height - newRect.y));

    // 转换回PDF坐标并更新
    const pdfRect = canvasRectToPdfRect(newRect, page, viewport);
    onUpdate(pdfRect);
  }, [isDragging, dragStart, dragHandle, viewport, page, onUpdate]);

  // 处理鼠标抬起
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragHandle(null);
    setDragStart(null);
  }, []);

  // 全局事件监听
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // 获取句柄样式
  const getHandleStyle = (handle: ResizeHandle) => {
    const baseStyle = 'crop-handle absolute';
    const cursorMap = {
      'nw': 'cursor-nw-resize',
      'n': 'cursor-n-resize',
      'ne': 'cursor-ne-resize',
      'e': 'cursor-e-resize',
      'se': 'cursor-se-resize',
      's': 'cursor-s-resize',
      'sw': 'cursor-sw-resize',
      'w': 'cursor-w-resize',
      'move': 'cursor-move'
    };
    return `${baseStyle} ${cursorMap[handle]}`;
  };

  // 获取句柄位置
  const getHandlePosition = (handle: ResizeHandle) => {
    const size = 12; // 句柄大小
    const offset = size / 2;

    switch (handle) {
      case 'nw':
        return { top: -offset, left: -offset };
      case 'n':
        return { top: -offset, left: canvasRect.w / 2 - offset };
      case 'ne':
        return { top: -offset, right: -offset };
      case 'e':
        return { top: canvasRect.h / 2 - offset, right: -offset };
      case 'se':
        return { bottom: -offset, right: -offset };
      case 's':
        return { bottom: -offset, left: canvasRect.w / 2 - offset };
      case 'sw':
        return { bottom: -offset, left: -offset };
      case 'w':
        return { top: canvasRect.h / 2 - offset, left: -offset };
      default:
        return {};
    }
  };

  return (
    <>
      {/* 裁剪框 */}
      <div
        ref={overlayRef}
        className="crop-overlay"
        style={{
          left: canvasRect.x,
          top: canvasRect.y,
          width: canvasRect.w,
          height: canvasRect.h,
        }}
      >
        {/* 移动区域 */}
        <div
          className="absolute inset-0 cursor-move"
          onMouseDown={(e) => handleMouseDown(e, 'move')}
        />

        {/* 调整大小句柄 */}
        {(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as ResizeHandle[]).map((handle) => (
          <div
            key={handle}
            className={getHandleStyle(handle)}
            style={{
              ...getHandlePosition(handle),
              width: 12,
              height: 12,
            }}
            onMouseDown={(e) => handleMouseDown(e, handle)}
          />
        ))}

        {/* 工具栏 */}
        <div className="absolute -top-10 left-0 bg-white rounded shadow-lg p-1 flex items-center gap-1">
          <button
            onClick={onClear}
            className="btn btn-ghost btn-sm text-xs"
            title="清除裁剪"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="text-xs text-gray-600">
            {Math.round(cropRect.width)} × {Math.round(cropRect.height)}
          </div>
        </div>
      </div>

      {/* 遮罩层 */}
      <div className="absolute inset-0 pointer-events-none">
        {/* 上遮罩 */}
        <div
          className="absolute bg-black bg-opacity-20"
          style={{
            top: 0,
            left: 0,
            width: '100%',
            height: canvasRect.y,
          }}
        />
        {/* 下遮罩 */}
        <div
          className="absolute bg-black bg-opacity-20"
          style={{
            top: canvasRect.y + canvasRect.h,
            left: 0,
            width: '100%',
            height: viewport.height - (canvasRect.y + canvasRect.h),
          }}
        />
        {/* 左遮罩 */}
        <div
          className="absolute bg-black bg-opacity-20"
          style={{
            top: canvasRect.y,
            left: 0,
            width: canvasRect.x,
            height: canvasRect.h,
          }}
        />
        {/* 右遮罩 */}
        <div
          className="absolute bg-black bg-opacity-20"
          style={{
            top: canvasRect.y,
            left: canvasRect.x + canvasRect.w,
            width: viewport.width - (canvasRect.x + canvasRect.w),
            height: canvasRect.h,
          }}
        />
      </div>
    </>
  );
}