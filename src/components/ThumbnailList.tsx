import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import {
  useProjectStore,
  usePages,
  usePageOrder,
  useSelection,
  useCurrentPage,
  useThumbnailScale,
  useArrayBuffer
} from '@/store/useProjectStore';
import { workerManager } from '@/core/workerManager';
import clsx from 'clsx';

interface ThumbnailItemProps {
  pageIndex: number;
  position: number;
  onMove: (dragIndex: number, hoverIndex: number) => void;
}

function ThumbnailItem({ pageIndex, position, onMove }: ThumbnailItemProps) {
  const {
    selectPage,
    togglePageSelection,
    setCurrentPage,
  } = useProjectStore();

  const pages = usePages();
  const selection = useSelection();
  const currentPage = useCurrentPage();
  const thumbnailScale = useThumbnailScale();
  const arrayBuffer = useArrayBuffer();

  const [thumbnail, setThumbnail] = useState<ImageBitmap | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ref = useRef<HTMLDivElement>(null);
  const page = pages[pageIndex];

  const isSelected = selection.has(pageIndex);
  const isCurrent = currentPage === pageIndex;

  // 拖拽功能
  const [{ isDragging }, drag] = useDrag({
    type: 'thumbnail',
    item: { index: position },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: 'thumbnail',
    hover: (item: { index: number }) => {
      if (item.index !== position) {
        onMove(item.index, position);
        item.index = position;
      }
    },
  });

  drag(drop(ref));

  // 加载缩略图
  useEffect(() => {
    if (!arrayBuffer || !page) return;

    let cancelled = false;
    
    const loadThumbnail = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const bitmap = await workerManager.renderPage(
          arrayBuffer,
          pageIndex,
          thumbnailScale
        ) as ImageBitmap;

        if (!cancelled) {
          setThumbnail(bitmap);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '缩略图加载失败');
          setIsLoading(false);
        }
      }
    };

    loadThumbnail();

    return () => {
      cancelled = true;
      if (thumbnail) {
        thumbnail.close();
      }
    };
  }, [arrayBuffer, pageIndex, thumbnailScale, page]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd + 点击切换选择
      togglePageSelection(pageIndex);
    } else if (e.shiftKey && currentPage !== null) {
      // Shift + 点击范围选择
      const start = Math.min(currentPage, pageIndex);
      const end = Math.max(currentPage, pageIndex);
      const range = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      
      // 这里简化处理，直接选择范围内的所有页面
      range.forEach(index => {
        if (!selection.has(index)) {
          togglePageSelection(index);
        }
      });
    } else {
      // 普通点击选择单页
      selectPage(pageIndex);
      setCurrentPage(pageIndex);
    }
  }, [pageIndex, currentPage, selection, selectPage, setCurrentPage, togglePageSelection]);

  const handleDoubleClick = useCallback(() => {
    setCurrentPage(pageIndex);
  }, [pageIndex, setCurrentPage]);

  return (
    <div
      ref={ref}
      className={clsx(
        'thumbnail p-2 m-2 cursor-pointer select-none',
        {
          'selected': isSelected,
          'current': isCurrent,
          'drag-preview': isDragging,
        }
      )}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      {/* 页面号 */}
      <div className="text-xs text-gray-500 mb-1 text-center font-medium">
        第 {position + 1} 页
      </div>

      {/* 缩略图容器 */}
      <div className="relative bg-white border rounded shadow-sm overflow-hidden">
        {isLoading && (
          <div className="aspect-[3/4] flex items-center justify-center bg-gray-100">
            <div className="loading-spinner w-6 h-6 text-gray-400"></div>
          </div>
        )}

        {error && (
          <div className="aspect-[3/4] flex items-center justify-center bg-red-50 text-red-500 text-xs p-2">
            <div className="text-center">
              <svg className="w-6 h-6 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          </div>
        )}

        {thumbnail && (
          <canvas
            ref={(canvas) => {
              if (canvas && thumbnail) {
                canvas.width = thumbnail.width;
                canvas.height = thumbnail.height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(thumbnail, 0, 0);
                }
              }
            }}
            className="thumbnail-image w-full h-auto no-drag"
          />
        )}

        {/* 选择状态指示器 */}
        {isSelected && (
          <div className="absolute top-1 right-1 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}

        {/* 当前页指示器 */}
        {isCurrent && (
          <div className="absolute top-1 left-1 w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-xs">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        )}
      </div>

      {/* 页面信息 */}
      <div className="text-xs text-gray-400 mt-1 text-center">
        {Math.round(page.width)} × {Math.round(page.height)}
        {page.rotation !== 0 && (
          <span className="ml-1">({page.rotation}°)</span>
        )}
      </div>
    </div>
  );
}

export default function ThumbnailList() {
  const { setPageOrder } = useProjectStore();
  const pages = usePages();
  const pageOrder = usePageOrder();

  const moveItem = useCallback((dragIndex: number, hoverIndex: number) => {
    const newOrder = [...pageOrder];
    const draggedItem = newOrder[dragIndex];
    newOrder.splice(dragIndex, 1);
    newOrder.splice(hoverIndex, 0, draggedItem);
    setPageOrder(newOrder);
  }, [pageOrder, setPageOrder]);

  if (pages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} 
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <p>暂无页面</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto scrollbar-thin">
      <div className="p-2">
        {/* 标题 */}
        <div className="flex items-center justify-between mb-4 px-2">
          <h2 className="font-medium text-gray-900">页面缩略图</h2>
          <span className="text-sm text-gray-500">{pageOrder.length} 页</span>
        </div>

        {/* 操作提示 */}
        <div className="text-xs text-gray-500 mb-4 px-2">
          <p>• 点击选择页面</p>
          <p>• Ctrl/Cmd+点击多选</p>
          <p>• 拖拽调整顺序</p>
          <p>• 双击预览页面</p>
        </div>

        {/* 缩略图列表 */}
        <div className="space-y-1">
          {pageOrder.map((pageIndex, position) => (
            <ThumbnailItem
              key={pageIndex}
              pageIndex={pageIndex}
              position={position}
              onMove={moveItem}
            />
          ))}
        </div>
      </div>
    </div>
  );
}