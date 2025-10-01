**可直接当项目蓝图的 README** ，里面包含：技术选型、目录结构、接口约定、数据结构、关键用例、验收标准、打包与部署、性能与兼容性要求、以及最小可运行骨架代码（TypeScript + Vite + React + PDF.js + pdf-lib + Web Worker）。

另一个 AI 读完这份 README 就能按要求把项目搭起来并完善实现。

---

# README.md（提案 + 最小骨架）

## 项目名

**PDF Studio Web (Pure-Frontend Edition)**

浏览器端 PDF 删除/拆分、手动裁剪（CropBox）、导出图片（PNG/JPEG）、导出 SVG（基础）

> 架构：TypeScript + React + Vite + PDF.js（渲染）+ pdf-lib（编辑）+ Web Worker（渲染/导出异步）

---

## 目标与边界

**必须实现**

1. 打开本地 PDF（不上传服务器）并生成缩略图。
2. 页面管理：删除、重排、拆分导出（按页范围）。
3. 手动裁剪：在画布框选区域，设置页面  **CropBox** （非破坏裁剪）；提供“硬裁剪”开关（将裁后区域写入 MediaBox）。
4. 导出为图片：指定 DPI 的 PNG/JPEG（单页或批量）。
5. 导出为 SVG：默认走浏览器端（PDF.js SVG back-end），若遇到兼容性问题可切换到 **Inkscape CLI 后端服务**，保持高保真矢量输出。
6. 纯前端运行：支持离线（PWA 可选，若时间不足可不启用）。
7. 大文件与高 DPI 渲染在 **Web Worker** 中执行，避免卡 UI。

**可选扩展（留接口）**

* 高保真 SVG/位图导出（MuPDF.js WASM 懒加载模块）。
* 批注/签名/水印。
* 历史记录与撤销/重做。
* 文件系统访问 API（原生读写；需 fallback 到 `<input type="file">`/下载）。

---

## 技术选型

* **语言** ：TypeScript
* **前端** ：React + Vite
* **PDF 渲染** ：PDF.js（canvas 渲染 + SVG 渲染）
* **PDF 编辑** ：pdf-lib（删除/复制/设置 CropBox/MediaBox）
* **并发** ：Web Worker（将 PDF 渲染与导出放入 Worker）
* **状态管理** ：轻量（React Context + Hooks 即可）
* **样式** ：Tailwind（可选）或简化的 CSS Modules
* **打包** ：Vite + vite-plugin-worker（或原生 `new Worker(new URL(..., import.meta.url))`）

> **可选后端：Inkscape CLI SVG 转换服务**  
> 当浏览器端的 PDF.js SVG 导出不稳定时，可在 `server/` 子项目内运行一个 Node.js + Inkscape 的后端，将单页 PDF 转换为高保真 SVG。前端通过 `VITE_SVG_CONVERTER_URL` 指定服务地址即可启用。

---

## 目录结构（建议）

```
pdf-studio-web/
├─ package.json
├─ vite.config.ts
├─ tsconfig.json
├─ public/
│  └─ pdfjs/                           # PDF.js 资源（worker脚本、cmaps 等）
├─ src/
│  ├─ app/
│  │  ├─ App.tsx                       # 主界面布局（左侧缩略图/中间画布/右侧工具栏）
│  │  └─ routes.tsx                    # 如需路由（可选）
│  ├─ components/
│  │  ├─ ThumbnailList.tsx             # 缩略图列表（可拖拽排序）
│  │  ├─ CanvasViewer.tsx              # 画布展示（支持橡皮筋框选）
│  │  ├─ CropOverlay.tsx               # 裁剪框覆盖层与句柄
│  │  └─ Toolbar.tsx                   # 操作面板（删除/拆分/裁剪/导出）
│  ├─ core/
│  │  ├─ pdfLoader.ts                  # 读取 ArrayBuffer，初始化 PDF.js 文档
│  │  ├─ pdfRenderer.ts                # PDF.js 渲染（主线程调用到 worker）
│  │  ├─ pdfEdit.ts                    # 基于 pdf-lib 的编辑（删/拆/裁剪）
│  │  ├─ svgExport.ts                  # 基于 PDF.js SVG 模式导出
│  │  ├─ coords.ts                     # 画布坐标 ↔ PDF 坐标换算
│  │  └─ types.ts                      # 公共类型定义
│  ├─ workers/
│  │  ├─ render.worker.ts              # 在 worker 里用 PDF.js 渲染位图或导出位图
│  │  └─ svg.worker.ts                 # （可选）SVG 导出
│  ├─ store/
│  │  └─ useProjectStore.ts            # 当前文档、页序、裁剪设置等
│  ├─ utils/
│  │  ├─ file.ts                       # 下载、文件读取、MIME 判断
│  │  └─ range.ts                      # 页码表达式解析（如 "1,3,5-8,10-"）
│  ├─ index.css
│  └─ main.tsx
└─ README.md
```

---

## 关键数据结构（`src/core/types.ts`）

```ts
export type PageIndex = number; // 0-based

export interface PdfPageMeta {
  index: PageIndex;
  width: number;    // points
  height: number;   // points
  rotation: 0 | 90 | 180 | 270;
  cropBox?: PdfRect;    // 若设置
  mediaBox?: PdfRect;   // 原始
}

export interface PdfRect { x: number; y: number; width: number; height: number; } // 单位：points

export interface ProjectState {
  fileName: string;
  fileSize: number;
  arrayBuffer: ArrayBuffer;   // 原始 PDF 数据
  pages: PdfPageMeta[];
  pageOrder: PageIndex[];     // 当前页顺序（删除/重排后）
  selection: Set<PageIndex>;  // 选中页
  cropDraft?: { page: PageIndex; rect: PdfRect }; // 正在编辑的裁剪框
}
```

---

## 页码范围语法

* 表达式示例：`"1,3,5-8,10-"`（1 基）
  * `a-b` 含两端；`-b` 等价 `1-b`；`a-` 等价 `a-max`
* 解析后统一转为 **1 基 → 0 基** 索引数组，去重并升序。

---

## 坐标换算（画布 → PDF）

* PDF 坐标单位  **points** （1 pt = 1/72 in），原点左下（PDF.js 处理后我们可统一左上为 0,0 以贴合 DOM）。
* 画布缩放比例 `scale = dpi/72 * zoom`。
* 换算示例：见 `coords.ts`

```ts
export function canvasRectToPdfRect(
  rectCanvas: { x: number; y: number; w: number; h: number },
  page: PdfPageMeta,
  canvasSize: { w: number; h: number },
  scale: number
): PdfRect {
  const sx = page.width  / (canvasSize.w / scale);
  const sy = page.height / (canvasSize.h / scale);
  return {
    x: rectCanvas.x * sx,
    y: rectCanvas.y * sy,
    width:  rectCanvas.w * sx,
    height: rectCanvas.h * sy,
  };
}
```

---

## 核心用例与验收标准（Definition of Done）

1. **打开 PDF**
   * 拖入或选择文件后显示缩略图；10 页文档在普通机器上 1 秒内出现首屏缩略图；不上传网络。
2. **删除页面**
   * 选中多页 → 点击“删除” → 缩略图即时更新；导出后的 PDF 页数正确。
3. **拆分导出**
   * 输入范围表达式 `"2-5,8"` → 生成新 PDF；范围解析正确。
4. **裁剪（CropBox）**
   * 画布中框选，实时预览可视区域变化；保存后再次打开仍能看到裁剪效果（非破坏性）。
   * “硬裁剪”开关启用时：导出的 PDF 实际内容被裁掉（写入 MediaBox）。
5. **导出图片**
   * 指定 DPI（默认 200），批量导出 PNG/JPEG；文件命名 `page-0001.png` 等；大页自动分批处理不崩溃。
6. **导出 SVG（基础）**
   * 常见文档可导出；若包含复杂透明/渐变，出现提示“建议使用高保真导出（WASM）”。
7. **性能**
   * 渲染与导出在 Worker 中进行，主线程不冻结（UI 可操作，进度可显示）。
8. **兼容性**
   * Chrome/Edge/Firefox 通过；Safari 若有限制，提供降级方案或提示。

---

## 依赖与脚本（`package.json` 片段）

```json
{
  "name": "pdf-studio-web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "check": "tsc --noEmit"
  },
  "dependencies": {
    "pdf-lib": "^1.17.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.6.3",
    "vite": "^5.4.8"
  }
}
```

> **PDF.js 引入方式** ：使用官方发行包（放在 `public/pdfjs`），通过动态 import 或 `<script>` 在 Worker 中使用；或使用社区包装（注意版本一致性）。
>
> 需要 `pdf.worker.js` 与 `cmaps/`（可选，复杂字体更稳）。

---

## 最小骨架代码

### `src/main.tsx`

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
```

### `src/app/App.tsx`

```tsx
import React from 'react';
import ThumbnailList from '../components/ThumbnailList';
import CanvasViewer from '../components/CanvasViewer';
import Toolbar from '../components/Toolbar';
import { useProjectStore } from '../store/useProjectStore';

export default function App() {
  const { openFile } = useProjectStore();

  return (
    <div className="h-screen flex">
      <aside className="w-64 border-r overflow-auto">
        <ThumbnailList />
      </aside>
      <main className="flex-1 flex flex-col">
        <header className="p-2 border-b flex items-center gap-2">
          <input type="file" accept="application/pdf"
                 onChange={e => e.target.files?.[0] && openFile(e.target.files[0])}/>
          <Toolbar />
        </header>
        <section className="flex-1 overflow-auto">
          <CanvasViewer />
        </section>
      </main>
    </div>
  );
}
```

### `src/store/useProjectStore.ts`

```ts
import { useState } from 'react';
import { create } from 'zustand';
import { ProjectState, PdfPageMeta } from '../core/types';
import { loadPdfMeta } from '../core/pdfLoader';

interface Actions {
  openFile: (file: File) => Promise<void>;
  setPageOrder: (order: number[]) => void;
  setCropDraft: (page: number | null, rect?: any) => void;
}

export const useProjectStore = create<ProjectState & Actions>((set, get) => ({
  fileName: '',
  fileSize: 0,
  arrayBuffer: new ArrayBuffer(0),
  pages: [],
  pageOrder: [],
  selection: new Set(),
  cropDraft: undefined,

  openFile: async (file: File) => {
    const buf = await file.arrayBuffer();
    const meta = await loadPdfMeta(buf);
    set({
      fileName: file.name,
      fileSize: file.size,
      arrayBuffer: buf,
      pages: meta.pages,
      pageOrder: meta.pages.map((_, i) => i)
    });
  },

  setPageOrder: (order) => set({ pageOrder: order }),
  setCropDraft: (page, rect) =>
    set({ cropDraft: page == null ? undefined : { page, rect } })
}));
```

### `src/core/pdfLoader.ts`（读取页面尺寸/旋转）

```ts
import type { ProjectState, PdfPageMeta } from './types';

// 假设已将 pdfjs-dist 发行文件放 public/pdfjs 下，通过 Worker 端加载
declare const window: any;

export async function loadPdfMeta(arrayBuffer: ArrayBuffer): Promise<{ pages: PdfPageMeta[] }> {
  // 这里只给接口形状；具体实现可在 worker 中调用 PDF.js，或主线程简化取 meta
  // 另一个AI实现时：使用 PDF.js getDocument({data})，遍历 getPage(i)，读取 viewport.width/height, rotation
  const pages: PdfPageMeta[] = []; // TODO: fill by PDF.js
  return { pages };
}
```

### `src/core/pdfEdit.ts`（删除/拆分/裁剪）

```ts
import { PDFDocument } from 'pdf-lib';
import type { PdfRect } from './types';

export async function deletePages(buf: ArrayBuffer, pages1Based: number[]) {
  const doc = await PDFDocument.load(buf);
  [...pages1Based].sort((a,b)=>b-a).forEach(p => doc.removePage(p-1));
  return await doc.save(); // Uint8Array
}

export async function extractRanges(buf: ArrayBuffer, ranges: Array<[number, number]>) {
  const src = await PDFDocument.load(buf);
  const dst = await PDFDocument.create();
  for (const [a,b] of ranges)
    for (let p=a; p<=b; p++) {
      const [pg] = await dst.copyPages(src, [p-1]);
      dst.addPage(pg);
    }
  return await dst.save();
}

export async function setCropBox(buf: ArrayBuffer, pages1: number[], rect: PdfRect) {
  const doc = await PDFDocument.load(buf);
  for (const p of pages1) {
    const page = doc.getPage(p-1);
    page.setCropBox(rect.x, rect.y, rect.width, rect.height);
  }
  return await doc.save();
}

export async function hardCropToMediabox(buf: ArrayBuffer, pages1: number[], rect: PdfRect) {
  const doc = await PDFDocument.load(buf);
  for (const p of pages1) {
    const page = doc.getPage(p-1);
    page.setMediaBox(rect.x, rect.y, rect.width, rect.height);
  }
  return await doc.save();
}
```

### `src/core/pdfRenderer.ts`（主线程封装，调用 worker）

```ts
export interface RenderTask {
  page: number;             // 1-based
  scale: number;            // e.g., dpi/72 * zoom
  type: 'bitmap' | 'svg';
}

export async function renderInWorker(task: RenderTask): Promise<ImageBitmap | string> {
  // 另一个AI在 worker 中实现：使用 PDF.js 在 OffscreenCanvas 渲染并 transferToImageBitmap()
  // 或在 svg.worker 用 PDF.js SVG viewer 生成SVG文本
  return {} as any;
}
```

### `src/workers/render.worker.ts`（Worker 端渲染框架）

```ts
// self.onmessage = async (ev) => {
//   const { arrayBuffer, page, scale } = ev.data;
//   // 使用 PDF.js 在 worker 中 getDocument({data: arrayBuffer})
//   // page.render({ canvasContext: offscreen.getContext('2d'), viewport }).promise
//   // const bitmap = offscreen.transferToImageBitmap();
//   // (postMessage bitmap, [bitmap])
// }
export {};
```

### `src/utils/range.ts`（页码表达式解析）

```ts
export function parsePageExpr(expr: string, max1: number): number[] {
  const out = new Set<number>();
  for (const part of expr.split(',').map(s=>s.trim()).filter(Boolean)) {
    if (part.includes('-')) {
      const [a,b] = part.split('-').map(s=>s.trim());
      const start = a ? parseInt(a,10) : 1;
      const end   = b ? parseInt(b,10) : max1;
      for (let i=Math.max(1,start); i<=Math.min(max1,end); i++) out.add(i);
    } else {
      const i = parseInt(part,10);
      if (i>=1 && i<=max1) out.add(i);
    }
  }
  return [...out].sort((x,y)=>x-y);
}
```

---

## 进度与任务（供 AI/开发者执行）

**里程碑 M1：可用 MVP**

* [ ] PDF 打开与缩略图（前 20 页懒加载）
* [ ] 删除/拆分/重排（拖拽排序）
* [ ] 画布预览 + 橡皮筋框选（CropBox）+ 实时预览
* [ ] 导出 PNG/JPEG（可选 DPI）、导出 SVG（基础）
* [ ] Worker 化渲染与导出、进度条与取消

**里程碑 M2：稳健性**

* [ ] 大文件与高 DPI 内存保护（分批渲染/导出）
* [ ] 文件系统访问 API（可选，带回退）
* [ ] 错误处理与用户提示（SVG 失真、字体缺失等）
* [ ] 单元测试：range 解析、坐标换算、编辑操作

**里程碑 M3：可扩展**

* [ ] WASM 高保真导出模块（MuPDF.js 懒加载）
* [ ] PWA/离线缓存
* [ ] 国际化（中/英）

---

## 性能与兼容性要求

* 首屏缩略图 < 1s（10 页文档，现代笔记本）
* 主线程保持可交互；重任务放 Worker
* 浏览器：Chrome/Edge/Firefox 最新稳定版；Safari 有降级提示

---

## 安全与隐私

* 默认  **不上传文件** 。
* 若将来引入远程服务，需明确用户授权并标注上传范围。

---

## 构建与运行

```bash
# 初始化
npm i
# 开发
npm run dev
# 构建
npm run build
# 预览
npm run preview
```

---

## 已知限制与替代路径

* PDF.js 的 **SVG 渲染**对复杂透明/渐变/Pattern 可能失真；建议引导用户使用“高保真（WASM）导出”。
* 超大尺寸页面 + 高 DPI 导出需显式限制像素上限并分批处理。

---

## 贡献规范（简版）

* 代码：TypeScript 严格模式，ESLint+Prettier（可选）
* 提交信息：`feat: xxx` / `fix: yyy` / `perf: zzz`
* PR 需附： **变更点** 、 **测试方式** 、**对性能或兼容性的影响**

---

### 备注

* 本 README 提供了**指令级**实现细节与代码骨架，便于另一个 AI/开发者据此自动生成完整代码。
* 若你需要，我可以把 **PDF.js Worker 端的具体实现** 和 **Canvas 橡皮筋框选组件** 也补全成可运行版本。

### Inkscape CLI 后端（可选）

1. 安装 Inkscape，确保 `inkscape --version` 命令可用。
2. 在项目根目录运行：
   ```bash
   cd server
   npm install
   npm start
   ```
   默认监听 `http://localhost:4000/convert/svg`，可通过 `PORT` 环境变量调整端口。
3. 前端设置环境变量 `VITE_SVG_CONVERTER_URL` 指向上述接口；未设置时默认使用 `http://localhost:4000/convert/svg`。
4. 导出 SVG 时，前端会将单页/裁剪后的 PDF 上传到该接口，再下载 Inkscape 生成的高保真矢量文件。

> 若服务器上部署，请把 Inkscape 安装进镜像或宿主机，并开放相应的 HTTP 接口。建议为服务增加鉴权与并发限制。
