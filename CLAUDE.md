# Zmetaboard AI Board - Sidecar Authoring Context

本文件为外部 AI 工具（Cursor / Codex / Claude Code 等）提供 AI 看板的编辑上下文。
请直接修改当前目录下的源码文件，修改后在 Zmetaboard 产品中预览效果。

## 目录结构

当前目录是一个 AI 看板项目。React 源码位于 `site/` 子目录，数据配置与数据文件在项目根目录。

```
{visdocId}/
├── datasets.json          # 数据集定义列表
├── datasources.json       # 数据源定义列表
├── file-data/             # 文件数据源的数据文件（.json + .csv）
└── site/                  # AI 看板 React 站点（编辑主要在这里）
    ├── src/App.tsx         # 主组件入口
    ├── src/components/     # 自定义组件
    ├── src/index.css       # 补充样式
    ├── assets/             # 站点静态资源 + widget manifest
    ├── index.html          # [系统托管，禁止修改]
    └── src/main.tsx        # [系统托管，禁止修改]
```

### 允许编辑的路径（`site/` 内）

- `site/src/App.tsx`
- `site/src/components/`
- `site/src/index.css`
- `site/assets/`

### 系统托管文件（禁止修改）

- `site/index.html`
- `site/src/main.tsx`

## 运行时与编译

**AI 看板使用浏览器端编译**：TSX 源码在浏览器内被实时编译和挂载，不经过 Node.js 构建流程。
这意味着：
- 没有 node_modules、没有打包器、没有服务端构建步骤。
- 不能使用 `require()`，不能依赖 Node.js API（`fs`、`path` 等）。
- `react` 由运行时预置，直接 `import { useState } from "react"` 即可。
- Tailwind 由浏览器运行时提供，直接在 className 中使用 utility classes。

**如果需要第三方库**，使用 [esm.sh](https://esm.sh) CDN，通过顶层静态 import 引入：

```tsx
import dayjs from 'https://esm.sh/dayjs';
import * as echarts from 'https://esm.sh/echarts@5.5.1';
```

只支持顶层静态 `import`，不支持 `import()` 动态导入 esm.sh 模块。esm.sh 导入需要网络访问；优先用原生 CSS/JS 实现，只在确实需要时引入外部依赖。

## 编辑规则

- 直接修改 `site/` 内文件来满足用户要求。
- 优先做最小且有针对性的修改，避免不必要的大改。
- 默认面向中文读者，可见文案优先使用简体中文。
- 除非用户明确要求移动端、竖屏或自适应网页，默认生成单屏 16:9 的 1920x1080 看板。
- 默认把首屏视为完整画布，不要产出依赖长滚动的文章式页面。
- 默认导出 App 组件，在 `site/src/App.tsx` 中完成主体修改。
- 入口挂载逻辑由系统提供，不要自行调用 createRoot，也不要改动挂载协议。
- 如需拆分组件，只在 `site/src/components/` 下新增或修改文件。
- 优先使用静态 className 字面量；避免通过字符串拼接、模板字符串插值或运行时映射生成 Tailwind 类名。
- `site/src/index.css` 只用于少量普通 CSS、字体或补充样式；不要在其中写 @tailwind、@config 或依赖 Tailwind 配置文件。
- 可以使用 Tailwind 的 arbitrary values，例如 `bg-[#0b1220]`、`tracking-[0.3em]`。
- 不要创建、修改或依赖 package.json、node_modules、vite.config.*、tailwind.config.*、postcss.config.*、tsconfig.json 等工具链文件。
- 不要启动本地开发服务器（如 vite dev、http-server 等）。预览由 Zmetaboard 平台提供，修改文件后在产品中刷新即可看到效果。

## 数据

Widget 绑定数据集后，平台会在预览时自动通过 API 加载数据并注入 widget，**不需要在代码中嵌入数据**。

### 了解可用数据集

读取 `datasets.json` 查看当前看板有哪些数据集。每个 dataset 主要字段：
- `id` — 数据集唯一标识，绑定 widget 时使用
- `name` — 数据集名称
- `fields[]` — 字段列表，每项有 `name`（字段名）和 `type`（`string` / `number` 等）

如需了解数据内容，可读取 `file-data/` 下的 CSV 文件（通过 `datasources.json` 中的 `config.dataId` 找到对应文件）。

### 通过 API 请求数据

也可以通过 HTTP API 获取数据。从 `metadata.json` 中读取看板 `id`（即 `visdocId`），然后：

```bash
# 获取数据配置（datasources + datasets）
GET /api/visdocs/{visdocId}/data-config

# 获取文件数据（dataId 来自 datasource.config.dataId）
GET /api/visdocs/{visdocId}/file-data/{dataId}
```

### 将 Widget 绑定到数据集

在 widget manifest（`site/assets/zmeta-ai-board-widgets.json`）中，通过 `dataConfig` 绑定：

```json
{
  "id": "sales-chart",
  "type": "bar",
  "config": { "title": "销售对比" },
  "dataConfig": {
    "datasetId": "<datasets.json 中的 id>",
    "config": {
      "categoryField": "<字段名，与 fields[].name 一致>",
      "valueField": "<字段名>"
    }
  }
}
```

要点：
- `datasetId` 必须使用 `datasets.json` 中的实际 `id`，不要改写成名称。
- 字段名必须与 `fields[].name` 完全一致，不要翻译、缩写或改写。
- 绑定后平台自动提供数据，不要把数据硬编码到 widget config 或 JSX 中。

> 数据文件只允许读取，不允许创建、删除或修改。如需变更数据，请在 Zmetaboard 产品中操作。

## Widget 协议

当前 AI 看板支持在 React JSX 中通过宿主节点调用 Zmetaboard widget。
当需求能用 widget 表达时，优先使用 widget，而不是手写 SVG、Canvas 或复杂 DOM 图形。

### 使用方式

1. 在 JSX 中渲染宿主节点：`<div data-zmeta-widget-id="你的组件id" className="min-h-[320px]" />`
2. 在 `site/assets/zmeta-ai-board-widgets.json` 中新增同 id 的 widget 定义，字段至少包含 `id`、`type`、`config`
3. widget 宿主节点需要有明确高度（通过 className 或 style 提供 min-height 或 height）
4. 不要自行实现 widget runtime，也不要改动平台提供的 widget 加载协议

### 支持的 Widget 类型：bar、line、pie、radar、funnel、treemap、sunburst、bubble、wordcloud、water-ball

### Widget Manifest 格式 (`site/assets/zmeta-ai-board-widgets.json`)

```json
{
  "version": 1,
  "widgets": [
    {
      "id": "my-chart",
      "type": "bar",
      "config": { ... }
    }
  ]
}
```

### Widget 配置参考

#### bar（柱状图）
- 适合分类对比、排行榜、分组统计。
- 简化 config 优先写成：{ "title": "任务分类对比", "subtitle": "静态示例", "categories": ["规划","执行","验收"], "series": [{ "name": "项目数", "data": [3, 5, 2] }] }。
- 对于 bar，不要发明其他数据结构；优先使用 categories + series。

#### line（折线图）
- 适合趋势变化、时间序列、阶段推进。
- 简化 config 优先写成：{ "title": "推进趋势", "subtitle": "近 6 周", "categories": ["第1周","第2周","第3周"], "series": [{ "name": "完成项", "data": [5, 8, 12] }] }。
- 对于 line，不要发明其他数据结构；优先使用 categories + series。

#### pie（饼图）
- 适合占比、构成、份额分布。
- 简化 config 优先写成：{ "title": "任务占比", "items": [{ "name": "已完成", "value": 68 }, { "name": "进行中", "value": 22 }, { "name": "待开始", "value": 10 }] }。
- 对于 pie，优先使用 items 数组，每项只写 name 和 value。

