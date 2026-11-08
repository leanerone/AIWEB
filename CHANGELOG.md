# 更新日志

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
