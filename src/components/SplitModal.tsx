import { useState, useCallback } from 'react';
import {
  useArrayBuffer,
  usePageOrder,
  useFileName
} from '@/store/useProjectStore';
import { downloadFile, generateFilename } from '@/utils/file';
import { parsePageExpr, validatePageExpr } from '@/utils/range';
import { extractRanges } from '@/core/pdfEdit';

interface SplitModalProps {
  onClose: () => void;
}

export default function SplitModal({ onClose }: SplitModalProps) {
  const arrayBuffer = useArrayBuffer();
  const pageOrder = usePageOrder();
  const fileName = useFileName();

  const [splitMode, setSplitMode] = useState<'range' | 'each' | 'preset'>('range');
  const [pageRange, setPageRange] = useState('1-');
  const [splitSize, setSplitSize] = useState(1);
  const [presetRanges, setPresetRanges] = useState(['1-5', '6-10']);
  const [isSplitting, setIsSplitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // 验证页面范围（使用pageOrder.length因为这是实际的页面数量）
  const rangeValidation = splitMode === 'range' 
    ? validatePageExpr(pageRange, pageOrder.length)
    : { valid: true };

  // 验证预设范围
  const presetValidation = splitMode === 'preset'
    ? presetRanges.every(range => validatePageExpr(range, pageOrder.length).valid)
    : true;

  const handleSplit = useCallback(async () => {
    if (!arrayBuffer || !rangeValidation.valid || !presetValidation) return;

    try {
      setIsSplitting(true);
      setProgress(0);
      setError(null);

      // 首先根据当前pageOrder重新组织PDF（应用删除和排序操作）
      const reorderedPdfDataUint8 = await extractRanges(
        arrayBuffer,
        pageOrder.map(idx => [idx + 1, idx + 1]) // 转为1基范围
      );
      // 转换为ArrayBuffer
      const reorderedPdfData = reorderedPdfDataUint8.slice().buffer;

      let ranges: Array<[number, number]> = [];

      if (splitMode === 'range') {
        // 单一范围拆分（基于重新排序后的页面）
        const pages1Based = parsePageExpr(pageRange, pageOrder.length);
        if (pages1Based.length > 0) {
          ranges = [[pages1Based[0], pages1Based[pages1Based.length - 1]]];
        }
      } else if (splitMode === 'each') {
        // 按指定页数拆分（基于重新排序后的页面）
        for (let i = 0; i < pageOrder.length; i += splitSize) {
          const start = i + 1; // 转为1基
          const end = Math.min(i + splitSize, pageOrder.length);
          ranges.push([start, end]);
        }
      } else if (splitMode === 'preset') {
        // 预设范围拆分（基于重新排序后的页面）
        const presetComputed: Array<[number, number]> = [];
        presetRanges.forEach(range => {
          const pages1Based = parsePageExpr(range, pageOrder.length);
          if (pages1Based.length < 1) return;
          const start = pages1Based[0];
          const end = pages1Based[pages1Based.length - 1];
          presetComputed.push([start, end]);
        });
        ranges = presetComputed;
      }

      // 执行拆分（从重新排序后的PDF中提取）
      const results = [];
      for (let i = 0; i < ranges.length; i++) {
        const [start, end] = ranges[i];
        setProgress((i / ranges.length) * 100);

        const splitData = await extractRanges(reorderedPdfData, [[start, end]]);
        
        const baseName = fileName.replace(/\.pdf$/i, '');
        const filename = generateFilename(
          `${baseName}_part${i + 1}_pages${start}-${end}`,
          'pdf',
          false
        );

        results.push({
          data: splitData,
          filename,
          mimeType: 'application/pdf'
        });
      }

      setProgress(100);

      // 下载所有文件
      results.forEach((file, index) => {
        setTimeout(() => {
          downloadFile(file.data, file.filename, file.mimeType);
        }, index * 100);
      });

      // 延迟关闭模态框
      setTimeout(() => {
        onClose();
      }, 1000);

    } catch (err) {
      setError(err instanceof Error ? err.message : '拆分失败');
    } finally {
      setIsSplitting(false);
    }
  }, [arrayBuffer, splitMode, pageRange, splitSize, presetRanges, pageOrder, fileName, rangeValidation.valid, presetValidation, onClose]);

  const addPresetRange = useCallback(() => {
    setPresetRanges(prev => [...prev, '']);
  }, []);

  const updatePresetRange = useCallback((index: number, value: string) => {
    setPresetRanges(prev => prev.map((range, i) => i === index ? value : range));
  }, []);

  const removePresetRange = useCallback((index: number) => {
    setPresetRanges(prev => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <div className="modal-overlay">
      <div className="modal max-w-lg">
        <div className="modal-header">
          <h2 className="text-lg font-semibold">拆分PDF</h2>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm ml-auto"
            disabled={isSplitting}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="modal-body space-y-4">
          {/* 拆分模式 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              拆分模式
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  className="mr-2"
                  checked={splitMode === 'range'}
                  onChange={() => setSplitMode('range')}
                  disabled={isSplitting}
                />
                <span>按页面范围拆分</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  className="mr-2"
                  checked={splitMode === 'each'}
                  onChange={() => setSplitMode('each')}
                  disabled={isSplitting}
                />
                <span>按固定页数拆分</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  className="mr-2"
                  checked={splitMode === 'preset'}
                  onChange={() => setSplitMode('preset')}
                  disabled={isSplitting}
                />
                <span>自定义多个范围</span>
              </label>
            </div>
          </div>

          {/* 按范围拆分 */}
          {splitMode === 'range' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                页面范围
              </label>
              <input
                type="text"
                className={`input w-full ${!rangeValidation.valid ? 'input-error' : ''}`}
                value={pageRange}
                onChange={(e) => setPageRange(e.target.value)}
                placeholder="例如: 1-10"
                disabled={isSplitting}
              />
              {!rangeValidation.valid && (
                <p className="text-sm text-red-600 mt-1">{rangeValidation.error}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                指定要提取的页面范围
              </p>
            </div>
          )}

          {/* 按固定页数拆分 */}
          {splitMode === 'each' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                每个文件的页数
              </label>
              <input
                type="number"
                min="1"
                max={pageOrder.length}
                className="input w-full"
                value={splitSize}
                onChange={(e) => setSplitSize(Number(e.target.value))}
                disabled={isSplitting}
              />
              <p className="text-xs text-gray-500 mt-1">
                将PDF按指定页数平均拆分，共 {pageOrder.length} 页，
                将拆分为 {Math.ceil(pageOrder.length / splitSize)} 个文件
              </p>
            </div>
          )}

          {/* 自定义多个范围 */}
          {splitMode === 'preset' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  自定义范围
                </label>
                <button
                  onClick={addPresetRange}
                  className="btn btn-ghost btn-sm"
                  disabled={isSplitting}
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  添加范围
                </button>
              </div>
              
              <div className="space-y-2 max-h-40 overflow-auto">
                {presetRanges.map((range, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      className="input flex-1"
                      value={range}
                      onChange={(e) => updatePresetRange(index, e.target.value)}
                      placeholder={`范围 ${index + 1}`}
                      disabled={isSplitting}
                    />
                    <button
                      onClick={() => removePresetRange(index)}
                      className="btn btn-ghost btn-sm text-red-600"
                      disabled={isSplitting || presetRanges.length <= 1}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              
              {!presetValidation && (
                <p className="text-sm text-red-600">有无效的页面范围</p>
              )}
              <p className="text-xs text-gray-500">
                例如: 1-5, 6-10, 15-20
              </p>
            </div>
          )}

          {/* 进度条 */}
          {isSplitting && (
            <div>
              <div className="progress">
                <div className="progress-bar" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-sm text-gray-600 mt-1 text-center">
                拆分中... {Math.round(progress)}%
              </p>
            </div>
          )}

          {/* 错误信息 */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* 预览信息 */}
          {!isSplitting && !error && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-700">
                <strong>预览：</strong>
                {splitMode === 'range' && rangeValidation.valid && (
                  <>将提取页面范围 {pageRange}</>
                )}
                {splitMode === 'each' && (
                  <>将拆分为 {Math.ceil(pageOrder.length / splitSize)} 个文件，每个 {splitSize} 页</>
                )}
                {splitMode === 'preset' && presetValidation && (
                  <>将拆分为 {presetRanges.filter(r => r.trim()).length} 个文件</>
                )}
              </p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            onClick={onClose}
            className="btn btn-secondary"
            disabled={isSplitting}
          >
            取消
          </button>
          <button
            onClick={handleSplit}
            className="btn btn-primary"
            disabled={!rangeValidation.valid || !presetValidation || isSplitting}
          >
            {isSplitting ? '拆分中...' : '开始拆分'}
          </button>
        </div>
      </div>
    </div>
  );
}
