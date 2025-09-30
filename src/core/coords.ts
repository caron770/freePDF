import type { PdfRect, PdfPageMeta, CanvasRect, ViewportInfo } from './types';

/**
 * 将画布坐标转换为PDF坐标
 */
export function canvasRectToPdfRect(
  rectCanvas: CanvasRect,
  page: PdfPageMeta,
  viewport: ViewportInfo
): PdfRect {
  const baseBox = page.cropBox ?? page.mediaBox;
  const scaleX = baseBox.width / viewport.width;
  const scaleY = baseBox.height / viewport.height;

  const relativeX = rectCanvas.x;
  const relativeY = rectCanvas.y;

  const width = rectCanvas.w * scaleX;
  const height = rectCanvas.h * scaleY;

  const x = baseBox.x + relativeX * scaleX;
  const y = baseBox.y + (baseBox.height - (relativeY + rectCanvas.h) * scaleY);

  return {
    x,
    y,
    width,
    height,
  };
}

/**
 * 将PDF坐标转换为画布坐标
 */
export function pdfRectToCanvasRect(
  rectPdf: PdfRect,
  page: PdfPageMeta,
  viewport: ViewportInfo
): CanvasRect {
  const baseBox = page.cropBox ?? page.mediaBox;
  const scaleX = viewport.width / baseBox.width;
  const scaleY = viewport.height / baseBox.height;

  const width = rectPdf.width * scaleX;
  const height = rectPdf.height * scaleY;

  const x = (rectPdf.x - baseBox.x) * scaleX;
  const y = (baseBox.height - (rectPdf.y - baseBox.y) - rectPdf.height) * scaleY;

  return {
    x,
    y,
    w: width,
    h: height,
  };
}

/**
 * 规范化矩形（确保width和height为正）
 */
export function normalizeRect(rect: CanvasRect): CanvasRect {
  return {
    x: rect.w < 0 ? rect.x + rect.w : rect.x,
    y: rect.h < 0 ? rect.y + rect.h : rect.y,
    w: Math.abs(rect.w),
    h: Math.abs(rect.h),
  };
}

/**
 * 计算适合容器的视口信息
 */
export function calculateViewport(
  page: PdfPageMeta,
  containerWidth: number,
  containerHeight: number,
  padding = 20
): ViewportInfo {
  const availableWidth = containerWidth - padding * 2;
  const availableHeight = containerHeight - padding * 2;
  
  // 计算缩放比例以适合容器
  const scaleX = availableWidth / page.width;
  const scaleY = availableHeight / page.height;
  const scale = Math.min(scaleX, scaleY, 2); // 最大2倍缩放
  
  const width = page.width * scale;
  const height = page.height * scale;
  
  // 居中偏移
  const offsetX = (containerWidth - width) / 2;
  const offsetY = (containerHeight - height) / 2;
  
  return {
    width,
    height,
    scale,
    offsetX,
    offsetY,
  };
}

/**
 * 检查点是否在矩形内
 */
export function pointInRect(x: number, y: number, rect: CanvasRect): boolean {
  return (
    x >= rect.x &&
    x <= rect.x + rect.w &&
    y >= rect.y &&
    y <= rect.y + rect.h
  );
}

/**
 * 计算DPI对应的缩放比例
 */
export function dpiToScale(dpi: number): number {
  return dpi / 72; // PDF默认72 DPI
}
