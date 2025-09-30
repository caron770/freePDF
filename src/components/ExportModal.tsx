import { useState, useCallback } from 'react';
import {
  useArrayBuffer,
  usePages,
  usePageOrder,
  useSelection,
  useCropDraft
} from '@/store/useProjectStore';
import { workerManager } from '@/core/workerManager';
import { downloadFiles, generateFilename } from '@/utils/file';
import { parsePageExpr, validatePageExpr, formatPageRange } from '@/utils/range';
import { pdfRectToCanvasRect } from '@/core/coords';
import { setCropBox, hardCropToMediaBox, extractRanges } from '@/core/pdfEdit';
import { convertPdfToSvg } from '@/services/svgConverter';
import type { ExportOptions, ViewportInfo } from '@/core/types';

interface ExportModalProps {
  onClose: () => void;
}

const toArrayBuffer = (input: ArrayBuffer | Uint8Array): ArrayBuffer => {
  if (input instanceof Uint8Array) {
    return input.slice().buffer;
  }
  return new Uint8Array(input).slice().buffer;
};

export default function ExportModal({ onClose }: ExportModalProps) {
  const arrayBuffer = useArrayBuffer();
  const pages = usePages();
  const pageOrder = usePageOrder();
  const selection = useSelection();
  const cropDraft = useCropDraft();

  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'png',
    dpi: 200,
    quality: 85,
    pages: selection.size > 0 ? Array.from(selection) : pageOrder,
    hardCrop: false,
  });

  const [pageRange, setPageRange] = useState(() => {
    const selectedPages = selection.size > 0 ? Array.from(selection).sort((a, b) => a - b) : pageOrder;
    return formatPageRange(selectedPages.map(i => i + 1)); // 转为1基
  });

  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // 验证页面范围
  const rangeValidation = validatePageExpr(pageRange, pages.length);

  const handleExport = useCallback(async () => {
    if (!arrayBuffer || !rangeValidation.valid) return;

    try {
      setIsExporting(true);
      setProgress(0);
      setError(null);

      // 解析页面范围
      const pages1Based = parsePageExpr(pageRange, pages.length);
      const pages0Based = pages1Based.map(p => p - 1);
      const format = exportOptions.format;

      if (format === 'pdf') {
        // 导出PDF
        let pdfData: ArrayBuffer | Uint8Array = arrayBuffer;

        // 如果有裁剪设置，应用裁剪
        if (cropDraft) {
          const cropPages1 = pages1Based.filter(p => p - 1 === cropDraft.page);
          if (cropPages1.length > 0) {
            const inputBuffer = toArrayBuffer(pdfData);

            if (exportOptions.hardCrop) {
              pdfData = await hardCropToMediaBox(inputBuffer, cropPages1, cropDraft.rect);
            } else {
              pdfData = await setCropBox(inputBuffer, cropPages1, cropDraft.rect);
            }
          }
        }

        const filename = generateFilename('exported', 'pdf');
        downloadFiles([{
          data: pdfData,
          filename,
          mimeType: 'application/pdf'
        }]);

        setProgress(100);
      } else {
        // 导出图片或SVG
        const rasterFormat = format as Exclude<ExportOptions['format'], 'pdf'>;
        const scale = rasterFormat === 'svg' ? 1 : ((exportOptions.dpi ?? 200) / 72);
        const quality = rasterFormat === 'jpeg' ? exportOptions.quality ?? 85 : undefined;
        
        if (rasterFormat === 'svg') {
          if (pages0Based.length === 0) {
            setProgress(100);
            return;
          }

          const converterEndpoint = (import.meta as any).env?.VITE_SVG_CONVERTER_URL ?? 'http://localhost:4000/convert/svg';
          const files = [] as Array<{ data: string; filename: string; mimeType: string }>;

          for (let index = 0; index < pages0Based.length; index++) {
            const pageIndex = pages0Based[index];
            const pageNum = pages1Based[index];
            const filename = `page-${pageNum.toString().padStart(4, '0')}.svg`;

            setProgress((index / pages0Based.length) * 100);

            let singlePagePdf: Uint8Array = await extractRanges(arrayBuffer, [[pageIndex + 1, pageIndex + 1]]);

            if (cropDraft && cropDraft.page === pageIndex) {
              const cropPages = [1];
              const pageBuffer = toArrayBuffer(singlePagePdf);
              singlePagePdf = exportOptions.hardCrop
                ? await hardCropToMediaBox(pageBuffer, cropPages, cropDraft.rect)
                : await setCropBox(pageBuffer, cropPages, cropDraft.rect);
            }

            const svgString = await convertPdfToSvg(singlePagePdf, {
              endpoint: converterEndpoint,
              page: 1,
            });

            files.push({
              data: svgString,
              filename,
              mimeType: 'image/svg+xml',
            });
          }

          downloadFiles(files);
          setProgress(100);
        } else {
          const tasks = pages0Based.map(pageIndex => ({
            id: `export_${pageIndex}`,
            type: 'export' as const,
            page: pageIndex,
            scale,
            format: rasterFormat,
            quality,
          }));

          const results = await workerManager.exportPages(arrayBuffer, tasks);
          
          const files = await Promise.all(results.map(async (result, index) => {
            const pageNum = pages1Based[index];
            const extension = rasterFormat;
            const filename = `page-${pageNum.toString().padStart(4, '0')}.${extension}`;
            const pageMeta = pages[pages0Based[index]];
            
            // 将ImageBitmap转换为Blob
            const bitmap = result as ImageBitmap;
            const shouldCrop = exportOptions.hardCrop && cropDraft && cropDraft.page === pages0Based[index];

            let sourceX = 0;
            let sourceY = 0;
            let sourceWidth = bitmap.width;
            let sourceHeight = bitmap.height;

            if (shouldCrop && pageMeta) {
              const exportViewport: ViewportInfo = {
                width: bitmap.width,
                height: bitmap.height,
                scale,
                offsetX: 0,
                offsetY: 0,
              };

              const cropRectCanvas = pdfRectToCanvasRect(cropDraft.rect, pageMeta, exportViewport);

              const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

              const maxWidth = bitmap.width;
              const maxHeight = bitmap.height;

              const cropX = Math.floor(clamp(cropRectCanvas.x, 0, maxWidth));
              const cropY = Math.floor(clamp(cropRectCanvas.y, 0, maxHeight));
              const remainingWidth = maxWidth - cropX;
              const remainingHeight = maxHeight - cropY;

              if (remainingWidth > 1 && remainingHeight > 1) {
                const cropW = Math.floor(clamp(cropRectCanvas.w, 1, remainingWidth));
                const cropH = Math.floor(clamp(cropRectCanvas.h, 1, remainingHeight));

                if (cropW > 0 && cropH > 0) {
                  sourceX = cropX;
                  sourceY = cropY;
                  sourceWidth = cropW;
                  sourceHeight = cropH;
                }
              }
            }

            const canvas = new OffscreenCanvas(sourceWidth, sourceHeight);
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(
              bitmap,
              sourceX,
              sourceY,
              sourceWidth,
              sourceHeight,
              0,
              0,
              sourceWidth,
              sourceHeight
            );
            bitmap.close();
            
            const blob = await canvas.convertToBlob({
              type: `image/${rasterFormat}`,
              quality: rasterFormat === 'jpeg' && quality !== undefined ? quality / 100 : undefined
            });

            const data = await blob.arrayBuffer();
            const mimeType = `image/${rasterFormat}`;

            return { data, filename, mimeType };
          }));

          downloadFiles(files);
          setProgress(100);
        }
      }

      // 延迟关闭模态框
      setTimeout(() => {
        onClose();
      }, 1000);

    } catch (err) {
      console.error('[ExportModal] handleExport error', err);
      setError(err instanceof Error ? err.message : '导出失败');
    } finally {
      setIsExporting(false);
    }
  }, [arrayBuffer, pageRange, exportOptions, pages, cropDraft, rangeValidation.valid, onClose]);

  return (
    <div className="modal-overlay">
      <div className="modal max-w-lg">
        <div className="modal-header">
          <h2 className="text-lg font-semibold">导出文件</h2>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm ml-auto"
            disabled={isExporting}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="modal-body space-y-4">
          {/* 导出格式 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              导出格式
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'png', label: 'PNG图片', desc: '高质量无损' },
                { value: 'jpeg', label: 'JPEG图片', desc: '小文件有损' },
                { value: 'svg', label: 'SVG矢量', desc: '可缩放矢量' },
                { value: 'pdf', label: 'PDF文档', desc: '原格式保持' },
              ].map((format) => (
                <label
                  key={format.value}
                  className={`
                    p-3 border rounded-lg cursor-pointer transition-colors
                    ${exportOptions.format === format.value 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    checked={exportOptions.format === format.value}
                    onChange={() => setExportOptions(prev => ({ ...prev, format: format.value as any }))}
                  />
                  <div className="font-medium text-sm">{format.label}</div>
                  <div className="text-xs text-gray-500">{format.desc}</div>
                </label>
              ))}
            </div>
          </div>

          {/* 页面范围 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              页面范围
            </label>
            <input
              type="text"
              className={`input w-full ${!rangeValidation.valid ? 'input-error' : ''}`}
              value={pageRange}
              onChange={(e) => setPageRange(e.target.value)}
              placeholder="例如: 1,3,5-8,10-"
              disabled={isExporting}
            />
            {!rangeValidation.valid && (
              <p className="text-sm text-red-600 mt-1">{rangeValidation.error}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              支持格式：单页(1,3)、范围(5-8)、开放范围(10-)
            </p>
          </div>

          {/* DPI设置 (仅图片格式) */}
          {['png', 'jpeg'].includes(exportOptions.format) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                分辨率 (DPI)
              </label>
              <select
                className="input w-full"
                value={exportOptions.dpi}
                onChange={(e) => setExportOptions(prev => ({ ...prev, dpi: Number(e.target.value) }))}
                disabled={isExporting}
              >
                <option value={72}>72 DPI (网页)</option>
                <option value={150}>150 DPI (标准)</option>
                <option value={200}>200 DPI (推荐)</option>
                <option value={300}>300 DPI (高质量)</option>
                <option value={600}>600 DPI (超高质量)</option>
              </select>
            </div>
          )}

          {/* JPEG质量设置 */}
          {exportOptions.format === 'jpeg' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                压缩质量: {exportOptions.quality}%
              </label>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                className="w-full"
                value={exportOptions.quality}
                onChange={(e) => setExportOptions(prev => ({ ...prev, quality: Number(e.target.value) }))}
                disabled={isExporting}
              />
            </div>
          )}

          {/* 裁剪选项 */}
          {cropDraft && (
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={exportOptions.hardCrop}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, hardCrop: e.target.checked }))}
                  disabled={isExporting}
                />
                <span className="text-sm">硬裁剪 (永久移除裁剪区域外的内容)</span>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                不勾选时使用软裁剪，可以恢复
              </p>
            </div>
          )}

          {/* 进度条 */}
          {isExporting && (
            <div>
              <div className="progress">
                <div className="progress-bar" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-sm text-gray-600 mt-1 text-center">
                导出中... {Math.round(progress)}%
              </p>
            </div>
          )}

          {/* 错误信息 */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            onClick={onClose}
            className="btn btn-secondary"
            disabled={isExporting}
          >
            取消
          </button>
          <button
            onClick={handleExport}
            className="btn btn-primary"
            disabled={!rangeValidation.valid || isExporting}
          >
            {isExporting ? '导出中...' : '开始导出'}
          </button>
        </div>
      </div>
    </div>
  );
}
