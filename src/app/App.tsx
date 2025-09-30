import { useCallback } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import ThumbnailList from '@/components/ThumbnailList';
import CanvasViewer from '@/components/CanvasViewer';
import Toolbar from '@/components/Toolbar';
import FileDropZone from '@/components/FileDropZone';
import ErrorBoundary from '@/components/ErrorBoundary';
import LoadingOverlay from '@/components/LoadingOverlay';
import { useProjectStore, useHasFile, useIsLoading, useError } from '@/store/useProjectStore';

export default function App() {
  const { openFile, clearError } = useProjectStore();
  const hasFile = useHasFile();
  const isLoading = useIsLoading();
  const error = useError();

  const handleFileSelect = useCallback(async (file: File) => {
    await openFile(file);
  }, [openFile]);

  return (
    <ErrorBoundary>
      <DndProvider backend={HTML5Backend}>
        <div className="h-screen flex flex-col bg-gray-50">
          {/* 头部工具栏 */}
          <header className="flex-shrink-0">
            <Toolbar onFileSelect={handleFileSelect} />
          </header>

          {/* 主要内容区域 */}
          <main className="flex-1 flex min-h-0">
            {hasFile ? (
              <>
                {/* 左侧缩略图面板 */}
                <aside className="w-80 flex-shrink-0 border-r border-gray-200 bg-white">
                  <ThumbnailList />
                </aside>

                {/* 右侧画布区域 */}
                <section className="flex-1 relative">
                  <CanvasViewer />
                </section>
              </>
            ) : (
              /* 文件拖拽区域 */
              <div className="flex-1 flex items-center justify-center">
                <FileDropZone 
                  onFileSelect={handleFileSelect}
                  className="w-full max-w-2xl mx-8"
                />
              </div>
            )}
          </main>

          {/* 错误提示 */}
          {error && (
            <div className="fixed top-4 right-4 z-50">
              <div className="toast toast-error flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
                <button 
                  onClick={clearError}
                  className="ml-2 text-white hover:text-gray-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* 加载覆盖层 */}
          {isLoading && <LoadingOverlay />}
        </div>
      </DndProvider>
    </ErrorBoundary>
  );
}
