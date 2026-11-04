# BioSynapse

> 开源 3D 互动生命科学学习平台原型 | 让每个学生都能看见、拆开、追问一个蛋白质。

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Cite](https://img.shields.io/badge/Cite-CITATION.cff-yellow.svg)](CITATION.cff)
[![Status](https://img.shields.io/badge/Status-v0.1.0--alpha-orange.svg)]()

## 这是什么

BioSynapse 是一个面向生命科学教学的 3D 互动工作台原型：用户在 3D 视口中查看蛋白结构、切换表示法、点击残基追问，界面以「讲解 + 证据抽屉」的方式承载问答。

**当前它是一个界面原型，不是一个可用的教学工具。** 科学内容全部是演示数据，见下方「数据来源与局限」——请勿据此得出任何生物学结论。

## 当前状态

| 能力 | 状态 |
|---|---|
| 3D 视口、拖拽旋转/缩放、表示法切换（cartoon / ball-and-stick / spacefill / surface）、点击残基 | 已实现（自研伪 3D 渲染，零依赖） |
| 「提问 → 加载结构 → 高亮 → 讲解 → 证据抽屉」交互流程 | 已实现（前端流程完整） |
| 结构对比视口、过程动画演示 | 已实现（演示数据） |
| 真实 PDB / AlphaFold 结构加载与解析 | **未实现**（预设结构为程序化生成坐标） |
| AI 讲解、自然语言理解 | **未接入**（原型无任何网络请求，讲解为预置文本） |
| 后端校验、编号映射、引用抽检、无源断言校验 | **未实现**（原型中为本地模拟，证据标记 `verified: false`） |
| 分子对接、科研辅助 | **未实现**（仅出现在项目描述与规划中） |
| 构建脚本、测试、CI | 无（纯静态页面，无构建步骤） |

原型自检截图见 `qa_screenshots/`（交互流程 step1–step5、三种表示法、对比视口）。

## 快速开始

不需要 Node、不需要构建工具、不需要任何 API Key。

### 方式 A：直接打开单文件版（零依赖，最快）

双击仓库根目录的 `BioSynapse-standalone.html`，浏览器打开即可。

### 方式 B：本地静态服务打开原型目录

```bash
python -m http.server 8080 -d prototype
# 打开 http://localhost:8080/
```

或用任意静态服务器（nginx、`npx serve prototype` 等），站点根目录指向 `prototype/`。

### 方式 C：Docker Compose

`Dockerfile` 用 `nginx:alpine` 托管 `prototype/`，对外端口 8080：

```bash
docker compose up --build
# 打开 http://localhost:8080/
# 停止：docker compose down
```

## 目录结构

```
.
├── BioSynapse-standalone.html   # 单文件版（样式与脚本已内联，可直接双击）
├── prototype/                   # 原型源码，Docker/静态服务的站点根目录
│   ├── index.html               # 页面骨架
│   ├── styles.css               # 视觉方向「纸面 · 墨色」
│   ├── renderer.js              # 自研轻量伪 3D 渲染器（投影 + 画家算法，零依赖）
│   ├── app.js                   # 应用层：状态单源 + 指令化执行
│   └── data.js                  # 演示数据（MOCK，全部 verified:false）
├── qa_screenshots/              # 原型自检截图（交互流程与表示法）
├── .trae-html-share-packages/   # Trae 生成的分享包产物（zip，含单文件版）
├── Dockerfile / docker-compose.yml
├── README.md / LICENSE / CITATION.cff
└── .gitignore
```

## 数据来源与局限

- `prototype/data.js` 是**演示数据**：结构几何为程序化生成的「类真实」坐标，不是真实 PDB 坐标；文件内 12 条证据全部 `verified: false`，UI 上带「演示数据 · 未校验」标识。
- 科学表述取自教科书级共识，引文为摘译占位，**解析与校验管线尚未接入**。
- `prototype/renderer.js` 是自研的轻量伪 3D 渲染器（自研投影 + 画家算法），用于验证「状态单源 → 指令化执行 → 渲染器只读」的边界；真实工程中该层应由真正的分子渲染框架承担，接口形状保持一致。
- `prototype/app.js` 不含任何 `fetch` / `XMLHttpRequest` / `WebSocket` 调用；页面唯一的网络请求是加载 Google Fonts（字体加载失败时会退化为系统字体），不上传任何数据。

因此：本仓库当前只适合用于**交互与视觉评审**，不能用于教学、科研或任何依赖科学准确性的场景。

## 许可与引用

- 代码以 [Apache-2.0](LICENSE) 许可发布。
- 引用信息见 [CITATION.cff](CITATION.cff)。
