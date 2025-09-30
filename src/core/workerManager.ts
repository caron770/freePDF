import type { WorkerMessage, WorkerResponse, RenderTask } from './types';
import { renderPageToImageBitmap, renderPageToSVG, getPdfDocument } from './pdfLoader';

const supportsOffscreenCanvas = typeof window !== 'undefined' && typeof OffscreenCanvas !== 'undefined';
const cloneForPdf = (buffer: ArrayBuffer | Uint8Array): Uint8Array => {
  const view = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return view.slice();
};
const debug = (message: string, context: Record<string, unknown> = {}): void => {
  if (typeof console !== 'undefined' && console.log) {
    console.log(`[workerManager] ${message}`, context);
  }
};

export class WorkerManager {
  private worker: Worker | null = null;
  private messageId = 0;
  private pendingMessages = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>();
  private workerSupported = supportsOffscreenCanvas;
  private workerFailed = false;

  /**
   * 初始化Worker
   */
  private async initWorker(): Promise<Worker> {
    if (this.worker) {
      return this.worker;
    }

    // 创建Worker
    this.worker = new Worker(
      new URL('../workers/render.worker.ts', import.meta.url),
      { type: 'module' }
    );

    // 监听Worker消息
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const { id, success, data, error } = event.data;
      const pending = this.pendingMessages.get(id);
      
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingMessages.delete(id);
        
        if (success) {
          pending.resolve(data);
        } else {
          pending.reject(new Error(error || '未知错误'));
        }
      }
    };

    // 监听Worker错误
    this.worker.onerror = (error) => {
      console.error('Worker错误:', error);
      this.cleanup();
    };

    return this.worker;
  }

  /**
   * 发送消息到Worker
   */
  private async sendMessage<T>(
    type: WorkerMessage['type'],
    payload: any,
    timeout = 30000
  ): Promise<T> {
    if (!this.workerSupported || this.workerFailed) {
      throw new Error('WORKER_UNAVAILABLE');
    }

    const worker = await this.initWorker();
    const id = `msg_${++this.messageId}_${Date.now()}`;
    
    return new Promise((resolve, reject) => {
      // 设置超时
      const timeoutId = setTimeout(() => {
        this.pendingMessages.delete(id);
        reject(new Error('Worker操作超时'));
      }, timeout);

      // 保存待处理消息
      this.pendingMessages.set(id, {
        resolve,
        reject,
        timeout: timeoutId,
      });

      // 发送消息
      const message: WorkerMessage = { id, type, payload };
      worker.postMessage(message);
    });
  }

  /**
   * 渲染单个页面
   */
  async renderPage(
    arrayBuffer: ArrayBuffer,
    pageIndex: number,
    scale: number,
    format: 'bitmap' | 'svg' = 'bitmap'
  ): Promise<ImageBitmap | string> {
    debug('renderPage.request', { pageIndex, scale, format, workerSupported: this.workerSupported, workerFailed: this.workerFailed });
    if (!this.workerSupported || this.workerFailed) {
      return this.renderPageLocally(arrayBuffer, pageIndex, scale, format);
    }

    try {
      return await this.sendMessage('render', {
        arrayBuffer: cloneForPdf(arrayBuffer),
        pageIndex,
        scale,
        format,
      });
    } catch (error) {
      console.warn('Worker render failed, falling back to main thread rendering.', error);
      debug('renderPage.workerError', {
        error: error instanceof Error ? error.message : String(error)
      });
      this.workerFailed = true;
      return this.renderPageLocally(arrayBuffer, pageIndex, scale, format);
    }
  }

  /**
   * 批量导出页面
   */
  async exportPages(
    arrayBuffer: ArrayBuffer,
    tasks: RenderTask[]
  ): Promise<(ImageBitmap | string)[]> {
    debug('exportPages.request', { taskCount: tasks.length, formats: Array.from(new Set(tasks.map(t => t.format))) });
    const requiresDom = tasks.some(task => task.format === 'svg');
    if (requiresDom) {
      return this.exportPagesLocally(arrayBuffer, tasks);
    }

    if (!this.workerSupported || this.workerFailed) {
      return this.exportPagesLocally(arrayBuffer, tasks);
    }

    try {
      return await this.sendMessage('export', {
        arrayBuffer: cloneForPdf(arrayBuffer),
        tasks,
      }, 60000); // 导出可能需要更长时间
    } catch (error) {
      console.warn('Worker export failed, falling back to main thread rendering.', error);
      debug('exportPages.workerError', {
        error: error instanceof Error ? error.message : String(error)
      });
      this.workerFailed = true;
      return this.exportPagesLocally(arrayBuffer, tasks);
    }
  }

  /**
   * 预加载PDF文档
   */
  async loadDocument(arrayBuffer: ArrayBuffer): Promise<{ pageCount: number; loaded: boolean }> {
    if (!this.workerSupported || this.workerFailed) {
      return this.loadDocumentLocally(arrayBuffer);
    }

    try {
      return await this.sendMessage('load', {
        arrayBuffer: cloneForPdf(arrayBuffer),
      });
    } catch (error) {
      console.warn('Worker load failed, falling back to main thread.', error);
      debug('loadDocument.workerError', {
        error: error instanceof Error ? error.message : String(error)
      });
      this.workerFailed = true;
      return this.loadDocumentLocally(arrayBuffer);
    }
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    // 清理所有待处理的消息
    this.pendingMessages.forEach(({ timeout, reject }) => {
      clearTimeout(timeout);
      reject(new Error('Worker已被清理'));
    });
    this.pendingMessages.clear();

    // 终止Worker
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  /**
   * 检查Worker是否可用
   */
  isAvailable(): boolean {
    return this.worker !== null;
  }

  /**
   * 获取待处理任务数量
   */
  getPendingTaskCount(): number {
    return this.pendingMessages.size;
  }

  private async renderPageLocally(
    arrayBuffer: ArrayBuffer,
    pageIndex: number,
    scale: number,
    format: 'bitmap' | 'svg'
  ): Promise<ImageBitmap | string> {
    const buffer = cloneForPdf(arrayBuffer);
    debug('renderPageLocally', { pageIndex, scale, format, length: buffer.length });
    if (format === 'svg') {
      return renderPageToSVG(buffer, pageIndex, scale);
    }
    return renderPageToImageBitmap(buffer, pageIndex, scale);
  }

  private async exportPagesLocally(
    arrayBuffer: ArrayBuffer,
    tasks: RenderTask[]
  ): Promise<(ImageBitmap | string)[]> {
    const results: (ImageBitmap | string)[] = [];

    for (const task of tasks) {
      debug('exportPagesLocally.task', { page: task.page, format: task.format, scale: task.scale });
      if (task.format === 'svg') {
        results.push(await renderPageToSVG(cloneForPdf(arrayBuffer), task.page, task.scale));
      } else {
        results.push(await renderPageToImageBitmap(cloneForPdf(arrayBuffer), task.page, task.scale));
      }
    }

    return results;
  }

  private async loadDocumentLocally(arrayBuffer: ArrayBuffer): Promise<{ pageCount: number; loaded: boolean }> {
    debug('loadDocumentLocally');
    const doc = await getPdfDocument(cloneForPdf(arrayBuffer));
    return {
      pageCount: doc.numPages,
      loaded: true,
    };
  }
}

// 全局Worker管理器实例
export const workerManager = new WorkerManager();

// 页面卸载时清理
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    workerManager.cleanup();
  });
}
