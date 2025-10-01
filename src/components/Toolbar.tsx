import { useCallback, useState, ChangeEvent } from 'react';
import {
  useProjectStore,
  useHasFile,
  useFileName,
  useFileSize,
  useSelection,
  useCanDelete,
  usePageCount,
  useArrayBuffer
} from '@/store/useProjectStore';
import { formatFileSize, downloadFile } from '@/utils/file';
import ExportModal from './ExportModal';
import SplitModal from './SplitModal';
import MergeModal from './MergeModal';

interface ToolbarProps {
  onFileSelect: (file: File) => void;
}

export default function Toolbar({ onFileSelect }: ToolbarProps) {
  const {
    closeFile,
    deletePages: deleteSelectedPages,
    clearSelection,
    selectAllPages,
  } = useProjectStore();

  const hasFile = useHasFile();
  const fileName = useFileName();
  const fileSize = useFileSize();
  const selection = useSelection();
  const canDelete = useCanDelete();
  const pageCount = usePageCount();
  const arrayBuffer = useArrayBuffer();

  const [showExportModal, setShowExportModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);

  const handleFileInput = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await onFileSelect(file);
    }
    e.target.value = '';
  }, [onFileSelect]);

  const handleDeleteSelected = useCallback(() => {
    if (canDelete && selection.size > 0) {
      const selectedIndices = Array.from(selection);
      deleteSelectedPages(selectedIndices);
      clearSelection();
    }
  }, [canDelete, selection, deleteSelectedPages, clearSelection]);

  const handleSelectAll = useCallback(() => {
    selectAllPages();
  }, [selectAllPages]);

  const handleClearSelection = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  const handleDownloadOriginal = useCallback(() => {
    if (arrayBuffer && fileName) {
      downloadFile(arrayBuffer, fileName, 'application/pdf');
    }
  }, [arrayBuffer, fileName]);

  return (
    <>
      <div className="toolbar">
        {/* 文件操作组 */}
        <div className="toolbar-group">
          <label className="btn btn-primary cursor-pointer">
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleFileInput}
              className="sr-only"
            />
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            {hasFile ? '更换文件' : '打开文件'}
          </label>

          {hasFile && (
            <button
              onClick={closeFile}
              className="btn btn-ghost"
              title="关闭文件"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {hasFile && (
          <>
            <div className="toolbar-separator" />

            {/* 文件信息 */}
            <div className="flex items-center text-sm text-gray-600">
              <span className="font-medium">{fileName}</span>
              <span className="ml-2 text-gray-400">({formatFileSize(fileSize)})</span>
              <span className="ml-2 text-gray-400">{pageCount} 页</span>
            </div>

            <div className="toolbar-separator" />

            {/* 选择操作组 */}
            <div className="toolbar-group">
              <button
                onClick={handleSelectAll}
                className="btn btn-ghost btn-sm"
                disabled={selection.size === pageCount}
              >
                全选
              </button>
              
              <button
                onClick={handleClearSelection}
                className="btn btn-ghost btn-sm"
                disabled={selection.size === 0}
              >
                清除选择
              </button>

              {selection.size > 0 && (
                <span className="text-sm text-gray-600 ml-2">
                  已选择 {selection.size} 页
                </span>
              )}
            </div>

            <div className="toolbar-separator" />

            {/* 编辑操作组 */}
            <div className="toolbar-group">
              <button
                onClick={handleDeleteSelected}
                className="btn btn-danger btn-sm"
                disabled={!canDelete}
                title={canDelete ? '删除选中的页面' : '无法删除所有页面'}
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                删除
              </button>

              <button
                onClick={() => setShowSplitModal(true)}
                className="btn btn-secondary btn-sm"
                disabled={pageCount === 0}
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                </svg>
                拆分
              </button>
            </div>

            <div className="toolbar-separator" />

            {/* 导出操作组 */}
            <div className="toolbar-group">
              <button
                onClick={() => setShowExportModal(true)}
                className="btn btn-primary btn-sm"
                disabled={pageCount === 0}
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                导出
              </button>

              <button
                onClick={handleDownloadOriginal}
                className="btn btn-ghost btn-sm"
                title="下载原始PDF文件"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                下载原文件
              </button>
            </div>

            <div className="toolbar-separator" />

            {/* 合并PDF */}
            <div className="toolbar-group">
              <button
                onClick={() => setShowMergeModal(true)}
                className="btn btn-secondary btn-sm"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                合并PDF
              </button>
            </div>

            {/* 右侧状态信息 */}
            <div className="ml-auto flex items-center text-sm text-gray-500">
              <svg className="w-4 h-4 mr-1 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              本地处理，数据安全
            </div>
          </>
        )}
      </div>

      {/* 导出模态框 */}
      {showExportModal && (
        <ExportModal
          onClose={() => setShowExportModal(false)}
        />
      )}

      {/* 拆分模态框 */}
      {showSplitModal && (
        <SplitModal
          onClose={() => setShowSplitModal(false)}
        />
      )}

      {/* 合并模态框 */}
      {showMergeModal && (
        <MergeModal
          onClose={() => setShowMergeModal(false)}
        />
      )}
    </>
  );
}
