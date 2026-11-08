# AIWEB 夜间迭代工作日志

> 任务：自主迭代开发至 2026-11-09 06:30，期间不向用户提问，完成后推送 git。
> 迭代路线图：P0 体验完善 → P1 资源库增强 → P2 AI 简报 → P3 质量收尾

## 迭代路线图

### P0 基础体验
- [ ] Chat 回复 Markdown 渲染（替代纯文本 pre-wrap）
- [ ] Chat 停止生成按钮（AbortController）+ 复制回复
- [ ] 首页 Feed 分类筛选（全部/AI/资源/笔记/RSS）+ 加载更多分页
- [ ] 深色模式（CSS 变量 + 顶栏切换 + localStorage 记忆）
- [ ] vite manualChunks 分包，消除 500kB chunk 警告

### P1 资源库增强
- [ ] SKILL.md frontmatter 解析：上传时自动提取 name/description 填充表单
- [ ] 资源点赞（后端 likes 字段 + API + 前端按钮）
- [ ] 贡献者榜（首页 Bento 小卡，按 created_by 聚合）

### P2 AI 简报
- [ ] POST /api/ai/briefing：抓取 RSS 最新条目 → AI 生成「今日 AI 简报」→ 沉淀为内容卡进 Feed
- [ ] Dashboard 一键生成简报按钮
- [ ] RSS 条目一键「保存为笔记」

### P3 质量收尾
- [ ] pytest 用例：notes parser / auth / resources API
- [ ] 上传安全：大小限制 + 扩展名黑名单
- [ ] CHANGELOG.md + README 更新
- [ ] 最终 npm run build + 后端冒烟自测 + git push

## 已完成记录

### 2026-11-08 23:41 · v0.1 已交付（上一阶段）
- 全栈骨架 + 认证（Windows SSO/手动）+ 资源库/笔记/Notes解析/AI对话/RSS/Feed/⌘K
- 前后端构建与 12 项接口自测通过，已推送 origin main（0cb379f）

### 2026-11-09 00:00 · P0~P3 + 加餐1/2 完成（已推送）
- P0：Chat Markdown/停止生成/复制 · 深色模式（CSS 语义覆盖）· Feed 筛选分页 · 分包优化（主包 578k→137k）
- P1：SKILL.md/zip frontmatter 自动提取 · 点赞 toggle · 贡献者榜
- P2：AI 每日简报（RSS→AI→内容卡）· RSS 存为笔记
- P3：pytest 17 用例全过 · 上传安全（20MB/黑名单）· CHANGELOG
- 加餐1：Feed 相对时间 · 资源卡类型渐变头图 · Chat 建议提示词 · 笔记内嵌 notes:// 自动识别 · 资源排序
- 加餐2：成员管理(admin) · 我的点赞筛选 · 回到顶部 · Notes 批量导入
- **重大修复**：axios 拦截器解包 bug（TS 泛型掩盖的运行时错位，全站数据流都受影响）

### 2026-11-09 00:03 · 真实浏览器 E2E 验证通过（8/8）
SSO 自动登录 ✓ / Dashboard 渲染 ✓ / 深色模式切换+持久化 ✓ / Notes 解析信息卡 ✓ / 链接库保存 ✓ / 笔记创建+Markdown+notes://行内识别 ✓ / 资源库筛选排序 ✓ / ⌘K 面板 ✓
（IAB 环境下 Playwright click 会挂起，改用页面 evaluate 派发点击完成验证）

### 进行中：加餐轮 3
- [ ] 笔记/对话导出 .md
- [ ] 管理员数据备份下载
- [ ] RSS 定时自动刷新（后台线程）
- [ ] PWA manifest
- [ ] 资源详情骨架屏

