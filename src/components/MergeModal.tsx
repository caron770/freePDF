import { useState, useCallback, useRef } from 'react';
import { downloadFile, generateFilename, validatePdfFile } from '@/utils/file';
import { loadPdfMeta, validatePdfBuffer } from '@/core/pdfLoader';
import { extractRanges, mergePdfs } from '@/core/pdfEdit';
import type { PdfPageMeta } from '@/core/types';

interface MergeModalProps {
  onClose: () => void;
}

interface PdfFileInfo {
  id: string;
  name: string;
  size: number;
  arrayBuffer: ArrayBuffer;
  pages: PdfPageMeta[];
  selectedPages: Set<number>; // 0基索引
}

export default function MergeModal({ onClose }: MergeModalProps) {
  const [files, setFiles] = useState<PdfFileInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 添加PDF文件
  const handleAddFiles = useCallback(async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const newFiles: PdfFileInfo[] = [];

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        
        // 验证文件
        const validation = validatePdfFile(file);
        if (!validation.valid) {
          throw new Error(`${file.name}: ${validation.error}`);
        }

        // 读取文件
        const arrayBuffer = await file.arrayBuffer();
        
        // 验证PDF内容
        const isValidPdf = await validatePdfBuffer(arrayBuffer.slice(0));
        if (!isValidPdf) {
          throw new Error(`${file.name}: 不是有效的PDF格式`);
        }

        // 加载页面元数据
        const { pages } = await loadPdfMeta(arrayBuffer.slice(0));

        newFiles.push({
          id: `${Date.now()}_${i}`,
          name: file.name,
          size: file.size,
          arrayBuffer,
          pages,
          selectedPages: new Set(pages.map((_, idx) => idx)), // 默认全选
        });
      }

      setFiles(prev => [...prev, ...newFiles]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '文件加载失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 删除文件
  const handleRemoveFile = useCallback((fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  // 切换页面选择
  const handleTogglePage = useCallback((fileId: string, pageIndex: number) => {
    setFiles(prev => prev.map(file => {
      if (file.id !== fileId) return file;
      const newSelectedPages = new Set(file.selectedPages);
      if (newSelectedPages.has(pageIndex)) {
        newSelectedPages.delete(pageIndex);
      } else {
        newSelectedPages.add(pageIndex);
      }
      return { ...file, selectedPages: newSelectedPages };
    }));
  }, []);

  // 全选/取消全选
  const handleToggleAllPages = useCallback((fileId: string) => {
    setFiles(prev => prev.map(file => {
      if (file.id !== fileId) return file;
      const allSelected = file.selectedPages.size === file.pages.length;
      return {
        ...file,
        selectedPages: allSelected 
          ? new Set<number>() 
          : new Set(file.pages.map((_, idx) => idx))
      };
    }));
  }, []);

  // 上移文件
  const handleMoveFileUp = useCallback((index: number) => {
    if (index === 0) return;
    setFiles(prev => {
      const newFiles = [...prev];
      [newFiles[index - 1], newFiles[index]] = [newFiles[index], newFiles[index - 1]];
      return newFiles;
    });
  }, []);

  // 下移文件
  const handleMoveFileDown = useCallback((index: number) => {
    setFiles(prev => {
      if (index === prev.length - 1) return prev;
      const newFiles = [...prev];
      [newFiles[index], newFiles[index + 1]] = [newFiles[index + 1], newFiles[index]];
      return newFiles;
    });
  }, []);

  // 合并并导出
  const handleMerge = useCallback(async () => {
    if (files.length === 0) return;

    try {
      setIsMerging(true);
      setProgress(0);
      setError(null);

      const pdfBuffers: ArrayBuffer[] = [];
      let processedFiles = 0;

      for (const file of files) {
        const selectedPageIndices = Array.from(file.selectedPages).sort((a, b) => a - b);
        
        if (selectedPageIndices.length > 0) {
          // 提取选中的页面
          const selectedPdf = await extractRanges(
            file.arrayBuffer,
            selectedPageIndices.map(idx => [idx + 1, idx + 1]) // 转为1基
          );
          pdfBuffers.push(selectedPdf.slice().buffer);
        }

        processedFiles++;
        setProgress((processedFiles / files.length) * 90);
      }

      if (pdfBuffers.length === 0) {
        throw new Error('请至少选择一个页面');
      }

      // 合并所有PDF
      setProgress(90);
      const mergedPdf = await mergePdfs(pdfBuffers);
      setProgress(100);

      // 下载
      const filename = generateFilename('merged', 'pdf');
      downloadFile(mergedPdf, filename, 'application/pdf');

      // 延迟关闭
      setTimeout(() => {
        onClose();
      }, 1000);

    } catch (err) {
      console.error('[MergeModal] handleMerge error', err);
      setError(err instanceof Error ? err.message : '合并失败');
    } finally {
      setIsMerging(false);
    }
  }, [files, onClose]);

  // 计算总页数
  const totalSelectedPages = files.reduce((sum, file) => sum + file.selectedPages.size, 0);

  return (
    <div className="modal-overlay">
      <div className="modal max-w-4xl">
        <div className="modal-header">
          <h2 className="text-lg font-semibold">合并PDF文件</h2>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm ml-auto"
            disabled={isLoading || isMerging}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="modal-body space-y-4">
          {/* 添加文件按钮 */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">
                已添加 {files.length} 个文件，共选择 {totalSelectedPages} 页
              </p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-primary btn-sm"
              disabled={isLoading || isMerging}
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M12 4v16m8-8H4" />
              </svg>
              添加PDF文件
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="sr-only"
              onChange={(e) => handleAddFiles(e.target.files)}
            />
          </div>

          {/* 文件列表 */}
          {files.length > 0 ? (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {files.map((file, fileIndex) => (
                <div key={file.id} className="border rounded-lg p-3 bg-gray-50">
                  {/* 文件头部 */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate">{file.name}</h3>
                      <p className="text-xs text-gray-500">
                        {file.pages.length} 页 | 已选 {file.selectedPages.size} 页
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-1 ml-2">
                      {/* 上移 */}
                      <button
                        onClick={() => handleMoveFileUp(fileIndex)}
                        disabled={fileIndex === 0 || isMerging}
                        className="btn btn-ghost btn-xs"
                        title="上移"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      
                      {/* 下移 */}
                      <button
                        onClick={() => handleMoveFileDown(fileIndex)}
                        disabled={fileIndex === files.length - 1 || isMerging}
                        className="btn btn-ghost btn-xs"
                        title="下移"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      
                      {/* 全选/取消全选 */}
                      <button
                        onClick={() => handleToggleAllPages(file.id)}
                        className="btn btn-ghost btn-xs"
                        disabled={isMerging}
                        title={file.selectedPages.size === file.pages.length ? "取消全选" : "全选"}
                      >
                        {file.selectedPages.size === file.pages.length ? (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                  d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        ) : (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                  d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      
                      {/* 删除文件 */}
                      <button
                        onClick={() => handleRemoveFile(file.id)}
                        className="btn btn-ghost btn-xs text-red-600"
                        disabled={isMerging}
                        title="删除"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* 页面选择器 */}
                  <div className="flex flex-wrap gap-1">
                    {file.pages.map((page, pageIndex) => (
                      <button
                        key={pageIndex}
                        onClick={() => handleTogglePage(file.id, pageIndex)}
                        disabled={isMerging}
                        className={`
                          px-2 py-1 text-xs rounded border transition-colors
                          ${file.selectedPages.has(pageIndex)
                            ? 'bg-blue-500 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                          }
                        `}
                      >
                        {pageIndex + 1}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} 
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <p>请添加PDF文件开始合并</p>
            </div>
          )}

          {/* 进度条 */}
          {isMerging && (
            <div>
              <div className="progress">
                <div className="progress-bar" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-sm text-gray-600 mt-1 text-center">
                合并中... {Math.round(progress)}%
              </p>
            </div>
          )}

          {/* 错误信息 */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* 提示信息 */}
          {!isMerging && !error && files.length > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-700">
                <strong>提示：</strong>点击页码选择/取消选择页面，使用上下箭头调整文件顺序
              </p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            onClick={onClose}
            className="btn btn-secondary"
            disabled={isLoading || isMerging}
          >
            取消
          </button>
          <button
            onClick={handleMerge}
            className="btn btn-primary"
            disabled={files.length === 0 || totalSelectedPages === 0 || isLoading || isMerging}
          >
            {isMerging ? '合并中...' : `合并并导出 (${totalSelectedPages} 页)`}
          </button>
        </div>
      </div>
    </div>
  );
}

