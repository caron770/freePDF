import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import pdfjsWorkerSrc from 'pdfjs-dist/legacy/build/pdf.worker.min.js?url';
import type { PdfPageMeta } from './types';

const debug = (message: string, context: Record<string, unknown> = {}): void => {
  if (typeof console !== 'undefined' && console.log) {
    console.log(`[pdfLoader] ${message}`, context);
  }
};

// 使用打包后的worker脚本，避免跨域或离线加载失败
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerSrc;

/**
 * 加载PDF并提取页面元数据
 */
export async function loadPdfMeta(arrayBuffer: ArrayBuffer | Uint8Array): Promise<{ pages: PdfPageMeta[] }> {
  try {
    const data = toUint8Array(arrayBuffer);
    debug('loadPdfMeta.getDocument', { length: data.length });
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const pages: PdfPageMeta[] = [];
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.0 });
      
      // 获取页面盒子信息
      const mediaBox = page.getViewport({ scale: 1.0 }).viewBox;
      const cropBox = page.view; // PDF页面的裁剪盒子
      
      const pageMeta: PdfPageMeta = {
        index: i - 1, // 转为0基索引
        width: viewport.width,
        height: viewport.height,
        rotation: viewport.rotation as 0 | 90 | 180 | 270,
        mediaBox: {
          x: mediaBox[0],
          y: mediaBox[1],
          width: mediaBox[2] - mediaBox[0],
          height: mediaBox[3] - mediaBox[1],
        },
        // 如果有裁剪框且与媒体框不同，则设置裁剪框
        cropBox: cropBox && !isBoxEqual(mediaBox, cropBox) ? {
          x: cropBox[0],
          y: cropBox[1],
          width: cropBox[2] - cropBox[0],
          height: cropBox[3] - cropBox[1],
        } : undefined,
      };
      
      pages.push(pageMeta);
    }
    
    return { pages };
  } catch (error) {
    console.error('PDF加载失败:', error);
    throw new Error(`PDF文件加载失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 获取PDF文档对象（用于渲染）
 */
export async function getPdfDocument(arrayBuffer: ArrayBuffer | Uint8Array) {
  const data = toUint8Array(arrayBuffer);
  debug('getPdfDocument', { length: data.length });
  return await pdfjsLib.getDocument({ data }).promise;
}

/**
 * 渲染PDF页面到Canvas
 */
export async function renderPageToCanvas(
  arrayBuffer: ArrayBuffer | Uint8Array,
  pageIndex: number,
  scale: number,
  canvas?: HTMLCanvasElement
): Promise<HTMLCanvasElement> {
  debug('renderPageToCanvas.start', { pageIndex, scale });
  const pdf = await getPdfDocument(arrayBuffer);
  const page = await pdf.getPage(pageIndex + 1); // PDF.js使用1基索引
  
  const viewport = page.getViewport({ scale });
  
  // 创建或使用提供的canvas
  const targetCanvas = canvas || document.createElement('canvas');
  targetCanvas.width = viewport.width;
  targetCanvas.height = viewport.height;
  
  const context = targetCanvas.getContext('2d');
  if (!context) {
    throw new Error('无法获取Canvas 2D上下文');
  }
  
  // 渲染页面
  await page.render({
    canvasContext: context,
    viewport: viewport,
  }).promise;
  
  return targetCanvas;
}

/**
 * 渲染PDF页面为ImageBitmap（用于Worker）
 */
export async function renderPageToImageBitmap(
  arrayBuffer: ArrayBuffer | Uint8Array,
  pageIndex: number,
  scale: number
): Promise<ImageBitmap> {
  // 创建OffscreenCanvas（如果支持）
  if (typeof OffscreenCanvas !== 'undefined') {
    debug('renderPageToImageBitmap.offscreen', { pageIndex, scale });
    const pdf = await getPdfDocument(arrayBuffer);
    const page = await pdf.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale });
    
    const canvas = new OffscreenCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');
    
    if (!context) {
      throw new Error('无法获取OffscreenCanvas 2D上下文');
    }
    
    await page.render({
      canvasContext: context as any,
      viewport: viewport,
    }).promise;
    
    return canvas.transferToImageBitmap();
  } else {
    // 回退到普通Canvas
    debug('renderPageToImageBitmap.canvasFallback', { pageIndex, scale });
    const canvas = await renderPageToCanvas(arrayBuffer, pageIndex, scale);
    return await createImageBitmap(canvas);
  }
}

/**
 * 获取PDF页面的SVG内容
 */
let svgGraphicsCtor: any | null = null;
type SvgLoader = () => Promise<any>;
const svgLoaders: SvgLoader[] = [
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

async function ensureSvgGraphics(): Promise<any> {
  if (svgGraphicsCtor) {
    return svgGraphicsCtor;
  }

  for (const loader of svgLoaders) {
    try {
      const ctor = await loader();
      if (ctor) {
        debug('ensureSvgGraphics.success', { loader: loader.name || 'anonymous' });
        svgGraphicsCtor = ctor;
        break;
      }
    } catch (error) {
      console.warn('[pdfLoader] 加载SVGGraphics失败', loader.name || 'anonymous', error);
    }
  }

  if (!svgGraphicsCtor) {
    throw new Error('当前环境不支持SVG导出');
  }

  return svgGraphicsCtor;
}

export async function renderPageToSVG(
  arrayBuffer: ArrayBuffer | Uint8Array,
  pageIndex: number,
  scale: number = 1.0
): Promise<string> {
  debug('renderPageToSVG.start', { pageIndex, scale });

  try {
    const pdf = await getPdfDocument(arrayBuffer);
    const page = await pdf.getPage(pageIndex + 1);

    const viewport = page.getViewport({ scale });
    const opList = await page.getOperatorList();
    debug('renderPageToSVG.opList', { length: opList?.fnArray?.length ?? 'unknown' });

    const SVGGraphics = await ensureSvgGraphics();

    // 创建SVG渲染器
    const svgGfx = new SVGGraphics(page.commonObjs, page.objs);
    svgGfx.embedFonts = true;

    const svg = await svgGfx.getSVG(opList, viewport);

    // 转换为字符串
    const serializer = new XMLSerializer();
    return serializer.serializeToString(svg);
  } catch (error) {
    debug('renderPageToSVG.error', {
      pageIndex,
      scale,
      error: error instanceof Error ? error.message : String(error)
    });

    try {
      const canvas = await renderPageToCanvas(arrayBuffer, pageIndex, scale);
      const dataUrl = canvas.toDataURL('image/png');
      const width = canvas.width || 1;
      const height = canvas.height || 1;

      const fallbackSvg = `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
        `<image href="${dataUrl}" width="${width}" height="${height}" />` +
        `</svg>`;

      debug('renderPageToSVG.fallback', { pageIndex, scale, width, height });
      return fallbackSvg;
    } catch (fallbackError) {
      debug('renderPageToSVG.fallbackError', {
        pageIndex,
        scale,
        error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
      });
      throw error;
    }
  }
}

/**
 * 比较两个盒子是否相等
 */
function isBoxEqual(box1: number[], box2: number[]): boolean {
  return box1.length === box2.length && 
         box1.every((val, index) => Math.abs(val - box2[index]) < 0.01);
}

function toUint8Array(buffer: ArrayBuffer | Uint8Array): Uint8Array {
  if (buffer instanceof Uint8Array) {
    const copy = buffer.slice();
    debug('toUint8Array.reuse-clone', { originalLength: buffer.length, clonedLength: copy.length });
    return copy;
  }
  const view = new Uint8Array(buffer);
  const copy = view.slice();
  debug('toUint8Array.wrap-clone', { originalLength: view.length, clonedLength: copy.length });
  return copy;
}

/**
 * 验证ArrayBuffer是否为有效的PDF
 */
export async function validatePdfBuffer(arrayBuffer: ArrayBuffer): Promise<boolean> {
  try {
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    return pdf.numPages > 0;
  } catch {
    return false;
  }
}
