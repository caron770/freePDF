/**
 * 文件下载
 */
export function downloadFile(
  data: ArrayBuffer | Uint8Array | string,
  filename: string,
  mimeType: string
): void {
  const normalizeBuffer = (value: ArrayBuffer | Uint8Array): ArrayBuffer => {
    if (value instanceof Uint8Array) {
      return value.slice().buffer;
    }
    return new Uint8Array(value).slice().buffer;
  };

  const part: BlobPart = typeof data === 'string'
    ? data
    : normalizeBuffer(data);

  const blob = new Blob([part], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // 清理URL对象
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * 批量下载文件（打包为ZIP或分别下载）
 */
export function downloadFiles(
  files: Array<{ data: ArrayBuffer | Uint8Array | string; filename: string; mimeType: string }>
): void {
  // 简单实现：分别下载每个文件
  files.forEach((file, index) => {
    setTimeout(() => {
      downloadFile(file.data, file.filename, file.mimeType);
    }, index * 100); // 避免同时下载太多文件
  });
}

/**
 * 读取文件为ArrayBuffer
 */
export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * 验证文件类型
 */
export function validatePdfFile(file: File): { valid: boolean; error?: string } {
  // 检查文件扩展名
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return { valid: false, error: '请选择PDF文件' };
  }
  
  // 检查MIME类型
  if (file.type && file.type !== 'application/pdf') {
    return { valid: false, error: '文件类型不正确，请选择PDF文件' };
  }
  
  // 检查文件大小（限制为100MB）
  const maxSize = 100 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: '文件过大，请选择小于100MB的PDF文件' };
  }
  
  if (file.size === 0) {
    return { valid: false, error: '文件为空' };
  }
  
  return { valid: true };
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * 生成文件名（带时间戳）
 */
export function generateFilename(
  baseName: string,
  extension: string,
  includeTimestamp = true
): string {
  const cleanBaseName = baseName.replace(/\.[^/.]+$/, ''); // 移除扩展名
  
  if (includeTimestamp) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    return `${cleanBaseName}_${timestamp}.${extension}`;
  }
  
  return `${cleanBaseName}.${extension}`;
}

/**
 * 检查浏览器是否支持文件系统访问API
 */
export function supportsFileSystemAccess(): boolean {
  return 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;
}

/**
 * 使用文件系统访问API打开文件（如果支持）
 */
export async function openFileWithFSA(): Promise<File | null> {
  if (!supportsFileSystemAccess()) {
    throw new Error('浏览器不支持文件系统访问API');
  }
  
  try {
    const [fileHandle] = await (window as any).showOpenFilePicker({
      types: [
        {
          description: 'PDF files',
          accept: {
            'application/pdf': ['.pdf'],
          },
        },
      ],
      excludeAcceptAllOption: true,
      multiple: false,
    });
    
    return await fileHandle.getFile();
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return null; // 用户取消
    }
    throw error;
  }
}

/**
 * 使用文件系统访问API保存文件（如果支持）
 */
export async function saveFileWithFSA(
  data: ArrayBuffer | Uint8Array,
  suggestedName: string,
  mimeType: string
): Promise<boolean> {
  if (!supportsFileSystemAccess()) {
    throw new Error('浏览器不支持文件系统访问API');
  }
  
  try {
    const fileHandle = await (window as any).showSaveFilePicker({
      suggestedName,
      types: [
        {
          description: 'Files',
          accept: {
            [mimeType]: [`.${suggestedName.split('.').pop()}`],
          },
        },
      ],
    });
    
    const writable = await fileHandle.createWritable();
    await writable.write(data);
    await writable.close();
    
    return true;
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return false; // 用户取消
    }
    throw error;
  }
}
