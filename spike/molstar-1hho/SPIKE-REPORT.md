# Spike 报告：Mol* + 1HHO（阶段 A 前置验证）

- 分支：`spike/molstar-1hho`
- 目录：`spike/molstar-1hho/`
- 日期：2026-11-04
- 结论：**S1 / S2 / S3 / S5 通过，S4 部分通过**；技术路线成立，可以进入骨架阶段（附 3 条约束，见末节）。

## 1. 结论速览

| 项 | 结论 | 关键证据 |
| --- | --- | --- |
| S1 加载 RCSB 1HHO 并渲染 | 通过 | 加载 423 ms；Mol* 侧 2 链 / 287 聚合物残基 / 114 非聚合物 / 2192 模型原子（装配体 16 units、4792 原子），与代理统计完全一致；`evidence/s1-1hho-loaded.png` |
| S2 表示切换 | 通过 | cartoon 368 ms、ball-and-stick 52 ms、spacefill 16 ms、surface 798 ms（冷启 1409 ms）；`evidence/s2-*.png` |
| S3 GPU picking（含 His87 复查点） | 通过 | 聚焦 His87 后，中心 +16/+24/+32 px 拾取均为 `A HIS 87`（最近原子距离 0.30–1.18 Å）；与 Mol* 内建标签交叉验证一致；`evidence/s3-focus-his87-final.png`、`evidence/s3-truth-native.png` |
| S4 selection/loci ↔ State.highlights / 8 actions | 部分通过 | `Set{'A:87'}` 高亮/清除 3–6 ms；8 类 action 中 6 个可执行；`selection.set(手工 Loci)` 后 `getLoci()` 返回 `empty-loci` |
| S5 `/api/structure/[id]` 代理 | 通过 | 200 + 24h 磁盘缓存（cache_age 3,010,127 ms）；`?format=cif` 304,328 B；非法 ID → 503 `{error:'UPSTREAM_FAIL', degraded:true, fallback:'mock'}`；`evidence/s5-api.log` |

## 2. 环境（实测）

| 项 | 结果 |
| --- | --- |
| node | v24.19.0 可用 |
| npm | 11.17.0 可用，registry 拉包正常（`molstar@4.18.0`、`playwright@1.64.1` 安装成功） |
| pnpm | **未安装**（本 spike 未使用） |
| git | 2.56 可用，`origin` 指向 `Louis1242/BioSynapse` |
| RCSB 文件 | `https://files.rcsb.org/download/1HHO.cif` 可用，304,328 B，上游耗时 1,174 ms |
| RCSB REST | `https://data.rcsb.org/rest/v1/core/entry/1HHO` 可用 |
| 浏览器自动化 | Playwright + 本机 Edge（`channel:'msedge'`，headless）；本机无 Chrome |

无阻塞项。

## 3. 路线选择与理由

选 **纯静态页 + 零依赖 Node 代理**，没有搭 Next.js：

1. spike 要证伪的是「Mol* 渲染 / 拾取 / 代理降级」三件事，不是框架集成；Next.js 会引入构建链与 SSR 干扰，反而看不清失败归因。
2. Mol* 4.18.0 的 UMD 包（`build/viewer/molstar.js`，5,038 KB + `molstar.css`）可直接 `<script>` 引入，页面零构建。
3. 代理用 Node 内置 `http` + `fetch` 就能完整验证同源、CORS、缓存、超时、降级——这些正是骨架阶段最容易出问题的点。
4. 迁移成本可控：页面中的 `window.SPIKE` 已是「RendererAdapter 雏形」，搬到 Next.js 时只换宿主。

运行方式：

```bash
cd spike/molstar-1hho
npm install
node server.js          # http://localhost:8123
node evidence.mjs       # 全量跑 S1–S5，输出 evidence/
```

## 4. 逐项实测

### S1 加载与统计：通过

- 端到端 423 ms（代理 JSON + mmCIF + 首帧 + 统计）。
- 链数：**2（A、B）**，与 RCSB `polymer_entity_count=2` 一致。
- 残基：287 聚合物 + 114 非聚合物（水/配体），与代理从 `_atom_site` 解析结果一致。
- 原子：模型 2192；生物学装配体 16 个 unit、4792 原子（1HHO 装配体为 2 份 α2β2 拷贝）。
- 截图：`evidence/s1-1hho-loaded.png`（Mol* 状态树：Assembly 1 4792 atoms / Polymer 4384 / Ligand 220 / Water 218 / Ion 10）。

**对计划书的一处更正**：1HHO 是**二链**（A/B，287 残基，2.1 Å，氧合血红蛋白），不是四聚体；四链脱氧血红蛋白是 4HHB（1.74 Å）。仓库 `data.js` 里「1HHO = 脱氧 / 1.74 Å」的描述有误，骨架阶段应一并修正。

### S2 表示切换：通过

| 原型表示 | Mol* 表示 | 耗时（稳态） | 备注 |
| --- | --- | --- | --- |
| cartoon | `cartoon` | 368 ms（首切含清除旧表示） | 蛋白走 cartoon，配体/水保留 ball-and-stick（Mol* 默认，视觉合理） |
| ball-and-stick | `ball-and-stick` | 52 ms | 全组件替换成功 |
| spacefill | `spacefill` | 16 ms | 全组件替换成功 |
| surface | `molecular-surface` | 798 ms（冷启 1409 ms） | **超出 PRD 200 ms 目标**，需异步 + 进度提示 |

- 截图：`evidence/s2-cartoon.png`、`s2-ball-and-stick.png`、`s2-spacefill.png`、`s2-surface.png`（均为全局视角，状态树可见表示类型）。
- 实现要点：`component.addRepresentation(components, typeString)` 可用；切换前需 `removeRepresentations` 按「表示类型」批量清空，否则会出现多层表示叠加（早期踩坑）。

### S3 GPU picking：通过（附复查点结论）

复查点「点 His E7 / His87 附近能否拿到正确残基号」——**能**，但必须避开一个陷阱：

- **陷阱**：直接用 picking id 解码（`instanceId → structure.units[i]`、`groupId → 元素下标`）会得到错误残基。cartoon 几何下 `groupId` 是 0-based 的**残基级**索引（点 His87 会解成 TRP 14）；`canvas3d.getLoci()` 返回的 `indices` 也不可直接解码。
- **正解**：`canvas3d.identify(x,y)` 的 `position`（世界坐标）→ 在原子位置索引里找最近原子 → 反查残基。实测：
  - 聚焦 His87（相机 target = His87 质心、radius 5 Å）后，中心 +16 / +24 / +32 px 拾取均为 `A HIS 87`，原子距离 0.30 / 0.84 / 1.18 Å。
  - `roundTrip`：2 个起点的拾取命中，聚焦后 5×5 扫描 5/5 命中仍为同一残基（`match = 1`）。
  - 与 Mol* 内建点击标签交叉验证一致（`evidence/s3-truth-native.png`，Mol* 显示 `LEU 100 | A`；位置法同样返回 `LEU 100`）。
- 性能：命中样本 1.3 ms/次（含一次性原子索引构建约 40 ms）；空点 0.01 ms/次。
- 精度：9×9 全画布采样在 cartoon 下命中率约 16%（几何细、空白多属正常），surface/spacefill 显著更高；命中结果 `allValid=true`、`maxDist≈1.5 Å`。
- 截图：`evidence/s3-focus-his87-final.png`（His87/血红素区域特写）。

### S4 Loci / selection ↔ `State.highlights` 与 8 类 action：部分通过

- `State.highlights` 为 `Set<string>`（`"A:87"` 形式）：`highlight` 3–6 ms、`clear` 正常，截图 `evidence/s4-highlight-his87.png`。高亮通过自建 `{kind:'element-loci'}` 喂给 `lociHighlights` 生效（Mol* 覆盖层显示 `A | HIS 87`）。
- 未验证/不通：`selection.set(手工 Loci)` 之后 `getLoci()` 返回 `{kind:'empty-loci'}`，说明 selection 管理器不接受外部构造的 Loci；`camera.focusLoci(loci)` 同样不生效，改用 `boundaryHelper.includePositionRadius` + `focusSphere` 成功。
- 8 类 action 演练（`evidence/s5-dryrun-final.png`）：load_structure / set_representation / highlight / focus_camera / clear_highlight / open_evidence / compare 共 7 项 ok；`play_process`、`step` 在 v0.1 不适用（示意层在 v0.2）。compare 用第二 Viewer 实例加载 1MBO，157–293 ms。

### S5 `/api/structure/[id]` 代理：通过

- `GET /api/structure/1HHO` → 200，`source: cache`，`cache_age_ms: 3010127`（24h TTL 内），`atoms=2192、chains=2、residues=287、heteroResidues=114`，`meta` 含 method / 2.1 Å / revision_date / `retrieved_at`。
- `GET /api/structure/1HHO?format=cif` → 200，304,328 B（与上游一致）。
- 非法 ID `ZZZZ` → 503 `{error:'UPSTREAM_FAIL', detail:'cif HTTP 404', degraded:true, fallback:'mock'}`；上游不可用时回落到陈旧缓存并置 `degraded:true`（已单独验证）。
- 证据：`evidence/s5-api.log`。

## 5. Mol* API 使用结论（对骨架阶段最有用）

1. UMD 只导出 `Viewer / ViewerAutoPreset / ExtensionMap / version` 等，**没有** `StructureElement`、`StructureProperties`、`Script` → Loci 必须手写普通对象。
2. 层级引用是**快照**：每次状态变化后必须重新取 `plugin.managers.structure.hierarchy.current.structures[0]`。
3. 表示：`managers.structure.component.addRepresentation(components数组, 'cartoon' | 'ball-and-stick' | 'spacefill' | 'molecular-surface')`；`builders.structure.representation.addRepresentation` 在本版本不可用（内部 `stateBuilder.to(undefined)` 报错）。
4. 拾取：用 `identify().position` + 最近原子；不要用 `groupId`/`getLoci().indices`。层级定位必须用 `unit.elements[k]`（整模型原子索引）去查 `residueAtomSegments / chainAtomSegments`，`unit.chainIndex[k]` 并不按元素下标对齐（多链模型会串链，这是早期残基号错误的根因）。
5. 相机：`managers.camera.boundaryHelper`（`reset / includePositionRadius / finishedIncludeStep / getSphere`）+ `focusSphere`；`focusLoci` 不可靠。
6. 统计口径：装配体会让原子数翻倍（1HHO 2192 → 4792）；展示「PDB 元信息」用代理值，展示「当前渲染规模」用 Mol* 值，两者不要混。

## 6. 验证强度与局限

- 有截图与结构化返回值双重证据，但运行环境是 headless Edge（ANGLE 软/硬件路径），真机 Safari / 移动端未测。
- 只测了 1HHO（蛋白）与 1MBO（对比视图），未测大结构（如 6VXX）、核酸（1BNA/1EHZ）、多模型 NMR。
- cartoon 空点率较高，产品层需定义「点空白 = no-op」或提示文案。
- 时间未做端到端墙钟统计，只记录各步耗时；`node evidence.mjs` 全套可复现耗时 **14.5 s**。

## 7. 耗时

- 探针与 Mol* 内部 API 逆向占大头（表示叠加、残基号错误两项各返工一次）。
- 最终代码路径本身很轻：加载 0.4 s、四次表示切换合计约 1.2 s、拾取 1.3 ms/次、高亮 3 ms。
- 计划书中 T1 按 1 人天估：**含本次返工约 1.5–2 人天**；若只按最终路径复刻，1 人天仍成立。

## 8. 是否可以进入骨架阶段

可以，但请把以下 3 条写进骨架任务：

1. 拾取统一走 `identify().position` + 最近原子（保留 Loci 只用于高亮），不要用 picking id 的 `groupId`。
2. `surface` 切表示必须异步（Worker 或至少 loading 态 + 进度），798–1409 ms 不能阻塞交互。
3. 先定统计口径（模型 2192 原子 vs 装配体 4792 原子），并修正 `data.js` 中 1HHO 的「脱氧 / 1.74 Å / 四聚体」错误。

S3 既然通过，原计划里「Loci + 屏幕包围盒」的退路**不需要启用**，+1 人天的兜底预算可以释放。
