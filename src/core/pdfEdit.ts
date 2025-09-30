import { PDFDocument, rgb, degrees } from 'pdf-lib';
import type { PdfRect, PageIndex } from './types';

/**
 * 删除指定页面
 */
export async function deletePages(
  arrayBuffer: ArrayBuffer,
  pages1Based: number[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(arrayBuffer);
  
  // 按降序排序，从后往前删除，避免索引错乱
  const sortedPages = [...pages1Based].sort((a, b) => b - a);
  
  for (const pageNum of sortedPages) {
    if (pageNum > 0 && pageNum <= doc.getPageCount()) {
      doc.removePage(pageNum - 1); // 转为0基索引
    }
  }
  
  return await doc.save();
}

/**
 * 提取指定页面范围到新文档
 */
export async function extractRanges(
  arrayBuffer: ArrayBuffer,
  ranges: Array<[number, number]> // 1基页码范围
): Promise<Uint8Array> {
  const sourceDoc = await PDFDocument.load(arrayBuffer);
  const targetDoc = await PDFDocument.create();
  
  for (const [start, end] of ranges) {
    for (let pageNum = start; pageNum <= end; pageNum++) {
      if (pageNum > 0 && pageNum <= sourceDoc.getPageCount()) {
        const [copiedPage] = await targetDoc.copyPages(sourceDoc, [pageNum - 1]);
        targetDoc.addPage(copiedPage);
      }
    }
  }
  
  return await targetDoc.save();
}

/**
 * 重新排列页面
 */
export async function reorderPages(
  arrayBuffer: ArrayBuffer,
  newOrder: PageIndex[] // 0基索引的新顺序
): Promise<Uint8Array> {
  const sourceDoc = await PDFDocument.load(arrayBuffer);
  const targetDoc = await PDFDocument.create();
  
  // 复制页面到新文档按新顺序
  const pagesToCopy = newOrder.filter(index => 
    index >= 0 && index < sourceDoc.getPageCount()
  );
  
  if (pagesToCopy.length > 0) {
    const copiedPages = await targetDoc.copyPages(sourceDoc, pagesToCopy);
    copiedPages.forEach(page => targetDoc.addPage(page));
  }
  
  return await targetDoc.save();
}

/**
 * 设置页面裁剪框（CropBox）- 非破坏性裁剪
 */
export async function setCropBox(
  arrayBuffer: ArrayBuffer,
  pages1Based: number[],
  rect: PdfRect
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(arrayBuffer);
  
  for (const pageNum of pages1Based) {
    if (pageNum > 0 && pageNum <= doc.getPageCount()) {
      const page = doc.getPage(pageNum - 1);
      page.setCropBox(rect.x, rect.y, rect.width, rect.height);
    }
  }
  
  return await doc.save();
}

/**
 * 硬裁剪：将裁剪区域设置为新的MediaBox
 */
export async function hardCropToMediaBox(
  arrayBuffer: ArrayBuffer,
  pages1Based: number[],
  rect: PdfRect
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(arrayBuffer);
  
  for (const pageNum of pages1Based) {
    if (pageNum > 0 && pageNum <= doc.getPageCount()) {
      const page = doc.getPage(pageNum - 1);
      
      // 获取当前页面内容
      const { width: currentWidth, height: currentHeight } = page.getSize();
      
      // 确保裁剪区域在页面范围内
      const clampedRect = {
        x: Math.max(0, Math.min(rect.x, currentWidth)),
        y: Math.max(0, Math.min(rect.y, currentHeight)),
        width: Math.min(rect.width, currentWidth - Math.max(0, rect.x)),
        height: Math.min(rect.height, currentHeight - Math.max(0, rect.y)),
      };
      
      // 设置新的媒体框
      page.setMediaBox(
        clampedRect.x,
        clampedRect.y,
        clampedRect.width,
        clampedRect.height
      );
      
      // 也设置裁剪框以确保一致性
      page.setCropBox(
        clampedRect.x,
        clampedRect.y,
        clampedRect.width,
        clampedRect.height
      );
    }
  }
  
  return await doc.save();
}

/**
 * 清除页面的裁剪框
 */
export async function clearCropBox(
  arrayBuffer: ArrayBuffer,
  pages1Based: number[]
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(arrayBuffer);
  
  for (const pageNum of pages1Based) {
    if (pageNum > 0 && pageNum <= doc.getPageCount()) {
      const page = doc.getPage(pageNum - 1);
      const { width, height } = page.getSize();
      
      // 将裁剪框设置为整个页面
      page.setCropBox(0, 0, width, height);
    }
  }
  
  return await doc.save();
}

/**
 * 添加水印到指定页面
 */
export async function addWatermark(
  arrayBuffer: ArrayBuffer,
  pages1Based: number[],
  text: string,
  options: {
    fontSize?: number;
    opacity?: number;
    rotation?: number;
    color?: [number, number, number];
    position?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  } = {}
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(arrayBuffer);
  const {
    fontSize = 48,
    opacity = 0.3,
    rotation = 45,
    color = [0.5, 0.5, 0.5],
    position = 'center'
  } = options;
  
  for (const pageNum of pages1Based) {
    if (pageNum > 0 && pageNum <= doc.getPageCount()) {
      const page = doc.getPage(pageNum - 1);
      const { width, height } = page.getSize();
      
      // 计算文本位置
      let x = width / 2;
      let y = height / 2;
      
      switch (position) {
        case 'top-left':
          x = 50;
          y = height - 50;
          break;
        case 'top-right':
          x = width - 50;
          y = height - 50;
          break;
        case 'bottom-left':
          x = 50;
          y = 50;
          break;
        case 'bottom-right':
          x = width - 50;
          y = 50;
          break;
      }
      
      // 添加水印文本
      page.drawText(text, {
        x,
        y,
        size: fontSize,
        color: rgb(color[0], color[1], color[2]),
        opacity,
        rotate: degrees(rotation),
      });
    }
  }
  
  return await doc.save();
}

/**
 * 合并多个PDF文件
 */
export async function mergePdfs(
  arrayBuffers: ArrayBuffer[]
): Promise<Uint8Array> {
  const targetDoc = await PDFDocument.create();
  
  for (const buffer of arrayBuffers) {
    const sourceDoc = await PDFDocument.load(buffer);
    const pageCount = sourceDoc.getPageCount();
    
    if (pageCount > 0) {
      const pageIndices = Array.from({ length: pageCount }, (_, i) => i);
      const copiedPages = await targetDoc.copyPages(sourceDoc, pageIndices);
      copiedPages.forEach(page => targetDoc.addPage(page));
    }
  }
  
  return await targetDoc.save();
}

/**
 * 获取PDF文档信息
 */
export async function getPdfInfo(arrayBuffer: ArrayBuffer): Promise<{
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
  pageCount: number;
}> {
  const doc = await PDFDocument.load(arrayBuffer);
  
  return {
    title: doc.getTitle(),
    author: doc.getAuthor(),
    subject: doc.getSubject(),
    creator: doc.getCreator(),
    producer: doc.getProducer(),
    creationDate: doc.getCreationDate(),
    modificationDate: doc.getModificationDate(),
    pageCount: doc.getPageCount(),
  };
}
