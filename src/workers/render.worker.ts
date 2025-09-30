import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import pdfjsWorkerSrc from 'pdfjs-dist/legacy/build/pdf.worker.min.js?url';
import type { WorkerMessage, WorkerResponse, RenderTask } from '@/core/types';

// 设置PDF.js worker路径
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerSrc;

// 缓存已加载的PDF文档
const documentCache = new Map<string, any>();

/**
 * 生成ArrayBuffer的简单哈希
 */
function hashArrayBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hash = 0;
  for (let i = 0; i < Math.min(bytes.length, 1000); i++) {
    hash = ((hash << 5) - hash + bytes[i]) & 0xffffffff;
  }
  return hash.toString(36);
}

/**
 * 获取或加载PDF文档
 */
async function getDocument(arrayBuffer: ArrayBuffer) {
  const hash = hashArrayBuffer(arrayBuffer);
  
  if (!documentCache.has(hash)) {
    const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    documentCache.set(hash, doc);
  }
  
  return documentCache.get(hash);
}

/**
 * 渲染页面为ImageBitmap
 */
async function renderPageToBitmap(
  arrayBuffer: ArrayBuffer,
  pageIndex: number,
  scale: number
): Promise<ImageBitmap> {
  const doc = await getDocument(arrayBuffer);
  const page = await doc.getPage(pageIndex + 1); // PDF.js使用1基索引
  
  const viewport = page.getViewport({ scale });
  
  // 使用OffscreenCanvas
  const canvas = new OffscreenCanvas(viewport.width, viewport.height);
  const context = canvas.getContext('2d');
  
  if (!context) {
    throw new Error('无法获取OffscreenCanvas 2D上下文');
  }
  
  // 渲染页面
  await page.render({
    canvasContext: context,
    viewport: viewport,
  }).promise;
  
  return canvas.transferToImageBitmap();
}

/**
 * 渲染页面为SVG字符串
 */
let workerSvgGraphicsCtor: any | null = null;
type WorkerSvgLoader = () => Promise<any>;
const workerSvgLoaders: WorkerSvgLoader[] = [
  async () => (pdfjsLib as any).SVGGraphics,
  async () => {
    const legacy = await import('pdfjs-dist/legacy/build/pdf.js');
    return legacy?.SVGGraphics ?? legacy?.default?.SVGGraphics;
  },
  async () => {
    const base = await import('pdfjs-dist/build/pdf.js');
    return base?.SVGGraphics ?? base?.default?.SVGGraphics;
  },
];

async function ensureWorkerSvgGraphics(): Promise<any> {
  if (workerSvgGraphicsCtor) {
    return workerSvgGraphicsCtor;
  }

  for (const loader of workerSvgLoaders) {
    try {
      const ctor = await loader();
      if (ctor) {
        workerSvgGraphicsCtor = ctor;
        break;
      }
    } catch (error) {
      console.warn('Worker加载SVGGraphics失败:', error);
    }
  }

  if (!workerSvgGraphicsCtor) {
    throw new Error('当前环境不支持SVG导出');
  }

  return workerSvgGraphicsCtor;
}

async function renderPageToSVG(
  arrayBuffer: ArrayBuffer,
  pageIndex: number,
  scale: number = 1.0
): Promise<string> {
  const doc = await getDocument(arrayBuffer);
  const page = await doc.getPage(pageIndex + 1);
  
  const viewport = page.getViewport({ scale });
  const opList = await page.getOperatorList();
  
  const SVGGraphics = await ensureWorkerSvgGraphics();

  // 创建SVG渲染器
  const svgGfx = new SVGGraphics(page.commonObjs, page.objs);
  svgGfx.embedFonts = true;
  
  const svg = await svgGfx.getSVG(opList, viewport);
  
  // 转换为字符串
  const serializer = new XMLSerializer();
  return serializer.serializeToString(svg);
}

/**
 * 批量渲染页面
 */
async function renderMultiplePages(
  arrayBuffer: ArrayBuffer,
  tasks: RenderTask[]
): Promise<(ImageBitmap | string)[]> {
  const results: (ImageBitmap | string)[] = [];
  
  for (const task of tasks) {
    try {
      let result: ImageBitmap | string;
      
      if (task.type === 'export' && task.format === 'svg') {
        result = await renderPageToSVG(arrayBuffer, task.page, task.scale);
      } else {
        result = await renderPageToBitmap(arrayBuffer, task.page, task.scale);
      }
      
      results.push(result);
    } catch (error) {
      console.error(`渲染页面 ${task.page} 失败:`, error);
      throw error;
    }
  }
  
  return results;
}

// 处理主线程消息
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { id, type, payload } = event.data;
  
  try {
    let result: any;
    
    switch (type) {
      case 'render': {
        const { arrayBuffer, pageIndex, scale, format } = payload;
        
        if (format === 'svg') {
          result = await renderPageToSVG(arrayBuffer, pageIndex, scale);
        } else {
          result = await renderPageToBitmap(arrayBuffer, pageIndex, scale);
        }
        break;
      }
      
      case 'export': {
        const { arrayBuffer, tasks } = payload;
        result = await renderMultiplePages(arrayBuffer, tasks);
        break;
      }
      
      case 'load': {
        const { arrayBuffer } = payload;
        const doc = await getDocument(arrayBuffer);
        result = {
          pageCount: doc.numPages,
          loaded: true,
        };
        break;
      }
      
      default:
        throw new Error(`未知的worker消息类型: ${type}`);
    }
    
    // 发送成功响应
    const response: WorkerResponse = {
      id,
      success: true,
      data: result,
    };
    
    // 如果结果包含ImageBitmap，需要传输所有权
    const transferable: Transferable[] = [];
    if (result instanceof ImageBitmap) {
      transferable.push(result);
    } else if (Array.isArray(result)) {
      result.forEach(item => {
        if (item instanceof ImageBitmap) {
          transferable.push(item);
        }
      });
    }
    
    self.postMessage(response, transferable);
    
  } catch (error) {
    // 发送错误响应
    const response: WorkerResponse = {
      id,
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    };
    
    self.postMessage(response);
  }
};

// 清理缓存的定时器
let cacheCleanupTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleCleanup() {
  if (cacheCleanupTimer) {
    clearTimeout(cacheCleanupTimer);
  }
  
  cacheCleanupTimer = setTimeout(() => {
    // 清理缓存
    documentCache.clear();
    console.log('Worker缓存已清理');
  }, 5 * 60 * 1000); // 5分钟后清理
}

// 每次处理消息后重新调度清理
self.addEventListener('message', () => {
  scheduleCleanup();
});

export {}; // 确保这是一个模块
