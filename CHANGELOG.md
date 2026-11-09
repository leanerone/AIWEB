# 更新日志

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
