# 更新日志

## v0.13.0 · 2026-11-11 AI 助手：Siri 光球 + 自由拖动 + 液态玻璃界面

- **Siri 风格动效光球**（新增 `SiriOrb.tsx`）：替代原来与玻璃风格不符的静态机器人图标。
  多层旋转极光（电蓝/紫/品红/青 conic-gradient 双向旋转）+ 呼吸光晕 + 球面高光 + 玻璃体积感；
  流式回答时加速旋转并向外扩散涟漪。仅 transform/opacity 动画，`prefers-reduced-motion` 下静止。
  悬浮球与面板头部都用它，悬浮球底座是通透玻璃圆片。
- **悬浮球可自由拖动**：按住拖到任意位置（视口内 8px 钳制），位置记忆到 localStorage，双击复位；
  用 5px 阈值区分拖动与点击——拖动结束不会误触发开关面板。
- **助手面板可自由拖动**（原有头部拖拽保留）：位置记忆 + 双击复位，不再锁死右下角。
- **助手面板液态玻璃**：背景从 .86 调到 **.5 透度**让折射引擎的边缘弯折透出来；
  真折射（`useLiquidGlass`，Chromium）+ `overflow:clip` 圆角干净，非 Chromium 自动降级磨砂。
- 实测（CDP）：光球 `siri-spin` 动画运行；悬浮球拖到 [172,172] 精确命中且持久化、拖动不误触开关；
  面板拖动 [-150,-100] 持久化、折射档生效、**零运行时错误**；光球渲染出彩色极光像素。
- pytest 92 ✓ · e2e 10/10 ✓ · build ✓

## v0.12.6 · 2026-11-11 明亮模式玻璃可见 + 消除直角 + 进一步提速（用户反馈）

**直角"没收束"根因**：折射表面（搜索胶囊/统计面板）是 `overflow:visible`，而 `backdrop-filter`
的 SVG 滤镜结果是**矩形**，没被圆角裁剪 → 在圆角玻璃四周露出方形边界。
- 修复①：所有 `[data-lg-support="refraction"]` 加 `overflow:clip`，把滤镜结果裁进圆角轮廓
- 修复②：首页搜索胶囊/统计面板**改用纯 CSS 焦点玻璃 `.glass-focal`**（backdrop-blur 仅 2 处），
  不再用 SVG 折射 → 既无矩形滤镜边界，也无持久折射的每帧合成成本

**明亮模式玻璃不明显**：
- `.glass-focal`：半透底 + 顶部镜面高光 + 清晰白边 + 品牌蓝抬升阴影，明亮模式下顶边高光与背景差 **74~97**
- 卡片 `.card-lg`：抬升阴影改带品牌蓝、底边改白色高光（去掉原先像"底线"的暗色底边），顶边与背景差 **60~71**
- `.lg-edge` 明亮边光：顶部/左侧更亮、去掉暗色底边

**性能**：去掉首页 2 处持久折射后，稳态 **59fps / 2 卡顿 / 最大间隔 33ms**（基线 26fps/150ms）。
折射只保留在打开时才出现的浮层（⌘K/助手/下拉），且都 `overflow:clip` 圆角干净。

对比度采样真实像素：ink 15.9~16.3 / subtle 5.37~5.5，均 ≥ AA。
验证：pytest 92 ✓ · e2e 10/10 ✓ · build ✓ · CDP 帧率/圆角/玻璃可见度/对比度实测

## v0.12.5 · 2026-11-11 性能修复 + 玻璃质感全覆盖（用户："切换卡顿/不是所有模块都有效果"）

**卡顿根因（CDP 像素级 A/B 定位，非折射本身）**：
- 滚动基线 **26fps / 11 卡顿帧 / 最大间隔 150ms**。逐项 A/B：
  - 关全部 backdrop-filter → 60fps（确认 backdrop-filter 是瓶颈，而非折射数量）
  - 只关**常闭的下拉 mega-dd** → 60fps：它 opacity:0 但 backdrop-filter 仍每帧合成背景，是主凶
  - 颗粒 `body::before`（fixed + mix-blend-mode）→ 开 50fps / 关 60fps：独立混合层强制全屏合成
- 修复：① mega-dd 的 backdrop-filter 只在 `.is-open` 时启用，收起彻底关闭；
  ② 颗粒烘焙进 body background-image 顶层（SVG 自带低透明度），去掉独立 blend 层；
  ③ 卡片去掉 backdrop-filter（数量多），改「半透 + 镜面高光 + 边光」呈现透明玻璃，GPU 成本极低；
  折射只留焦点表面（搜索胶囊/统计面板）与 transient 浮层。
- **复测稳态 57fps**（软件渲染；真实 GPU 浏览器 60），最大间隔 150→50ms。

**玻璃质感全覆盖**：
- 卡片 `.card-lg` 更透（.42）+ 顶部镜面高光带，底衬网格渐变透出 = 透明质感
- 4 个纯白模态框（上传/编辑/批量导入/内容卡查看）→ 新增 `.glass-modal`（半透+磨砂+边光）
- 13 个白底小控件（顶栏按钮/hero 徽章/快捷 chips/筛选 tab）统一半透玻璃（计算样式核验 stillSolid=0）
- 对比度采样真实渲染像素复核：ink 14~17 / subtle 4.83~5.77，均 ≥ AA

验证：pytest 92 ✓ · e2e 10/10 ✓ · build ✓ · CDP 帧率/覆盖/对比度实测

## v0.12.3 · 2026-11-11 液态玻璃换引擎：内联 LiquidGlassUI（真折射替代湍流噪声）

用户反馈"液态玻璃效果不行"。对比三个候选实现后换引擎：

| 来源 | 技术 | 结论 |
|---|---|---|
| `shuding/liquid-glass` | 全局 SVG 滤镜套用到圆角元素（npm 包装 `liquid-glass-js` 周下载 455，三者中最高） | 效果可用但无组件 API/令牌/测试，可控性差 |
| `archisvaze/liquid-glass` | SVG feDisplacementMap + Three.js WebGL 双引擎，可调厚度/bezel/IOR | 效果最好但是**演示站**不是库；WebGL 需 three.js 且是全屏着色器，不适配多卡片应用 |
| **`Wei-Zhang09/LiquidGlassUI`（采用）** | SDF + Snell 折射剖面 + 逐像素镜面高光 + 按几何缓存滤镜 + UA 能力门控 + vitest | MIT、零运行时依赖、有 React 封装与令牌体系，**最贴合本项目**；未发布 npm（故下载量为 0） |

- **内联引擎**（`src/vendor/liquidglass/`，MIT，附 `LICENSE` + `VENDOR.md` 记录上游 commit）：
  `capabilities.ts` / `refraction.ts` / `sdf.ts` / `core/filter-registry.ts` / `generated/tokens.*`
  共 893 行；未内联 `elements/`（Web Components）与 `react/` 封装——本项目已有组件体系，
  引入 shadow DOM 与既有 Tailwind 样式冲突，收益不抵成本
- **`src/hooks/useLiquidGlass.ts`**：复刻上游 `glass-base` 的三级降级（refraction→frost→solid）、
  ResizeObserver + rAF 调度、0×0 不降档（未布局）、<4px 降 frost（避免"声称折射实则空白"）
- **修正我们此前的错误探测**：`CSS.supports('backdrop-filter','url()')` 在 Firefox/Safari
  **返回 true 但静默不渲染**，故删除 `main.tsx` 的探测与 `index.html` 的 feTurbulence 滤镜，
  改用上游 UA 嗅探（含 HeadlessChrome 无词边界的坑）
- **边缘高光换做法**：`mask-composite` 边环在圆角处是硬边（上游实测亮度突跳 +38/+55，
  正是"看着像塑料框"的原因）→ 改多层 inset box-shadow + `mix-blend-mode: screen`
- **性能护栏**：真折射只给浮层（⌘K / 通知 / 用户菜单 / MegaMenu 面板 / 助手面板），
  卡片走磨砂 + inset 高光；滤镜按 `尺寸×圆角×表面×模糊` 缓存，同尺寸共用一个
- 清理死代码：`--lg-edge` 令牌已无引用，删除
- **无头 Chrome 实证**：`data-lg-support="refraction"`、`--lg-filter: url(#lg-filter-0)`、
  滤镜链含 3× `feDisplacementMap`（RGB 色散，scale≈167.6）+ 2× `feImage`（位移贴图 / 镜面高光贴图）；
  卡片 0 个 `data-lg-support`（确认走磨砂档）
- 回归：pytest **92 全过**、`e2e_check` **10/10**、build ✓；主包 177→218KB（gzip 68KB，引擎成本）

## v0.12.2 · 2026-11-11 助手窗口可拖拽 + 明亮模式玻璃加强（用户反馈）

**助手不能拖动** → `FloatingAssistant` 原来只有右下角缩放手柄，面板被 Tailwind
`bottom-*/right-*` 钉死。现在：
- 头部整体为拖拽把手（`onPointerDown` + window `pointermove/pointerup`），带 `GripHorizontal` 提示、
  `cursor-grab/grabbing`、`touch-none`、`select-none`；头部按钮 `closest('button')` 排除，不误拖
- 位置钳制在视口内（留 8px 边距，小屏也拖不丢），写入 `localStorage.aiweb_assistant_pos`，刷新后保留
- **双击头部复位**回右下角（同样排除按钮双击）；`window.resize` 后自动拉回可见区域
- 一致性：拖拽前面板右下锚定、拖拽后左上锚定，缩放符号随锚定切换（否则"往右拖却变窄"）

**明亮模式玻璃不明显** → 根因是可透内容太弱：底衬仅 10%/8%，卡片 `.62` 近实色。现：
- 底衬三团品牌光 `.20 / .17 / .14`（原两团 10%/8%），基色微调到 `#f4f6fb`
- 卡片 `.card-lg` 降到 `.50` + `blur(18px) saturate(1.9)`，斜向反光做进 `background` 图层
  （不用 `::after`，避免白色渐变盖在文字上方影响可读性）；边框高光提到 `.72`
- 页脚 `text-gray-300`（浅底约 3:1）改 `text-subtle`
- 对比度复算（最坏=最强光斑中心）：`text-subtle #5b6472` **5.05**、`text-ink` **14.98**，
  次要灰阶覆盖仍为 `#5b6472` → 全部 ≥ AA 4.5

## v0.12.1 · 2026-11-11 Agent SSE 会话生命周期修复 + 液态玻璃回归新结构

**fix：Agent SSE 在真实流式路径上必然报错（生产缺陷，非测试问题）**
- FastAPI ≥0.106 会在响应体开始流式**之前**执行 `yield` 依赖的收尾（`get_db` 已 `close()`），
  而 `stream_run/stream_resume/_loop` 全程复用请求级 `db` 和 ORM `user` →
  流里访问 `user.username` 直接 `DetachedInstanceError`，9 个 Agent 用例全线红（单跑也失败）
- 修法（服务层零改动）：`routes/agent.py` 先取出纯数据 `username`/`session_id`，
  生成器内部 `SessionLocal()` 自持、`finally` 关闭；`user` 传 `SimpleNamespace(username=…)`
- 测试侧两处配套：`mock_agent` 原本只 patch `agent_service.get_ai_config`，而路由是函数内
  `from services.ai_service import get_ai_config` 拿真身 → 补 patch `services.ai_service`；
  `test_run_requires_key` 期望从「SSE error 事件」对齐到实际契约（HTTP 400 + detail，
  并加断言"预检不落库、无孤儿会话"）。pytest **92 全过**，`requirements-dev.txt` 补 alembic。

**feat：液态玻璃重新装回 v0.10 扁平结构（保留 SkillHub 蓝与明亮默认）**
- 底衬：`body` 两团极淡品牌光（浅 10%/8%，深 16%/10%，`background-attachment: fixed`）——
  没有可透的背景，`backdrop-filter` 等于白做，这正是 v0.10 之后"玻璃感没了"的根因
- 卡片：`.card-lg` 改半透磨砂（浅 `#fff/.62`+blur16/sat1.6，深 `#151821/.62`+blur16/sat1.45）
  + `inset` 顶高光；`BentoCard` 挂 `.lg-edge`（`mask-composite` 1.2px 边缘高光，**不加 overflow:hidden** 以免裁剪子元素）
- 浮层：`--dd-bg` 由纯 `#fff`/`#171b25` 改半透 `.86`，`.glass-pop/.mega-dd` 恢复 `blur(20px) saturate(1.6)`；
  `index.html` 放回 `#liquid-glass` 滤镜，`.has-refract`（`main.tsx` 能力探测）仅 Chromium 走真折射，
  其余浏览器保留普通磨砂 —— 之前 CSS 消费被删、探测仍活着，属残留死代码，现已重新接通
- 可达性：卡片变亮后浅色次要文字跌破 AA，`html:not(.dark) .text-gray-400/500` 压到 `#5b6472`；
  合成底色实测对比度 8/8 全 PASS（浅 5.53~16.39，深 5.85~14.49），reduced-motion 下关闭全部模糊

## v0.9.x · 2026-11-10 凌晨自主迭代轮次（详见 WORKLOG.md）

主版本 v0.9 之后的当夜加餐轮，全部基于 82 用例基线 + e2e_check 10 项回归：

- **v0.9.1**：ask_user 自由文本回退 / FAB 建议常驻轮询 / 登录防爆破（5 次锁 15 分钟）
- **v0.9.2**：/agent/run 无 Key 预检前移 / ask 回答气泡渲染修复 / 挂起占位清理 / get_briefing 工具
- **v0.9.3**：Agent 重新生成（走工具循环）+ 流式自动滚动贴底守卫
- **v0.9.4**：⌘K「问 AI 助手」行 / Ctrl+J 快捷键 / 上下文带资源 id / search_notes_links / runs 清理
- **v0.9.5**：笔记 [[双向链接]] / 提示词注入防御 / 快捷键浏览器实测
- **v0.9.6**：对话导出（入助手历史抽屉）/ 首页助手卡文案 / 简报页「让 AI 解读」联动
- **v0.9.7**：scripts/e2e_check.py 一键 API 回归（10 项）
- **v0.9.8**：README 截图更新（含悬浮助手）
- **v0.9.9**：start-all.bat 智能启动 mock / list_comments 工具
- **v0.9.10**：中止时 run 落 stopped / 悬浮球与 BackToTop 让位 / 抽屉自动关
- **v0.9.11**：**资源版本历史**（更新自动快照 + 一键回滚 + 权限）
- **v0.9.12**：**账号大小写归一**（SSO Administrator↔administrator 数据合并 + 测试前提修正）
- **v0.9.13**：收藏通知创建者 / 资源页「问 AI」按钮 / CI e2e-api job
- **v0.9.14**：资源更新通知收藏者/点赞者（实质变化才通知，上限 50 人）
- **v0.9.15**：会话 AI 自动命名（重命名过不覆盖）
- **v0.9.16**：AGENTS.md 开发约定文档
- **v0.9.17**：append_to_memo 工具（工具总数 15）

## v0.9 · 2026-11-10 悬浮 AI 助手 + Agent 化 + AI Key 个人化（dsh-superagent 精髓移植）

> 本轮依据用户两点反馈重构 AI 形态：①AI 不该占一个独立页面，做成悬浮助手即可；②AI Key 应在个人设置里配置，
> 而不是一个显眼的全局页签。同时参考 DeepSeek 开源的 dsh-superagent 原型（研究用途）移植其设计精髓：
> 工具循环 / 授权（Mandate 简化）/ 结构化提问（Attention）/ 任务卡（Report 状态机）/ observe→auto 渐进开放。

### AI Key 个人化（安全重构）
- 新表 `user_ai_configs`：Key 用 Fernet 加密落库（密钥派生自 data/secret.key；cryptography 缺失时诚实降级并告警）
- `GET/PUT /api/me/ai-config`：打码读写、"-"显式清除、尾部 4 位 reveal 校验；生效链 **个人 → 全局 KV → .env**
- **安全修复**：`PUT /api/settings` 全局键改为 require_admin（此前任何登录用户可改全局 Key，影响全员）
- 设置页「AI 配置」全局大卡退役 → 「个人 AI 设置」折叠卡（生效链展示 + 自动执行开关 + 测试连接）

### 悬浮 AI 助手（形态重构）
- 右下角 FAB（52px 玻璃球 + badge）+ 420px `.glass-pop` 玻璃面板；SSE 消费内聚 zustand store，页面切换对话不断线
- 会话/消息完全复用 ChatSession 与 /api/chat/*，历史零迁移；面板内历史抽屉（切换/重命名/删除）
- 页面上下文自动注入（资源详情页自动取资源名；上下文 chip 可一键关闭）
- **/chat 页面退役**：路由重定向并自动展开助手；导航/MegaMenu/⌘K/首页 CTA 全部改为唤起助手；src/pages/Chat.tsx 删除

### Agent 化（能干活）
- `services/agent_tools.py`：11 个工具（6 只读 + 4 写 + ask_user），全部以当前用户身份执行
- `services/agent_service.py`：agent loop（≤6 轮）→ SSE 事件 meta/step/delta/confirm/ask/error/done
  - function-calling 优先，探测 400 自动降级 ReAct JSON 协议（兼容不支持 tools 的 OpenAI 兼容代理）
  - 写工具默认**确认卡**挂起（AgentRun.waiting_confirm），auto_exec 开启后直通（observe→auto）
  - ask_user **结构化提问**挂起（waiting_input），一次一个具体问题；无选项时前端自由文本回退
  - AgentToolCall 全量审计 + AgentRun 状态机；任务卡轨迹随 ChatMessage.meta 持久化（历史会话可回放）
  - 轮数耗尽诚实收尾；工具异常转失败结果让模型自愈
- `routes/agent.py`：POST /run、POST /resume、GET /runs/{id}
- `ensure_schema_upgrade()` 轻量列迁移（chat_messages.meta）

### Proactive（observe 模式）
- `GET /api/assistant/suggestions`：今日简报就绪 / 24h 新资讯 → 建议卡；FAB badge 常驻轮询
- 只建议不自动执行——写操作仍走确认/自动执行通道

### 工程与安全
- 登录防爆破：用户名+IP 连续失败 5 次锁 15 分钟（429），成功清零
- 移动端头部横向溢出修复（413→382）；ask 卡自由文本回退
- `scripts/mock_llm.py`：本地 Mock LLM（9377），无真实 Key 全链路联调/E2E
- 测试 57 → **69** 用例；浏览器 E2E 全绿（SSO 直登 / Agent 问答 / 确认卡→笔记落库 / /chat 重定向 /
  MegaMenu 唤起 / 个人 Key 生效链 / 加密落库验库 / 深色模式 / 移动端视口）

## v0.8.1 · 2026-11-09 浅色模式液态玻璃"看不出玻璃"

用户反馈：明亮模式没有玻璃感。根因不是没生效，而是**浅色主题卡片背后是一整块死板浅灰 `#f5f6fa`**——
`backdrop-filter` 无内容可混合，blur/saturate 等于白做，视觉上就是白卡。

- **底衬**：`body` 加三层低饱和品牌色径向柔光（靛/紫/天蓝，`background-attachment: fixed`），
  玻璃终于"有东西可透"；深色主题仍由 `.dark body` 覆盖，不受影响
- **卡片调透**：浅色 `.card-lg` `rgba(255,255,255,.68)` → `.42` + `blur(18px) saturate(1.8)`，
  并加 `inset` 顶/底高光与 `rgba(255,255,255,.55)` 描边；边光 `--lg-edge`（浅色）加深一档到 `.20/.18`
- **浅色幽灵按钮**同步玻璃化（`rgba(255,255,255,.55)` + blur/saturate + inset 高光）；浮层 `--dd-bg` `.92` → `.82`
- **可达性顺带修掉**：玻璃变亮后灰字对比度掉到 AA 以下，实测并修复（含一处改版前就存在的问题）
  | 主题 | 元素 | 修前 | 修后 |
  |---|---|---|---|
  | 浅 | `.text-subtle` | 4.1 | **5.07** |
  | 浅 | `.text-gray-400` | 4.1 | **5.07** |
  | 深 | `.text-gray-400/300` | 3.67（旧账） | **5.73** |
  | 两主题 | `.text-ink` | — | 15.05 / 14.32 |
  | 深 | `.text-subtle` | — | 6.97 |
- 实测：浅色卡 `rgba(255,255,255,.42)` + `blur(18px) saturate(1.8)`、底衬 3 团光斑存在、
  两主题 5 页面零横向溢出；pytest 51 全过

## v0.8 · 2026-11-09 液态玻璃质感

配方取自 motionsites 数据集（Unlicense）：Max Reed `.liquid-glass` 高光描边 + Coffee Rewards `feDisplacementMap` 折射。

- **卡片玻璃 `.card-lg` + 边光 `.lg-edge`**：`BentoCard` 全局升级
  - 浅色：`rgba(255,255,255,.68)` + `blur(14px) saturate(1.35)`，边缘描边用**暗色**渐变（浅底才看得见）
  - 深色：`rgba(18,23,30,.62)` + `blur(16px) saturate(1.4)`，边缘描边用**亮色**渐变
  - 边光实现：`::before` + `mask-composite: exclude`，只在 1.2px 边框环上画渐变，`pointer-events: none`
- **浮层真折射**：`<filter id="liquid-glass">`（feTurbulence→feGaussianBlur→feDisplacementMap scale=20）
  注入 `index.html`，经 `backdrop-filter: url(#liquid-glass) blur(10px) saturate(1.5)` 作用于
  ⌘K 面板、通知/用户下拉、MegaMenu 面板；**能力探测**（`CSS.supports` + `.has-refract`）
  ——Firefox/Safari 不支持带 `url()` 的 backdrop-filter，自动回退普通磨砂，不会失去模糊
- **深色输入框/幽灵按钮**：半透明玻璃 + inset 顶部高光（浅色主题保持实色，避免对比度下降）
- **Toast / ConfirmDialog** 同步玻璃语言
- `prefers-reduced-motion` 下关闭全部 backdrop-filter（降级为半透明平涂）
- 修自身引入的回归：新加的 `position: relative` 误覆盖 `.mega-dd` 的 `position: absolute`，
  导致下拉被挤进文档流（宽度 664→306）；改为仅设 `overflow`，⌘K 面板由组件自带 `relative`
- 修对比度回归：`!bg-transparent` 被 `.card-lg !important` 以更高特异度压过，且浅色模式半透白底
  会把暗底图"洗白"→ 英雄带改用 `.hero-band.card-lg { background-color: rgba(11,16,19,.5) !important }`
  固定深色玻璃，两种主题下白字对比度均可读（实测 dark .62 / light .5）
- 实测：MegaMenu 恢复 664×358、`inFlow=true(absolute)`、边光 `pointer-events:none`、行可点；
  5 个页面（资源库/笔记/对话/设置/简报）均无横向溢出；卡片数 1–12 视页面而定

## v0.7 · 2026-11-09 简报归档页 + 字体自托管 + 浮层统一

- **`/briefings` AI 简报归档页**（新）：`GET /api/hub/briefings` 按 `ref_type=briefing` 倒序分页；
  页面可展开历史简报正文（Markdown），顶栏一键「生成今日简报」（复用 `/api/ai/briefing`），
  空态指向设置页订阅；首页 AI 卡新增「查看简报归档 →」
- **导航真实化**：「简报」成为顶级入口（桌面 MegaMenu / 窄屏导航 / ⌘K 页面项三处一致），
  彻底解决上一轮"简报不是页面"的问题——现在它配得上一个入口
- **Geist 字体自托管**：`public/fonts/geist-{400,500}.woff2`（Unlicense 源经 jsDelivr 获取，
  Google Fonts 在本环境不可达），`@font-face` + tailwind 字体栈首位；**内网离线观感一致**，中文自动回退
- **浮层玻璃统一**：新增 `.glass-pop`（`--dd-*` 令牌驱动，随明暗主题切换），
  ⌘K 命令面板 / 通知下拉 / 用户菜单三处从"浅色硬编码"改为与 MegaMenu 同款玻璃语言
- seed 演示简报卡补 `ref_type="briefing"`（并回填现有演示库），新库播种即有归档内容
- **测试**：50 → **51** 用例（新增 `/api/hub/briefings` 过滤/分页/page 钳制）
- 实测（浏览器）：`document.fonts.check('16px Geist')=true`；`/briefings` 渲染与高亮正确；
  浮层底色浅色 `rgba(255,255,255,.92)` / 深色 `rgba(14,19,23,.88)`；**后端重启后 token 仍有效**（JWT 持久化）

## v0.6.3 · 2026-11-09 导航入口去重（用户指出「首页和每日简报不是一个东西吗」）

- **删掉假入口**：AI 能力面板里的「每日简报」原本链到 `/`，与「首页」同一目的地——简报是**功能**（首页按钮）
  而非页面。改为「资讯订阅」→ `/settings#rss`，直达设置页的订阅源区块
- **面板项带锚点**：`Notes 链接库` → `/memos#links`、`资讯订阅` → `/settings#rss`，
  与顶栏「笔记 / 设置」不再是重复目的地，而是同页不同区块；点击后路由渲染完成再 `scrollIntoView`
  （`BentoCard` 新增 `id` 透传 + `scroll-mt-24` 避开吸顶头部）
- 导航目的地自查：`首页 / 笔记 / 设置 / 资源库(3 类) / Notes 链接库 / AI 对话 / 资讯订阅` 无同路径重复
- 实测：`/memos` 链接库卡片落点 146px、`/settings` 资讯订阅标题进入视口，均通过

## v0.6.2 · 2026-11-09 首页英雄带矮条化

- 英雄带由占满首屏改为**矮条**（`min-height:150px`，实测 150px）：图片只作氛围底纹，
  遮罩改横向左深右浅（`100deg`，文字侧 0.9 保证对比度），标题与三个 CTA 收进一行，删除长段介绍
- 首屏焦点让回内容：1366×860 下统计卡顶边 259px、最新动态 376px，均在折叠线以上
- 登录页保持全屏机房底图不变（登录场景适合沉浸感）

## v0.6.1 · 2026-11-09 导航可用性修复（用户反馈）

针对三条反馈：布局奇怪 / 回不去首页 / 下拉与页面风格割裂

- **回不去首页**：品牌 logo 从 `<div>` 改为链接（`href="/"`）；导航恢复显式「首页」项并带当前页高亮胶囊
- **风格割裂**：下拉面板不再恒定暗玻璃，改为一组 `--dd-*` 令牌**跟随明暗主题**
  （浅色=白玻璃 `rgba(255,255,255,.92)` + 深字；深色=原暗玻璃），图卡文字仍压暗底图保持白色
- **入口造假**：删掉「平台」面板里无处可去的条目（贡献者榜/通知中心并非独立页面），
  导航改为：首页 · 资源库▾ · AI 能力▾ · 笔记 · 设置；触发词样式与路由项统一（12px 圆角、hover 底色）
- **「我在哪」**：当前路由所属分组的触发词同步高亮（如 /resources → 「资源库」变品牌蓝）
- 实测（浏览器 DOM 断言）：浅色面板配色/尺寸 664×358、进入资源库后首页去高亮且触发词高亮、
  点品牌回首页且首页重新高亮，均通过

## v0.6 · 2026-11-09 视觉改版：Halden 风格适配

来源：用户提供的 "Halden" 变形下拉导航规格（已存档 `docs/design/halden-hero-morphing-nav-spec.txt`）。
策略：**只取其交互语言与暗玻璃质感，保留原信息架构与蓝紫品牌色**，不做整站照搬。

- **MegaMenu 变形下拉导航**（`src/components/MegaMenu.tsx`）：桌面顶栏「资源库 / AI 能力 / 平台 / 设置」，
  三段面板严格沿用规格尺寸（664×358 / 446×308 / 232×218）；首次打开瞬现就位（`is-instant`+reflow），
  切换时容器 x/宽/高 0.5s 形变、面板按行进方向 ±56px 滑入并 blur 8px 交叉淡入；
  140ms 关闭宽限、Esc 关闭并回焦、resize 重定位、外部点击关闭。
  - 资源库面板：Skills/小工具/插件/Notes 四行 + 右侧预览图交叉淡入（悬停/聚焦联动）
  - AI 能力面板：AI 对话 / 每日简报 双图卡
  - 面板内链接走 SPA 路由（拦截点击，无整页刷新）
- **首页英雄带**：Dashboard 欢迎卡改为机房实拍底图（`/hero/hero-server-room.jpg`）+ 双层渐变遮罩 +
  `heroIn` 缩放淡入，文案与三个 CTA 保留原功能；窄屏自动退化为原横向滚动导航
- **登录页**：全屏机房底图 + 暗玻璃卡片（22px 模糊 + 140% 饱和），SSO 提示/账号密码/按钮同步深色语义
- **令牌**：`--h-ink/--h-panel/--h-line/--h-hover/--h-soft/--h-muted/--h-ease/--h-morph`；
  `--nav-soft/--nav-strong` 随明暗主题切换，触发词在两种主题下对比度均达标
- **素材本地化**：7 张 Unsplash 图片下载至 `public/hero/`（共 688KB），内网可离线访问
- **无障碍**：`aria-expanded` 同步、键盘可达、`prefers-reduced-motion` 下关闭模糊与入场动画
- 实测：面板尺寸/切换/交叉淡入/Esc 回焦由浏览器 DOM 断言核验；pytest 50 用例；构建通过

## v0.5.1 · 2026-11-09 浏览器 E2E 回归

- **Bug 修复**：生产托管模式下访问根路径 `/` 返回 404（v0.3「SPA 兜底对 /api 前缀 404」误伤
  空路径）——现在 `/` 与 SPA 深链（如 `/resources/3`）正常返回 index.html，`/api/*` 仍 404
- **E2E 全绿**：SSO 自动登录 / 资源卡收藏 toggle / 首页「我的收藏」直达 / 通知面板空态 /
  ⌘K 中文全文搜索（FTS 二元组命中）/ 统计卡数字动画正常
- 回归测试：+1 SPA 托管用例（pytest 50）

## v0.5 · 2026-11-09 P2 AI 深化 + P3 工程化

- **资源问答 RAG**：对话未手动引用资源时，自动 FTS5 检索最相关的 3 个平台资源注入系统提示词
  （📎 显式引用优先；RAG 检索失败不影响正常对话）
- **定时自动简报**：调度器每天 `AI_BRIEFING_HOUR` 点（默认 8，-1 关闭）自动生成「今日 AI 简报」
  沉淀到首页；当天已生成则跳过；未配置 Key 时诚实跳过并记日志。简报逻辑抽为
  `services/briefing.py`，手动按钮与定时共用同一实现
- **搜索召回升级**：查询从整串短语改为 ASCII 词 + 中文相邻二元组 OR（解决长查询零命中，
  bm25 排名仍有效）；纯标点安全跳过不生成非法短语
- **Bug 修复**：启用 `PRAGMA foreign_keys=ON`——此前所有 `ondelete=CASCADE`（删 RSS 源清条目、
  删资源清评论等）实际都未生效；删除订阅源现同步清理全文索引
- **工程化**：GitHub Actions CI（pytest + npm build）；`docs/DEPLOY.md` 部署指南；
  `requirements-dev.txt` 分离测试依赖
- **测试**：43 → **49** 用例（查询表达式/RAG 注入/简报服务/定时闸门/RSS 抓取索引同步）

## v0.4 · 2026-11-09 P1 功能增强轮

- **FTS5 全文搜索**：SQLite FTS5 统一检索 资源/笔记/RSS 资讯（`GET /api/search`）
  - 索引/查询两侧 CJK 逐字切分 + 短语匹配，2 个字的中文查询也能命中；英文按词匹配
  - bm25 相关度排序 + snippet 摘要；启动时全量重建自愈遗漏同步；无 FTS5 环境自动回落 LIKE
  - 资源/笔记增删改、RSS 抓取入库均实时同步索引；⌘K 面板接入统一搜索（含资讯直达）
- **收藏夹**：用户级收藏 资源/笔记（`POST /api/bookmarks/toggle`、`GET /api/bookmarks`）
  - 资源卡片/详情页、笔记卡片均有 ☆ 星标按钮；列表与详情返回 `bookmarked_by_me`（批量查询防 N+1）
  - 首页新增「我的收藏」卡：资源+笔记合并时间序 Top 6 快速直达；目标删除后自动清理悬挂收藏
- **通知中心**：站内通知（`/api/notifications` 列表/未读数/已读）
  - 触发事件：他人评论你的资源、他人点赞你的资源（给自己不投递，取消点赞不投递）
  - 顶栏铃铛升级为通知面板：未读红点 + 每分钟轮询、点击直达资源、全部已读、空态友好
- **测试**：40 → **43** 用例（新增 全文搜索中英文/删除同步、收藏 toggle/非法参数、通知投递/已读/自评不通知）
- 真实服务器冒烟：中文 2 字/4 字检索、收藏 toggle、通知已读 全部验证通过

## v0.3.1 · 2026-11-09 稳定性加固轮

- **重启不掉线**：`JWT_SECRET` 未显式配置时首次生成后持久化到 `data/secret.key`（原先每次重启随机重生成，所有用户 token 失效）
- **Chat AI 预检**：未配置 API Key 时直接 400 拒绝，不再落库没有回复的孤儿用户消息
- **Chat 重新生成**：对上一条提问重新生成回答（`regenerate` 参数，旧的错误回答被替换而非叠加）；HTTP 错误时前端回滚乐观气泡
- **备份防损坏**：SQLite 备份改用 `sqlite3` backup API 在线备份（原先直接复制可能拿到写一半的文件）
- **RSS 启动即刷新**：后台线程启动立即抓取一次（原先要等 1 小时）；`ENABLE_SCHEDULER=0` 可关闭调度线程（测试用）
- **FastAPI lifespan**：迁移弃用的 `@app.on_event("startup")`
- **分页钳制**：`page<1` 负 OFFSET 导致 500 的 bug 修复（rss/notes/memos 三处）
- **测试**：27 → **40** 用例（新增 Chat SSE 流/重新生成/权限、RSS CRUD、Notes 链接库、JWT 持久化）

## v0.3 · 2026-11-09 深夜加餐轮

- **资源评论**：详情页讨论区，可删自己的评论（admin 可删任意）
- **资源编辑**：详情页直接修改类型/名称/简介/详情/标签/外链
- **资源分享**：一键复制内网链接
- **AI 能力三连**：
  - `POST /api/ai/briefing` 每日简报（RSS→AI→内容卡）
  - `POST /api/ai/rss-card` 单条资讯→中文知识卡
  - `POST /api/ai/describe` 表单内 AI 生成资源简介
  - `GET /api/ai/test` 连接测试（列出可用模型）
- **AI 对话引用资源**：📎 选择任一资源作为对话上下文
- **演示数据**：`SEED_DEMO=1` 启动播种示例 Skills/笔记/简报/RSS 源
- **通知铃铛**：顶栏显示今日新增动态数
- **导出**：笔记→.md（含 frontmatter）、AI 对话→.md
- **管理**：设置页成员管理（admin 创建用户）、SQLite 数据备份下载
- **RSS**：定时自动刷新（后台守护线程每小时）、源级错误状态显示、条目存为笔记
- **Feed**：分类筛选、加载更多、AI/公告卡点击弹窗看全文、相对时间、近 7 天活跃迷你柱状图
- **视觉**：资源卡类型渐变头图、Chat 建议提示词、资源详情骨架屏、回到顶部、PWA manifest
- **⌘K**：新增搜索 Notes 链接库
- **质量**：pytest 19 用例；真实浏览器 E2E 8 项全过

## v0.2 · 2026-11-09 夜间迭代

### P0 基础体验
- **Chat 升级**：AI 回复 Markdown 渲染（react-markdown + GFM）；新增「停止生成」（AbortController）与「复制回复」
- **深色模式**：顶栏太阳/月亮切换，localStorage 记忆，全站语义类统一覆盖（卡片/输入框/Toast/Markdown）
- **首页动态**：分类筛选（全部/AI 内容/资源/笔记/资讯）+「加载更多」分页
- **构建优化**：vite manualChunks 分包（react/motion/md 独立 chunk），主包 578kB → 137kB

### P1 资源库增强
- **SKILL.md 元数据自动提取**：上传 .md 或 zip（内含 SKILL.md/README.md）时自动解析 frontmatter 的 name/description/tags 填充表单（`services/skill_meta.py`）
- **资源点赞**：按用户去重的点赞 toggle（❤ 数量展示于卡片与详情页）
- **贡献者榜**：首页 Bento 卡片，按 资源×2 + 笔记/内容卡×1 聚合 Top 8，带渐变进度条

### P2 AI 能力
- **AI 每日简报**：`POST /api/ai/briefing` 抓取启用 RSS 源最新 15 条 → AI 生成中文简报 → 自动沉淀为首页内容卡
- **RSS 存为笔记**：设置页资讯条目一键收藏为 Markdown 笔记（含原文链接与来源标签）

### P3 质量与安全
- **pytest 测试套件**：17 个用例（Notes 解析 4 / frontmatter 2 / 认证 4 / 资源 CRUD+点赞+安全 5 / 笔记 1 / 设置打码 2）
- **上传安全**：20MB 大小限制 + 可执行文件扩展名黑名单（.exe/.msi/.scr/.com/.pif/.cpl/.js/.vbs）
- **稳定性**：TestClient startup 上下文修正；测试库与生产库隔离（环境变量注入）

## v0.1 · 2026-11-08

- 全栈骨架：React 18 + Vite + TS + Tailwind + framer-motion / FastAPI + SQLAlchemy + SQLite
- Windows 域 SSO 自动登录 + 手动账密兜底（JWT/PBKDF2，自 leanerone/web test1 移植）
- 资源库（skill/tool/plugin + 附件上传下载）、Markdown 笔记、Notes 链接解析与一键唤起
- AI 流式对话（SSE）+ 内容沉淀、RSS 订阅抓取、首页 Bento Dashboard、⌘K 命令面板
- 明亮 Bento 视觉体系
