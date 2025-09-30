# freePDF

支持 PDF 裁剪、拆分与多格式导出的纯前端工具。核心在浏览器中运行（React + Vite + TypeScript），并可选接入 Inkscape CLI 后端以获得高保真 SVG 导出。

---

## ✨ 功能概览

- **本地打开 PDF**：拖入或通过文件选择，自动生成缩略图，支持离线运行。
- **页面管理**：重排、删除、拆分导出，支持自定义页码范围表达式（`1,3,5-8,10-`）。
- **裁剪（CropBox / MediaBox）**
  - 画布橡皮圈选裁剪区域。
  - “软裁剪”写入 CropBox；“硬裁剪”直接修改 MediaBox。
- **导出**
  - PNG / JPEG：指定 DPI，支持批量导出。
  - SVG（基础）：默认使用 PDF.js 导出失败时可降级为嵌入位图。
  - SVG（高保真，可选）：接入 Inkscape CLI 服务，输出真正的矢量图。
- **性能优化**：渲染、导出等耗时操作在 Web Worker 中执行，避免阻塞 UI。
- **调试日志**：关键流程输出 `[pdfLoader]`、`[workerManager]` 等日志，便于排查。

---

## 📦 技术栈

- **前端**：React 18 + TypeScript + Vite
- **PDF 渲染**：PDF.js（canvas/SVG back-end）
- **PDF 编辑**：pdf-lib（删除页、拆分、裁剪）
- **状态管理**：轻量 Hooks Store
- **样式**：Tailwind（见 `src/index.css`）
- **并发**：原生 Web Worker (`src/workers/render.worker.ts`)
- **可选后端**：Inkscape CLI 转换服务（位于 `server/` 子项目）

---

## 📂 目录结构

freePDF/
├─ package.json
├─ src/
│ ├─ components/ # UI 组件（缩略图、画布、工具栏、模态框）
│ ├─ core/ # PDF 加载/编辑/坐标换算
│ ├─ services/ # 外部服务调用（Inkscape SVG 转换）
│ ├─ store/ # Zustand 状态
│ ├─ utils/ # 工具函数（文件、页码解析等）
│ ├─ workers/ # Web Worker 实现
│ └─ main.tsx # React 入口
├─ server/ # Inkscape CLI 转换服务（可选）
└─ ...

yaml

---

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
2. 启动前端
bash

npm run dev
访问 http://localhost:5173 查看应用。

3.（可选）启动 Inkscape CLI 转换服务
该服务用于生成高保真 SVG，需要在系统中安装 Inkscape，并在 server/ 目录运行：

bash

cd server
npm install          # 首次需要
npm start            # 默认监听 http://localhost:4000/convert/svg
或在项目根目录运行：

bash

npm run svg-server
前端会默认请求 http://localhost:4000/convert/svg，如需部署到其它地址，可在 .env 中设置：

ini

VITE_SVG_CONVERTER_URL=https://your-domain/convert/svg
Inkscape CLI 安装指南
macOS：brew install inkscape 或 官网下载 DMG，确保 inkscape --version 可运行。
Windows：下载安装包并勾选 “Add Inkscape to PATH”；安装后在 PowerShell/ CMD 里执行 inkscape --version 测试。
Linux：sudo apt install inkscape（或对应包管理器）。
服务日志（如 “No pages selected, getting first page only.”）会打印在 npm start 所在终端，可用来确认是否生成矢量文件。

🧑‍💻 使用说明
打开页面后，将 PDF 文件拖入或点击上传。
左侧缩略图支持拖拽排序；右侧工具栏可进行“删除”“拆分”“导出”等操作。
画布区域拖动鼠标即可创建裁剪框，工具栏中的 “硬裁剪” 开关决定是否写入 MediaBox。
导出：
PNG/JPEG：设置 DPI → 选中页面 → 导出。
SVG：
默认由浏览器端 PDF.js 生成；若失败，会自动降级为嵌入位图的 SVG。
若已启动 Inkscape 服务，则会自动调用该服务生成高保真矢量 SVG。
导出时可观察浏览器控制台及（如果有）后端终端日志，确认流程是否正确。
📌 环境变量
变量	说明	默认值
VITE_SVG_CONVERTER_URL	前端调用的 SVG 转换接口	http://localhost:4000/convert/svg
🧾 License
本项目代码仅供学习与演示，可按需扩展或调整。如需分发或商用，请结合 Inkscape / PDF.js 等第三方组件的许可证要求。
```
