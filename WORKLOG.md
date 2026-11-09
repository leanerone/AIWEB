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

### 2026-11-09 00:04-00:25 · 加餐轮 3~10（全部已推送）
- **重大修复**：axios 拦截器解包 bug（TS 泛型掩盖的运行时错位，全站数据流都受影响）
- 加餐3：数据备份下载(admin) · RSS 定时自动刷新线程 · 笔记/对话导出 md · PWA manifest · 详情骨架屏
- 加餐4：资源评论区 · AI 生成资源简介 · 评论测试
- 加餐5：SEED_DEMO 演示数据 · Feed 内容卡弹窗全文 · README 截图
- 加餐6：RSS 源错误状态 · AI 对话引用资源上下文(📎)
- 加餐7：资源编辑功能 · AI 连接测试按钮
- 加餐8：⌘K 搜 Notes 链接 · 资源分享复制 · 近 7 天活跃迷你柱状图
- 加餐9：AI 资讯知识卡 · 通知铃铛(今日新增) · CHANGELOG v0.3
- 加餐10：update_resource viewer bug 修复 · 笔记编辑器 Markdown 工具栏 · AI/admin 测试用例（pytest 23 用例）
- 加餐11：Notes 链接库搜索 · 资源标签点击筛选 · 窄屏导航滚动
- docs：USER_GUIDE.md 使用指南 · smoke.bat 冒烟脚本

### 2026-11-09 00:24 · E2E 回归 round 2 通过
资源详情：分享 ✓ / 评论添加 ✓ / 点赞 0→1 ✓ / 权限正确隐藏编辑删除 ✓ / 顶栏铃铛 ✓ / Chat 引用资源下拉 ✓

### 进行中
- [x] 页面过渡动画 + 登录页背景光斑动效（00:26 推送）
- [x] 前端 review round 3：Chat SSE/中止/错误路径 ✓
- [x] 工程加固：Query.get→db.get、FK 索引、limit 钳制（00:29）
- [x] SQLite 每日自动备份（保留 7 份）+ 测试（00:30，pytest 25 用例）
- [x] AI 人设/系统提示词可配置（00:31）+ 设置页 E2E 验证 ✓
- [x] E2E 回归 round 2.5：auth 自愈（token 失效→自动重登）✓、分享/评论/点赞/铃铛/Chat 引用资源 ✓
- [ ] 04:30 最终全量回归（pytest + build + E2E 走查）
- [ ] 收尾 + 晨间报告

### 夜间统计（截至 00:33）
- 提交数：20+（全部已推送 origin/main）
- pytest：25 用例全过
- E2E：三轮（核心 8 项 / 新功能回归 / 设置页+auth 自愈）
- 待办遗留：Query.get 弃用警告已清；无阻塞问题



### 2026-11-09 00:34-00:36 · 心跳轮（已推送）
- Dashboard 统计卡/Feed 首屏加载骨架（消除数字跳变与空态闪烁）
- **安全修复**：external_url 协议白名单（防 javascript: XSS）+ 测试用例
- pytest 26 用例全过

### 2026-11-09 00:37-00:38 · 心跳轮 2（已推送）
- 内容卡删除：DELETE /api/hub/cards/{id}，创建者或管理员；Feed 弹窗内删除按钮
- 权限测试：非创建者 403 / 管理员 200
- pytest 27 用例全过

### 2026-11-09 00:41-00:42 · 心跳轮 3（已推送）
- Chat 会话重命名：PUT /chat/sessions/{id} + 会话列表行内编辑（Enter 确认 / Esc 取消）
- pytest 27 用例全过

### 2026-11-09 08:30-08:40 · v0.3.1 稳定性加固轮（基于代码 review 的 P0 修复）
- JWT_SECRET 持久化到 data/secret.key（修「重启全员掉线」）
- Chat：AI 配置预检 400（修孤儿消息）+ regenerate 重新生成 + 前端错误回滚乐观气泡
- 备份改 sqlite3 backup API（修复制写一半文件的风险）
- RSS 启动即刷新 + ENABLE_SCHEDULER 开关 + lifespan 迁移（修 on_event 弃用）
- 分页 page<1 负 OFFSET 500 修复（rss/notes/memos）
- pytest 27 → 40 全过；npm run build 通过；已推送

### 2026-11-09 14:50-15:20 · v0.8 液态玻璃质感（B 高光边 + A 折射）
- 配方来自 zip：Max Reed `.liquid-glass`（mask-composite 边光）+ Coffee Rewards `feDisplacementMap`（折射）
- BentoCard 全站升 `.card-lg + .lg-edge`（浅/深两套 --lg-edge 渐变，浅底用暗描边才可见）
- 浮层折射 #liquid-glass 注入 index.html；CSS.supports 探测加 .has-refract，Firefox/Safari 回退普通磨砂
- 深色 input/ghost 按钮改半透玻璃 + inset 高光；Toast/ConfirmDialog 同语言；reduce-motion 关 backdrop-filter
- **自造回归并修掉**：新规则 `position: relative` 覆盖了 .mega-dd 的 absolute → 下拉被挤进文档流(664→306)；
  改为只设 overflow，⌘K 面板自己带 relative。教训：改公共样式要复查定位属性是否被后写规则顶掉
- 实测：dd 恢复 664×358、backdrop=url() 生效、边光不吃点击；5 页面零溢出
- 已推送

### 2026-11-09 14:10-14:40 · v0.7 简报归档页 + 字体自托管 + 浮层统一（"把剩下的做完"）
- 新增 /briefings 页面 + GET /api/hub/briefings（ref_type=briefing 倒序分页），导航三处一致入口；
  首页 AI 卡加归档链接；seed 简报卡补 ref_type 并回填演示库
- Geist 自托管：googleapis/gstatic 在本环境不可达 → 改 jsDelivr @fontsource 取 woff2（latin 400/500，
  latin-ext 该包无此子集 404 → 只用 latin，中文回退 YaHei/PingFang）
- .glass-pop 统一 ⌘K / 通知下拉 / 用户菜单，随明暗主题
- pytest 50 → 51；浏览器实测字体已加载、页面渲染高亮、浮层双色正确；重启后端 token 仍有效
- 已推送

### 2026-11-09 13:00-13:10 · v0.6.3 导航入口去重（用户："首页和每日简报不是一个东西吗"）
- 根因：AI 能力面板的「每日简报」链到 `/`，与「首页」同目的地——简报是功能不是页面
- 改：「资讯订阅」→ `/settings#rss`；`Notes 链接库` → `/memos#links`；BentoCard 增 id 透传 + scroll-mt-24；
  面板点击先 nav(path) 再延时 scrollIntoView(hash)
- 审计脚本确认无同路径重复入口；锚点落点实测 146px / 资讯订阅标题进视口
- 教训复盘：v0.6/v0.6.1 都在"入口造假"上犯错——导航项必须能回答"这是哪个页面"，
  功能型动作（生成简报）不该做成导航项
- 已推送

### 2026-11-09 12:45-12:55 · v0.6.2 首页英雄带矮条化
- 用户选「英雄带改矮条」：min-height 150px（实测 150px），遮罩改横向 100deg 左深右浅，
  标题+三个 CTA 收进一行，删掉长段介绍；统计卡顶边 259px、动态 376px，首屏可见
- 登录页保留全屏沉浸（场景不同，登录页没有信息密度需求）
- 已推送

### 2026-11-09 12:20-12:40 · v0.6.1 导航可用性修复（用户三条反馈）
- 「回不去首页」：logo 是 div 不是链接 + 导航里没有首页项 → logo 改 Link、恢复「首页」并高亮当前页
- 「下拉和页面割裂」：面板恒为暗玻璃 → 新增 --dd-* 令牌跟随明暗主题（浅色=白玻璃深字）
- 「页签内容奇怪」：平台面板放了贡献者榜/通知中心这类没有独立页面的入口 → 删除，导航收敛为
  首页 · 资源库▾ · AI 能力▾ · 笔记 · 设置；触发词与路由项样式统一；所属分组触发词高亮当前页
- E2E 复测：浅色 664×358 配色正确；进 /resources 首页去高亮、资源库触发词变品牌蓝；
  点 logo 回首页且首页高亮恢复。**教训**：v0.6 只顾复刻风格，漏了导航最基本的"我在哪/怎么回去"
- 已推送

### 2026-11-09 11:30-12:10 · v0.6 视觉改版（Halden 风格适配）
- 用户嫌原 Bento 风格不好看，给出 Halden 变形下拉导航规格 → 存档 docs/design/halden-hero-morphing-nav-spec.txt
- 探索期：先做 Talvex 仪表盘风、Reading Library 深暖风格两版独立预览（用户否掉 Talvex，喜欢 Halden 气质）
- 从 Unsplash 搜图并本地化 7 张到 public/hero（688KB，离线可用）；napi 被 CF 拦截 → 改 DOM 抓 ID + 逐个 HEAD 探活（5 个 ID 已撤图 404）
- MegaMenu.tsx：面板 664×358 / 446×308 / 232×218，首开瞬现、切换形变 ±56px + blur 交叉淡入、140ms 宽限、Esc 回焦、resize 重定位、面板内 SPA 导航
- Dashboard 英雄带 + Login 暗玻璃卡片；令牌 --h-*；--nav-soft/--nav-strong 随明暗切换
- **教训**：初版用 React state 驱动 class/CSS 变量做动画 → is-instant 永不解除、缩放卡 0.97；
  改为 useEffect 内 refs 命令式操作 DOM（与已验证的 vanilla 预览同一实现）后行为正确
- E2E 观测坑：后台标签页会冻结 CSS 过渡，getComputedStyle 读到中间值（10px 偏差恰为 w×(1−0.97)/2），非代码 bug
- 构建通过；pytest 50 用例；已推送

### 2026-11-09 10:00-10:10 · v0.5.1 浏览器 E2E 回归 + SPA 根路径修复
- 真实浏览器 E2E：SSO 直登 / 收藏 toggle / 收藏卡直达 / 通知面板 / ⌘K 中文检索（批量→excel-batch-merge 命中）✓ 全绿
- 统计卡显示 0 属 count-up 动画，等待后数值正确（Skills=1），非 bug
- **Bug 修复**：生产模式访问 `/` 返回 404——v0.3 修 API 前缀兜底时 `not full_path` 误伤根路径；现 `/` 与深链均回落 index.html
- CI 首跑即绿（42s，pytest+build 双 job）；pytest 49 → 50 用例；已推送

### 2026-11-09 09:10-09:40 · v0.5 P2 AI 深化 + P3 工程化
- 资源问答 RAG：对话未引用资源时自动 FTS 检索 Top3 资源注入系统提示词（📎 优先，检索失败不阻断）
- 定时自动简报：调度器每天 AI_BRIEFING_HOUR（默认 8）生成简报卡，当天去重；
  逻辑抽为 services/briefing.py 供路由/调度共用
- 搜索召回升级：查询改 ASCII 词 + 中文二元组 OR（长查询不再零命中）；纯标点安全跳过
- **Bug 修复**：`PRAGMA foreign_keys` 默认未开 → 所有 ondelete=CASCADE 实际无效（删源留孤儿条目）；
  现已启用，且删 RSS 源同步清理 FTS 索引
- P3：GitHub Actions CI（pytest+build）/ docs/DEPLOY.md / requirements-dev.txt
- pytest 43 → 49 全过；已推送

### 2026-11-09 08:45-09:05 · v0.4 P1 功能增强轮（FTS 搜索 / 收藏夹 / 通知中心）
- FTS5 全文搜索：/api/search 统一检索 资源/笔记/RSS；CJK 逐字切分+短语匹配支持 2 字中文；
  增删改与 RSS 抓取实时同步索引；启动全量重建；⌘K 接入
- 收藏夹：Bookmark 模型 + toggle/list；资源卡片/详情/笔记卡片 ☆ 星标；首页「我的收藏」卡；
  bookmarked_by_me 批量查询防 N+1；目标删除自动清理悬挂收藏
- 通知中心：Notification 模型 + 评论/点赞投递（自评不投、取消赞不投）；铃铛改通知面板
  （未读轮询、点击直达、全部已读）
- 坑：external-content FTS5 表按 rowid DELETE 会报 malformed database —— 改普通 FTS 表解决
- pytest 40 → 43 全过；build 通过；真实服务器冒烟（中文检索/收藏/通知）通过；已推送
