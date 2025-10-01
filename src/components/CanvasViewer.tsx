import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  useProjectStore,
  useCurrentPage,
  usePages,
  usePageOrder,
  useRenderScale,
  useArrayBuffer,
  useCropDraft
} from '@/store/useProjectStore';
import { workerManager } from '@/core/workerManager';
import { calculateViewport, canvasRectToPdfRect, normalizeRect } from '@/core/coords';
import CropOverlay from './CropOverlay';

export default function CanvasViewer() {
  const {
    setCurrentPage,
    setCropDraft,
    clearCropDraft,
  } = useProjectStore();

  const currentPage = useCurrentPage();
  const pages = usePages();
  const pageOrder = usePageOrder();
  const renderScale = useRenderScale();
  const arrayBuffer = useArrayBuffer();
  const cropDraft = useCropDraft();

  // 计算当前页面在显示顺序中的位置
  const currentDisplayPosition = useMemo(() => {
    if (currentPage === null) return -1;
    return pageOrder.indexOf(currentPage);
  }, [currentPage, pageOrder]);

  const [renderedImage, setRenderedImage] = useState<ImageBitmap | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewport, setViewport] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragRect, setDragRect] = useState<any>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const page = currentPage !== null ? pages[currentPage] : null;

  // 加载当前页面
  useEffect(() => {
    if (!arrayBuffer || currentPage === null || !page) {
      setRenderedImage(null);
      return;
    }

    let cancelled = false;

    const loadPage = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const bitmap = await workerManager.renderPage(
          arrayBuffer,
          currentPage,
          renderScale
        ) as ImageBitmap;

        if (!cancelled) {
          setRenderedImage(bitmap);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '页面加载失败');
          setIsLoading(false);
        }
      }
    };

    loadPage();

    return () => {
      cancelled = true;
      if (renderedImage) {
        renderedImage.close();
      }
    };
  }, [arrayBuffer, currentPage, renderScale, page]);

  // 计算视口
  useEffect(() => {
    if (!page || !containerRef.current) return;

    const container = containerRef.current;
    const newViewport = calculateViewport(
      page,
      container.clientWidth,
      container.clientHeight,
      40
    );
    
    setViewport(newViewport);
  }, [page, renderScale]);

  // 绘制到canvas
  useEffect(() => {
    if (!renderedImage || !canvasRef.current || !viewport) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(renderedImage, 0, 0, canvas.width, canvas.height);
  }, [renderedImage, viewport]);

  // 鼠标事件处理
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current || !viewport) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDragging(true);
    setDragStart({ x, y });
    setDragRect({ x, y, w: 0, h: 0 });
    
    // 清除之前的裁剪草稿
    clearCropDraft();
  }, [viewport, clearCropDraft]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStart || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newRect = {
      x: dragStart.x,
      y: dragStart.y,
      w: x - dragStart.x,
      h: y - dragStart.y,
    };

    setDragRect(newRect);
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging || !dragRect || !page || !viewport || currentPage === null) return;

    const normalizedRect = normalizeRect(dragRect);
    
    // 检查矩形是否足够大
    if (normalizedRect.w < 10 || normalizedRect.h < 10) {
      setIsDragging(false);
      setDragStart(null);
      setDragRect(null);
      return;
    }

    // 转换为PDF坐标
    const pdfRect = canvasRectToPdfRect(normalizedRect, page, viewport);
    
    // 设置裁剪草稿
    setCropDraft({
      page: currentPage,
      rect: pdfRect,
    });

    setIsDragging(false);
    setDragStart(null);
    setDragRect(null);
  }, [isDragging, dragRect, page, viewport, currentPage, setCropDraft]);

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!pages.length || currentPage === null) return;

      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          if (currentPage > 0) {
            setCurrentPage(currentPage - 1);
          }
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          if (currentPage < pages.length - 1) {
            setCurrentPage(currentPage + 1);
          }
          break;
        case 'Escape':
          clearCropDraft();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pages.length, currentPage, setCurrentPage, clearCropDraft]);

  if (!page || currentPage === null) {
    return (
      <div className="canvas-container h-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} 
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <p className="text-lg mb-2">选择页面进行预览</p>
          <p className="text-sm text-gray-400">
            在左侧缩略图列表中点击页面，或使用键盘方向键导航
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="canvas-container h-full"
    >
      {/* 工具栏 */}
      <div className="absolute top-4 left-4 z-10 bg-white rounded-lg shadow-lg p-2 flex items-center gap-2">
        <button
          onClick={() => {
            if (currentDisplayPosition > 0) {
              // 切换到前一个位置的页面
              setCurrentPage(pageOrder[currentDisplayPosition - 1]);
            }
          }}
          disabled={currentDisplayPosition <= 0}
          className="btn btn-ghost btn-sm"
          title="上一页"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <span className="text-sm text-gray-600 px-2">
          {currentDisplayPosition >= 0 ? currentDisplayPosition + 1 : 0} / {pageOrder.length}
        </span>

        <button
          onClick={() => {
            if (currentDisplayPosition >= 0 && currentDisplayPosition < pageOrder.length - 1) {
              // 切换到下一个位置的页面
              setCurrentPage(pageOrder[currentDisplayPosition + 1]);
            }
          }}
          disabled={currentDisplayPosition < 0 || currentDisplayPosition >= pageOrder.length - 1}
          className="btn btn-ghost btn-sm"
          title="下一页"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <div className="toolbar-separator" />

        <button
          onClick={clearCropDraft}
          disabled={!cropDraft}
          className="btn btn-ghost btn-sm"
          title="清除裁剪"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 提示信息 */}
      <div className="absolute top-4 right-4 z-10 bg-white rounded-lg shadow-lg p-2">
        <div className="text-xs text-gray-600">
          <p>💡 拖拽鼠标框选区域进行裁剪</p>
          <p>⌨️ 使用方向键导航页面</p>
        </div>
      </div>

      {/* 主画布区域 */}
      <div className="h-full flex items-center justify-center p-8">
        {isLoading && (
          <div className="flex items-center justify-center">
            <div className="loading-spinner w-8 h-8 text-blue-600 mr-3"></div>
            <span className="text-gray-600">正在加载页面...</span>
          </div>
        )}

        {error && (
          <div className="text-center text-red-500">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} 
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-lg mb-2">页面加载失败</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {viewport && renderedImage && (
          <div 
            className="canvas-viewport relative cursor-crosshair"
            style={{
              width: viewport.width,
              height: viewport.height,
            }}
          >
            <canvas
              ref={canvasRef}
              className="block"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />

            {/* 拖拽预览 */}
            {isDragging && dragRect && (
              <div
                className="crop-overlay"
                style={{
                  left: Math.min(dragRect.x, dragRect.x + dragRect.w),
                  top: Math.min(dragRect.y, dragRect.y + dragRect.h),
                  width: Math.abs(dragRect.w),
                  height: Math.abs(dragRect.h),
                }}
              />
            )}

            {/* 裁剪覆盖层 */}
            {cropDraft && cropDraft.page === currentPage && (
              <CropOverlay
                cropRect={cropDraft.rect}
                page={page}
                viewport={viewport}
                onUpdate={(rect) => setCropDraft({ page: currentPage, rect })}
                onClear={clearCropDraft}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}