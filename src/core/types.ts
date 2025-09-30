export type PageIndex = number; // 0-based

export interface PdfRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfPageMeta {
  index: PageIndex;
  width: number;    // points
  height: number;   // points
  rotation: 0 | 90 | 180 | 270;
  cropBox?: PdfRect;    // 若设置
  mediaBox: PdfRect;    // 原始
}

export interface CropDraft {
  page: PageIndex;
  rect: PdfRect;
}

export interface ProjectState {
  // 文件信息
  fileName: string;
  fileSize: number;
  arrayBuffer: ArrayBuffer | null;
  
  // 页面信息
  pages: PdfPageMeta[];
  pageOrder: PageIndex[];     // 当前页顺序（删除/重排后）
  
  // 交互状态
  selection: Set<PageIndex>;  // 选中页
  currentPage: PageIndex | null;  // 当前预览页
  cropDraft?: CropDraft;      // 正在编辑的裁剪框
  
  // UI状态
  isLoading: boolean;
  error: string | null;
  
  // 渲染设置
  renderScale: number;        // 渲染缩放
  thumbnailScale: number;     // 缩略图缩放
}

export interface RenderTask {
  id: string;
  type: 'thumbnail' | 'canvas' | 'export';
  page: PageIndex;
  scale: number;
  format?: 'png' | 'jpeg' | 'svg';
  quality?: number;  // for jpeg
}

export interface RenderResult {
  id: string;
  success: boolean;
  data?: ImageBitmap | string;  // ImageBitmap for bitmap, string for SVG
  error?: string;
}

export interface ExportOptions {
  format: 'png' | 'jpeg' | 'svg' | 'pdf';
  dpi?: number;
  quality?: number;  // for jpeg
  pages: PageIndex[];
  hardCrop?: boolean;  // 是否硬裁剪
}

export interface WorkerMessage<T = any> {
  id: string;
  type: 'render' | 'export' | 'load';
  payload: T;
}

export interface WorkerResponse<T = any> {
  id: string;
  success: boolean;
  data?: T;
  error?: string;
  progress?: number;
}

// 坐标转换相关
export interface CanvasRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ViewportInfo {
  width: number;
  height: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}