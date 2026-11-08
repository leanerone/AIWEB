# 更新日志

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
