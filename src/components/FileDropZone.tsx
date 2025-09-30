import React, { useCallback, useState } from 'react';
import { validatePdfFile, supportsFileSystemAccess, openFileWithFSA } from '@/utils/file';

interface FileDropZoneProps {
  onFileSelect: (file: File) => void;
  className?: string;
}

export default function FileDropZone({ onFileSelect, className = '' }: FileDropZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);

  const handleFileSelection = useCallback((file: File) => {
    const validation = validatePdfFile(file);
    if (!validation.valid) {
      setDragError(validation.error || '文件无效');
      return;
    }
    
    setDragError(null);
    onFileSelect(file);
  }, [onFileSelect]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
    setDragError(null);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 只有当离开整个拖拽区域时才设置为false
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragActive(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    const pdfFile = files.find(file => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
    
    if (!pdfFile) {
      setDragError('请拖拽PDF文件');
      return;
    }

    if (files.length > 1) {
      setDragError('一次只能处理一个PDF文件');
      return;
    }

    handleFileSelection(pdfFile);
  }, [handleFileSelection]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelection(file);
    }
    // 清除input值，允许重新选择同一个文件
    e.target.value = '';
  }, [handleFileSelection]);

  const handleFSAOpen = useCallback(async () => {
    try {
      const file = await openFileWithFSA();
      if (file) {
        handleFileSelection(file);
      }
    } catch (error) {
      setDragError(error instanceof Error ? error.message : '文件选择失败');
    }
  }, [handleFileSelection]);

  return (
    <div className={className}>
      <div
        className={`
          border-2 border-dashed rounded-lg p-12 text-center transition-all duration-200
          ${isDragActive 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
          }
        `}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* 图标 */}
        <div className="mb-4">
          <svg 
            className={`mx-auto h-16 w-16 ${isDragActive ? 'text-blue-500' : 'text-gray-400'}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" 
            />
          </svg>
        </div>

        {/* 标题和描述 */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            选择或拖拽PDF文件
          </h3>
          <p className="text-gray-600">
            支持最大100MB的PDF文件
          </p>
        </div>

        {/* 按钮组 */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
          {/* 文件输入按钮 */}
          <label className="btn btn-primary cursor-pointer">
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleFileInput}
              className="sr-only"
            />
            选择文件
          </label>

          {/* 文件系统访问API按钮 */}
          {supportsFileSystemAccess() && (
            <button
              onClick={handleFSAOpen}
              className="btn btn-secondary"
            >
              浏览文件
            </button>
          )}
        </div>

        {/* 文件格式说明 */}
        <div className="mt-6 text-sm text-gray-500">
          <p>支持的格式：PDF</p>
          <p>文件大小限制：100MB</p>
        </div>

        {/* 错误信息 */}
        {dragError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-red-700">{dragError}</span>
            </div>
          </div>
        )}

        {/* 功能特性说明 */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-3">功能特性</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
            <div className="flex items-center">
              <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              页面删除和重排
            </div>
            <div className="flex items-center">
              <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              区域裁剪
            </div>
            <div className="flex items-center">
              <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              导出图片
            </div>
            <div className="flex items-center">
              <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              导出SVG
            </div>
            <div className="flex items-center">
              <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              纯前端处理
            </div>
            <div className="flex items-center">
              <svg className="w-4 h-4 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              无需上传
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}