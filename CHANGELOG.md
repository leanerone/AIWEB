# 更新日志

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
