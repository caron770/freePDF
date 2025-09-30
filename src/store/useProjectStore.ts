import { create } from 'zustand';
import type { ProjectState, PageIndex, CropDraft } from '@/core/types';
import { loadPdfMeta, validatePdfBuffer } from '@/core/pdfLoader';
import { validatePdfFile } from '@/utils/file';

interface ProjectActions {
  // 文件操作
  openFile: (file: File) => Promise<void>;
  closeFile: () => void;
  
  // 页面操作
  setPageOrder: (order: PageIndex[]) => void;
  deletePage: (index: PageIndex) => void;
  deletePages: (indices: PageIndex[]) => void;
  
  // 选择操作
  selectPage: (index: PageIndex) => void;
  selectPages: (indices: PageIndex[]) => void;
  selectAllPages: () => void;
  clearSelection: () => void;
  togglePageSelection: (index: PageIndex) => void;
  
  // 当前页面
  setCurrentPage: (index: PageIndex | null) => void;
  
  // 裁剪操作
  setCropDraft: (draft?: CropDraft) => void;
  clearCropDraft: () => void;
  
  // 渲染设置
  setRenderScale: (scale: number) => void;
  setThumbnailScale: (scale: number) => void;
  
  // 错误处理
  setError: (error: string | null) => void;
  clearError: () => void;
  
  // 加载状态
  setLoading: (loading: boolean) => void;
}

const initialState: ProjectState = {
  fileName: '',
  fileSize: 0,
  arrayBuffer: null,
  pages: [],
  pageOrder: [],
  selection: new Set(),
  currentPage: null,
  cropDraft: undefined,
  isLoading: false,
  error: null,
  renderScale: 2,
  thumbnailScale: 0.6,
};

export const useProjectStore = create<ProjectState & ProjectActions>((set, get) => ({
  ...initialState,

  // 文件操作
  openFile: async (file: File) => {
    const state = get();
    
    try {
      state.setLoading(true);
      state.clearError();
      
      // 验证文件
      const validation = validatePdfFile(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }
      
      // 读取文件
      const arrayBuffer = await file.arrayBuffer();
      const validationBuffer = arrayBuffer.slice(0);
      const metaBuffer = arrayBuffer.slice(0);

      // 验证PDF内容
      const isValidPdf = await validatePdfBuffer(validationBuffer);
      if (!isValidPdf) {
        throw new Error('文件不是有效的PDF格式');
      }

      // 加载页面元数据
      const { pages } = await loadPdfMeta(metaBuffer);
      
      set({
        fileName: file.name,
        fileSize: file.size,
        arrayBuffer,
        pages,
        pageOrder: pages.map((_, index) => index),
        selection: new Set(),
        currentPage: pages.length > 0 ? 0 : null,
        cropDraft: undefined,
        error: null,
      });
      
    } catch (error) {
      state.setError(error instanceof Error ? error.message : '文件加载失败');
    } finally {
      state.setLoading(false);
    }
  },

  closeFile: () => {
    set({ ...initialState });
  },

  // 页面操作
  setPageOrder: (order: PageIndex[]) => {
    set({ pageOrder: order });
  },

  deletePage: (index: PageIndex) => {
    const { pageOrder, selection, currentPage } = get();
    
    const newPageOrder = pageOrder.filter(i => i !== index);
    const newSelection = new Set([...selection].filter(i => i !== index));
    
    // 调整当前页面
    let newCurrentPage = currentPage;
    if (currentPage === index) {
      newCurrentPage = newPageOrder.length > 0 ? newPageOrder[0] : null;
    }
    
    set({
      pageOrder: newPageOrder,
      selection: newSelection,
      currentPage: newCurrentPage,
    });
  },

  deletePages: (indices: PageIndex[]) => {
    const { pageOrder, selection, currentPage } = get();
    const indexSet = new Set(indices);
    
    const newPageOrder = pageOrder.filter(i => !indexSet.has(i));
    const newSelection = new Set([...selection].filter(i => !indexSet.has(i)));
    
    // 调整当前页面
    let newCurrentPage = currentPage;
    if (currentPage !== null && indexSet.has(currentPage)) {
      newCurrentPage = newPageOrder.length > 0 ? newPageOrder[0] : null;
    }
    
    set({
      pageOrder: newPageOrder,
      selection: newSelection,
      currentPage: newCurrentPage,
    });
  },

  // 选择操作
  selectPage: (index: PageIndex) => {
    set({ selection: new Set([index]) });
  },

  selectPages: (indices: PageIndex[]) => {
    set({ selection: new Set(indices) });
  },

  selectAllPages: () => {
    const { pageOrder } = get();
    set({ selection: new Set(pageOrder) });
  },

  clearSelection: () => {
    set({ selection: new Set() });
  },

  togglePageSelection: (index: PageIndex) => {
    const { selection } = get();
    const newSelection = new Set(selection);
    
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    
    set({ selection: newSelection });
  },

  // 当前页面
  setCurrentPage: (index: PageIndex | null) => {
    set({ currentPage: index });
  },

  // 裁剪操作
  setCropDraft: (draft?: CropDraft) => {
    set({ cropDraft: draft });
  },

  clearCropDraft: () => {
    set({ cropDraft: undefined });
  },

  // 渲染设置
  setRenderScale: (scale: number) => {
    set({ renderScale: Math.max(0.1, Math.min(5.0, scale)) });
  },

  setThumbnailScale: (scale: number) => {
    set({ thumbnailScale: Math.max(0.1, Math.min(1.0, scale)) });
  },

  // 错误处理
  setError: (error: string | null) => {
    set({ error });
  },

  clearError: () => {
    set({ error: null });
  },

  // 加载状态
  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },
}));

// 选择器（用于性能优化）
export const useFileName = () => useProjectStore(state => state.fileName);
export const useFileSize = () => useProjectStore(state => state.fileSize);
export const usePages = () => useProjectStore(state => state.pages);
export const usePageOrder = () => useProjectStore(state => state.pageOrder);
export const useSelection = () => useProjectStore(state => state.selection);
export const useCurrentPage = () => useProjectStore(state => state.currentPage);
export const useCropDraft = () => useProjectStore(state => state.cropDraft);
export const useIsLoading = () => useProjectStore(state => state.isLoading);
export const useError = () => useProjectStore(state => state.error);
export const useRenderScale = () => useProjectStore(state => state.renderScale);
export const useThumbnailScale = () => useProjectStore(state => state.thumbnailScale);
export const useArrayBuffer = () => useProjectStore(state => state.arrayBuffer);

// 计算属性选择器
export const useSelectedPages = () => useProjectStore(state => {
  return state.pageOrder.filter(index => state.selection.has(index));
});

export const useHasFile = () => useProjectStore(state => state.arrayBuffer !== null);

export const usePageCount = () => useProjectStore(state => state.pageOrder.length);

export const useCanDelete = () => useProjectStore(state => {
  return state.selection.size > 0 && state.pageOrder.length > state.selection.size;
});
