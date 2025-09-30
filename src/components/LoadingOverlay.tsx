interface LoadingOverlayProps {
  message?: string;
  progress?: number;
  onCancel?: () => void;
}

export default function LoadingOverlay({ 
  message = '正在处理...', 
  progress,
  onCancel 
}: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
        {/* 加载图标 */}
        <div className="flex items-center justify-center mb-4">
          <div className="loading-spinner w-8 h-8 text-blue-600"></div>
        </div>

        {/* 加载消息 */}
        <div className="text-center mb-4">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {message}
          </h3>
          
          {/* 进度条 */}
          {typeof progress === 'number' && (
            <div className="mb-2">
              <div className="progress">
                <div 
                  className="progress-bar" 
                  style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {Math.round(progress)}%
              </p>
            </div>
          )}
        </div>

        {/* 取消按钮 */}
        {onCancel && (
          <div className="flex justify-center">
            <button
              onClick={onCancel}
              className="btn btn-secondary btn-sm"
            >
              取消
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
