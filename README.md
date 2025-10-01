# freePDF

轻量级浏览器 PDF 工具，可在本地完成页面裁剪、重排、拆分以及多格式导出。默认完全前端运行，若需要高保真的 SVG，可接入 Inkscape CLI 后端服务。

---

## ✨ 功能亮点

- **本地打开 PDF**：拖拽或文件选择，自动生成缩略图，离线可用。
- **页面管理**：支持删除、拖拽重排、按页码范围拆分导出（如 `1,3,5-8,10-`）。
- **裁剪（CropBox / MediaBox）**：
  - 画布橡皮框选裁剪区域。
  - “软裁剪”写入 CropBox；“硬裁剪”直接修改 MediaBox。
- **导出**：
  - PNG / JPEG：自定义 DPI，可批量导出。
  - SVG（浏览器端）：基于 PDF.js 的基础矢量导出，失败时自动降级为嵌入位图。
  - SVG（高保真，可选）：调用 Inkscape CLI 服务，生成真正的矢量文件。
- **性能优化**：渲染、导出等耗时操作在 Web Worker 中执行，页面不阻塞。
- **调试友好**：关键流程输出 `[pdfLoader]`、`[workerManager]` 等日志，方便排查。

---

## 🛠 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 18 · TypeScript · Vite |
| PDF 渲染 | PDF.js（Canvas / SVG back-end） |
| PDF 编辑 | pdf-lib（删除、拆分、裁剪） |
| 状态管理 | 轻量 Hooks Store（Zustand） |
| 样式 | Tailwind + 自定义样式 |
| 并发 | Web Worker (`src/workers/render.worker.ts`) |
| 可选后端 | Inkscape CLI 转换服务（`server/` 子项目） |

---

## 📂 目录结构

```text
freePDF/
├─ package.json
├─ src/
│  ├─ components/      # 缩略图、画布、工具栏、模态框等 UI
│  ├─ core/            # PDF 加载、编辑、坐标换算、调试日志
│  ├─ services/        # 外部服务调用（Inkscape SVG 转换）
│  ├─ store/           # Zustand 状态管理
│  ├─ utils/           # 文件处理、页码解析等工具函数
│  ├─ workers/         # Web Worker 实现
│  └─ main.tsx         # React 入口
├─ server/             # Inkscape CLI 转换服务（可选）
└─ ...
```

---

## 🚀 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 启动前端
```bash
npm run dev
```
浏览器访问：<http://localhost:5173>

### 3. （可选）启动 Inkscape CLI 转换服务
该服务用于输出高保真 SVG，需先安装 Inkscape 并在 `server/` 目录启动：
```bash
# 安装依赖（首次执行）
cd server
npm install

# 启动服务（默认端口 4000）
npm start
```
也可以在项目根目录运行：
```bash
npm run svg-server
```

前端默认请求 `http://localhost:4000/convert/svg`。如需指向其他地址，在 `.env` 中设置：
```ini
VITE_SVG_CONVERTER_URL=https://your-domain/convert/svg
```

### Inkscape CLI 安装指引
- **macOS**：`brew install inkscape` 或 [官网](https://inkscape.org/release/) 下载 DMG，确保 `inkscape --version` 可执行。
- **Windows**：下载安装包并勾选 “Add Inkscape to PATH”；安装后在 PowerShell/CMD 执行 `inkscape --version` 测试。
- **Linux**：`sudo apt install inkscape`（或使用对应包管理器）。

服务运行时的详细日志会在 `npm start` 的终端输出，可用来确认命令参数与生成的 SVG 大小。

---

## 🧑‍💻 使用说明

1. 打开前端页面，将 PDF 拖入或点击上传。
2. 左侧缩略图支持拖拽排序；右侧工具栏可删除、拆分、导出等。
3. 在画布上拖动鼠标创建裁剪框，使用 “硬裁剪” 开关决定是否写入 MediaBox。
4. 导出：
   - **PNG/JPEG**：设定 DPI → 选择页面 → 导出。
   - **SVG**：
     - 默认走 PDF.js 导出，失败时自动降级为嵌入位图。
     - 若已启动 Inkscape 服务，则对每页调用后端，生成真正的矢量 SVG。
5. 导出过程可查看浏览器控制台 `[pdfLoader] ...`、`[workerManager] ...` 等日志；若使用后端，可在终端查看 `[convert/svg] ...` 日志。

---

## ⚙️ 环境变量

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `VITE_SVG_CONVERTER_URL` | 前端调用的 SVG 转换接口 | `http://localhost:4000/convert/svg` |

---

## 🧾 License

本项目用于学习与演示，可按需扩展。发布或商用时，请同时遵循所使用第三方库（Inkscape、PDF.js、pdf-lib 等）的许可协议。

---

更多细节（数据结构、用例、扩展规划）见 `readme_overall.md`。欢迎提出反馈与改进建议！
