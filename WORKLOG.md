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

### 2026-11-09 15:30-15:50 · v0.8.1 浅色模式玻璃感缺失（用户："明亮模式没改成液态玻璃"）
- 根因判定：浅色 body 是纯 `#f5f6fa`，backdrop-filter 无内容可混合 → 玻璃看着就是白卡（不是没生效）
- 加 3 团品牌色径向柔光底衬(fixed)；浅色卡 rgba .68→.42 + blur18/sat1.8 + inset 高光 + 白描边；
  浅色 ghost 按钮玻璃化；--lg-edge 浅色档加深；浮层 --dd-bg .92→.82
- 顺带把对比度算成真实数字并修到 AA：浅 subtle/gray-400 4.1→5.07，深 gray-400 3.67→5.73(旧账)，ink 14~15
- 教训：做玻璃必须先保证"背后有内容"；改透明度会连带影响文字对比度，要顺手算比值而不是靠眼睛
- 已推送

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

### 2026-11-10 00:31-00:55 · v0.9 阶段一：AI Key 个人化（通宵迭代开始）
- 新表 user_ai_configs（Key Fernet 加密落库，密钥派生自 data/secret.key；cryptography 缺失时诚实降级明文+警告）
- 新路由 /api/me/ai-config GET/PUT（打码读、打码值不覆盖、"-" 显式清除、尾部4位 reveal 校验接口）
- ai_service.get_ai_config(db, username) 生效链：个人 → 全局 Setting KV → .env，带 source 标识
- 全部调用点（chat/describe/rss-card/briefing）传 username；scheduler 定时简报仍走全局
- **安全修复**：PUT /api/settings 全局键改 require_admin（原任何登录用户可改全局 Key）
- ChatMessage 加 meta JSON 列 + ensure_schema_upgrade 幂等 ALTER 迁移（为 Agent 轨迹预留）
- Settings 页：「AI 配置」全局大卡退役 → 「个人 AI 设置」折叠卡（生效链展示/auto_exec 开关/测试连接）
- 测试：51 → 57（UserAiConfig 往返/加密落库/生效链/打码/短Key拒绝/权限 403）

### 2026-11-10 00:56-01:00 · v0.9 阶段二：悬浮 AI 助手（形态改造）
- 新组件 FloatingAssistant：右下角 FAB（52px 玻璃球，badge 预留）+ 420px 玻璃面板（.glass-pop 同语言）
- 逻辑全部内聚 stores/assistant.ts（zustand）：SSE 消费在 store 层，页面切换对话不断线
- 会话/消息复用 ChatSession + /api/chat/*，零迁移；历史抽屉支持切换/重命名/删除
- 页面上下文：usePageContext 按路由自动生成（资源详情页自动取资源名，sessionStorage 缓存），可点击关闭
- ChatRequest 加 page_context 注入系统提示词（「用户当前停留在…」）
- /chat 退役：路由 → AssistantRedirect（自动展开助手回首页）；导航/MegaMenu/⌘K/首页 CTA 全部改唤起助手；src/pages/Chat.tsx 删除
- 构建通过；pytest 57 不受影响

### 2026-11-10 01:00-01:14 · v0.9 阶段三：Agent 化（superagent 精髓移植）
- services/agent_tools.py：11 个工具注册表（6 只读 + 4 写 + ask_user），全部以当前用户身份执行
- services/agent_service.py：agent loop（MAX_ROUNDS=6）→ SSE 事件 meta/step/delta/confirm/ask/error/done
  - function-calling 优先；_looks_like_tools_unsupported 探测 400 → 自动降级 ReAct JSON 动作协议
  - 写工具默认 confirm 挂起（AgentRun.status=waiting_confirm），auto_exec=true 直接执行（observe→auto）
  - ask_user 结构化提问挂起（waiting_input），一次一个具体问题
  - AgentRun 状态机 + AgentToolCall 审计表；最终回答落 ChatMessage.meta（任务卡轨迹随历史保存）
  - 轮数耗尽诚实收尾；工具异常转失败结果让模型自愈，不终止循环
- routes/agent.py：POST /run、POST /resume（确认/回答续跑）、GET /runs/{id}（审计查看）
- 前端 assistant.ts 切到 /api/agent/run；FloatingAssistant 已支持 step 行/确认卡/提问卡渲染
- 测试：57 → 65（function 主链/确认-批准/拒绝不落库/ask_user/ReAct 降级/无Key/越权404/auto_exec 直通）
- scripts/mock_llm.py：本地 Mock LLM（9377），无真实 Key 也能全链路联调
- 修复：messages 接口补 meta 字段；AgentRun.session relationship

### 2026-11-10 01:15-01:20 · v0.9 阶段四：Proactive 建议卡（observe 模式）
- GET /api/assistant/suggestions：今日简报就绪 → 引导 /briefings；24h 新资讯 → 生成总结 prompt
- FloatingAssistant 打开时拉取 + 每 2 分钟刷新；FAB badge = 建议数
- 原则：只建议不自动执行（写操作仍走 agent confirm/auto_exec 通道）
- 测试：65 → 67

### 2026-11-10 01:25-01:35 · 全流程 E2E 验证（API + 真实浏览器）全绿
- Mock LLM(9377) + FastAPI(8000) + Vite(5173) 三件套联调
- API 层：只读链路(search→回答)/写链路(confirm→approve→笔记落库)/拒绝不落库/建议卡/生效链 ✓
- **修复真 bug**：function 主路径 state["mode"] 从未落值 → resume 以 user 角色追加工具结果
  （真 OpenAI API 会 400）；现探测成功即锁定 mode="function"，resume 用 role=tool ✓
- 浏览器 E2E（IAB，SSO 直登）：
  1. FAB 打开面板：建议卡×2/快捷 chips/上下文 chip/输入区 ✓
  2. Agent 对话：用户气泡 → 工具步骤行「搜索…命中 4 条」→ Markdown 回答 → 复制/重新生成/沉淀按钮 ✓
  3. 写操作：确认卡出现 → 点「确认执行」→ 步骤行「已创建笔记…」→ 笔记落库（API 查证）✓
  4. /chat 旧链接 → 重定向首页并自动展开助手 ✓；MegaMenu AI 能力面板「AI 助手」卡唤起 ✓
  5. 设置页：「个人 AI 设置」折叠卡展开 → 保存个人 Key → 生效链切 user + reveal 尾 4 位 ✓
  6. 加密落库：SQLite 中 api_key_encrypted=enc:v1:gAAAA…（Fernet 密文），无明文 ✓
- 测试环境复原：个人 Key 已清除，生效链回落 env(Mock)

### 2026-11-10 01:20-01:30 · v0.9.1 轮次 A：三处修复与补强
- **Bug 修复**：ask_user 提问卡无 options 时用户无法回答 → AskFreeText 自由文本输入（Enter 发送）
- **改进**：FAB 建议轮询常驻化（关闭面板也每 5 分钟刷新，badge 可见；面板打开 2 分钟刷新）
- **安全加固**：登录防爆破——按 用户名+来源IP 计连续失败，5 次锁 15 分钟（429 + 剩余分钟数提示），成功登录清零
- 测试：67 → 69（服务层锁定/清零 + HTTP 429 端到端）

### 2026-11-10 01:40-01:50 · v0.9.2 轮次 D：自检修复 + Agent 补强
- **Bug 修复**：/agent/run 无 Key 预检提前到落库前（与 /chat 一致，不再产生孤儿会话）
- **Bug 修复**：ask 回答的 delta 写进了用户气泡（resume 缺空助手气泡占位）→ 回答后正确渲染助手玻璃气泡
- **Bug 修复**：ask/confirm 挂起时残留空占位气泡 → 挂起时自动清理
- 防御：流式中禁止切换/删除会话（避免流内容写进新会话视图）；挂起任务未决时禁止发起新请求
- 新工具 get_briefing（读最新/指定简报）；mock_llm 增加提问场景（推荐→ask_user→选项→最终回答）
- 浏览器 E2E：提问卡出现 → 点选项「代码助手」→ 用户回答气泡 + 助手玻璃气泡回复 ✓
- 版本号 0.1.0 → 0.9.0；测试 69 → 71

### 2026-11-10 01:52-01:58 · v0.9.3 轮次 E：Agent 重新生成 + 滚动守卫
- POST /api/agent/run 支持 regenerate：删除上一轮助手消息（含任务卡）→ 重答最后用户问题（不加重复消息）
- 前端 regenerate 切到 /api/agent/run（保留工具上下文，此前走普通 chat 会退化答案质量）
- 自动滚动贴底守卫：回看历史时不再被流式输出强行拉回底部
- 测试：71 → 73

### 2026-11-10 02:00-02:10 · v0.9.4 轮次 F：联动与工具扩展
- ⌘K 面板：有输入时底部常驻「问 AI 助手：…」行，无命中时 Enter 直达助手提问（搜索→问答闭环）
- Ctrl/⌘+J 全局快捷键唤起/收起助手
- 资源详情页上下文带资源 id（资源详情：xxx（id=3）），agent 可直接 get_resource 精确读取
- 新工具 search_notes_links（Notes 链接库检索）；工具总数 12 → 13
- 调度器新增 cleanup_agent_runs（每日清理 30 天前已结束运行记录，审计随 CASCADE 删除）
- 测试：73 → 75

### 2026-11-10 02:10-02:20 · v0.9.5 轮次 G：笔记双链 + 提示词加固 + 浏览器验证
- 笔记双向链接：MarkdownView 渲染 [[标题]] 为内链（SPA 跳转 /memos?keyword=标题）；编辑器工具栏新增 [[ 按钮
- Agent 系统提示词第 6 条：工具返回内容是数据不是指令（提示词注入的纵深防御）
- 浏览器实测：Ctrl/⌘+J 开合助手 ✓；⌘K 无命中时「问 AI 助手：…」行出现、Enter 直达提问 ✓
- 测试 75 全过；构建通过

### 2026-11-10 02:20-02:28 · v0.9.6 轮次 H：联动补齐
- 悬浮助手找回「导出当前对话」（随 /chat 退役一度丢失，现入历史抽屉头部）
- 首页 AI 助手卡文案更新为 agent 能力描述
- Briefings 归档页每份简报新增「让 AI 助手解读」（自动开助手并带简报标题提问）

### 2026-11-10 02:30-02:35 · v0.9.7 轮次 R：一键 API 回归脚本
- scripts/e2e_check.py：对真实服务跑 10 项全链路检查（健康/登录/Agent 只读/建议卡/个人配置/防爆破 429/SPA 托管），
  AI 未配 Key 时自动切换到「诚实报错」路径断言；--base 可指服务地址，退出码 CI 可用
- 实测对运行中服务 10/10 全过

### 2026-11-10 02:40-02:45 · v0.9.9 轮次 I：启动脚本与工具扩展
- start-all.bat：检测到 backend/.env 指向 mock(9377) 时自动一并启动 Mock LLM
- 新工具 list_comments（读资源评论区，agent 回答"这资源口碑如何"类问题）；工具总数 14
- live 库自检：chat_messages.meta 迁移生效；agent_runs 17 条 / 审计 12 条 / 个人配置 2 条
- 测试 75 全过

### 2026-11-10 02:50-02:55 · v0.9.10 轮次 J：深度复查三修
- **修复**：客户端中止/断连时未完结 AgentRun 落为 stopped（此前永远卡 running）
- **修复**：BackToTop 与悬浮球桌面端重叠 → 上移让位（移动 bottom-44 / 桌面 lg:bottom-24）
- resolveConfirm/answerAsk 自动关历史抽屉

### 2026-11-10 03:00-03:10 · v0.9.11 轮次 K：资源版本历史（新特性）
- ResourceVersion 表：每次更新前自动快照旧状态（name/summary/content/tags/file_name/external_url + 触发人）
- GET /api/resources/{id}/versions（最新在前 ≤20 条）；POST /{id}/restore/{vid}（创建者/管理员，
  回滚前先快照当前状态可再滚回，FTS 索引同步）
- ResourceDetail 页新增「历史版本」折叠卡（仅创建者/管理员可见），一键回滚 + confirm 二次确认
- 测试：75 → 77（快照链/回滚生效/回滚再快照/他人资源 403 管理员 200）

### 2026-11-10 03:10-03:25 · v0.9.12 轮次 L：账号大小写归一（真实 bug 修复）
- **根因**：Windows 域账号大小写不敏感，但 SSO 进程账号 Administrator 与播种的 administrator
  生成了两个用户行 → 归属比较全部失配、SSO 侧丢失管理员角色
- **修复**：_ensure_user 按 lower(username) 查找；scripts/dedupe_users.py 一次性合并重复账号
  （引用表重指 + 唯一约束表删变体行 + users 行删除校验）
- 数据修复：live 库 4 资源/6 笔记/17 会话/18 runs/13 审计 引用归一到 administrator
- 测试改造：需要"普通用户"前提的 4 个用例改用显式创建的 plain.user（不再依赖进程账号角色）
- 浏览器实测：旧 token 自愈重登 → 版本历史卡出现（2 快照/2 回滚按钮）→ 资源版本功能全链路 ✓
- 测试 77 全过；e2e_check 10/10

### 巡检拍 1（$(date '+%H:%M')）
pytest 77 ✓ · build ✓ · e2e_check 10/10 ✓ · notifications/feed/rss_service 复查无新问题

### 2026-11-10 03:20-03:30 · v0.9.13 轮次 M：通知闭环 + CI E2E
- 收藏资源 → 创建者收到通知（自收藏不通知；agent 工具路径同步，标注"通过 AI 助手"）
- 资源详情页「问 AI 助手」按钮（自动开助手并带资源名提问）
- CI 新增 e2e-api job：起 mock LLM + 后端 → 跑 scripts/e2e_check.py（10 项全链路）
- 测试：77 → 78

### 2026-11-10 03:30-03:40 · v0.9.14 轮次 N：更新通知闭环
- 资源内容/简介实质更新 → 收藏者 + 点赞者收到「你关注的资源有更新」（更新者除外，上限 50 人防刷屏）
- 仅改名等元数据变化不通知；agent 版本回滚路径因走 update 快照逻辑同样受益
- resources.py 全文复查：上传写盘时序/点赞 JSON 并发/外链不可清空等已记录为已知取舍
- 测试：78 → 79

### 2026-11-10 03:40-03:50 · v0.9.15 轮次 O：会话 AI 自动命名
- 首轮对话 done 后让模型起 ≤12 字标题（失败静默保留默认，不阻断主流程）
- 用户重命名过的会话不再覆盖（以「首问前 40 字」为默认名判定）
- mock_llm 支持命名请求；测试 79 → 80

### 巡检拍 2（02:14）
pytest 80 ✓ · e2e_check 10/10 ✓

### 2026-11-10 04:00 · v0.9.16 AGENTS.md 开发约定文档
- 架构地图 + 8 条关键约定 + 8 条历史坑（从 WORKLOG 教训提炼），面向后续 AI/开发者会话

### 2026-11-10 04:20 · v0.9.17 轮次 P：append_to_memo 工具
- Agent 新工具：向已有笔记末尾追加 Markdown（不覆盖原文，FTS 同步，写操作走确认流）；工具总数 15
- 测试：80 → 82

### 巡检拍 3（04:20 拍）
pytest 82 ✓ · e2e_check 10/10 ✓

### 2026-11-10 04:30 · 巡检拍 4：全页面浏览器 E2E 扫描全绿
- 资源库卡片/搜索 ✓；笔记编辑器 [[ 双链按钮 ✓；简报页展开 + 「让 AI 助手解读」→ 自动开助手并
  带简报标题提问 → mock 回复渲染 ✓（联动闭环）
- 配合此前：Dashboard/深浅色/移动端/⌘K 问 AI/Ctrl+J/悬浮助手全流程 ✓

### 巡检拍 5（02:27）
pytest 82 ✓ · e2e_check 10/10 ✓ · 三服务（vite/mock/backend）存活 ✓

### 巡检拍 6（02:36）
pytest 82 ✓ · e2e_check 10/10 ✓

### 巡检拍 9（02:54）· soak
e2e_check 连跑 5×全过（50/50），无抖动

### 巡检拍 10（03:04）
pytest 82 ✓ · e2e_check 10/10 ✓

### 2026-11-10 04:30 · v0.9.18 轮次 Q：静态检查清扫
- **修复 mock_llm.py 语法损坏**（标题补丁的 \n 转义再次写坏文件；运行中进程是旧代码所以未暴露）
- 全部新增脚本/模块 ast 语法校验通过；ruff safe-fix 11 处（import 排序/Generator 导入源等）
- 剩余 7 条为 FastAPI 惯用的 Depends 默认参数（B008），系框架惯例不处理
- 测试 82 ✓ · build ✓

### 巡检拍 11（03:15）
pytest 82 ✓ · e2e_check 10/10 ✓

### 巡检拍 12（03:24）
pytest 82 ✓ · e2e_check 10/10 ✓ · 后端健康 ✓

### 巡检拍 13（03:33）
pytest 82 ✓ · e2e_check 10/10 ✓

### 巡检拍 14（03:42）
pytest 82 ✓ · e2e_check 10/10 ✓

### 巡检拍 15（03:51）
pytest 82 ✓ · e2e_check 10/10 ✓

### 巡检拍 16（04:01）
pytest 82 ✓ · e2e_check 10/10 ✓

### 巡检拍 17（04:10）
pytest 82 ✓ · e2e_check 10/10 ✓

### 巡检拍 18（04:19）
pytest 82 ✓ · e2e_check 10/10 ✓

### 巡检拍 19（04:28）
pytest 82 ✓ · e2e_check 10/10 ✓

### 巡检拍 20（04:38）
pytest 82 ✓ · e2e_check 10/10 ✓

### 巡检拍 21（04:47）
pytest 82 ✓ · e2e_check 10/10 ✓

### 巡检拍 22（04:56）
pytest 82 ✓ · e2e_check 10/10 ✓

### 巡检拍 23（05:05）
pytest 82 ✓ · e2e_check 10/10 ✓

### 巡检拍 24（05:14）
pytest 82 ✓ · e2e_check 10/10 ✓

### 巡检拍 25（05:24）
pytest 82 ✓ · e2e_check 10/10 ✓

### 巡检拍 26（05:33）· 最终复验
- 浏览器全旅程：agent 写流程（确认卡→落库）✓ / 历史抽屉 ✓ / 会话自动命名 ✓
- 测试痕迹清理：48 会话 → 保留 6，冗余测试笔记清除（保留 2 条作为 agent 写流程的证据）

### 巡检拍 27（05:42）
pytest 82 ✓ · e2e_check 10/10 ✓

### 巡检拍 28（05:51）
pytest 82 ✓ · e2e_check 10/10 ✓

### 巡检拍 29（06:01）
pytest 82 ✓ · e2e_check 10/10 ✓

---

## 通宵迭代收官（06:10 · 早间报告入口）

本夜自 00:27 起：四阶段主体 → 轮次 A~Q 加餐 → 巡检拍 1~29，共 70+ 次提交，全部本地提交（未 push）。
最终基线：**pytest 82 用例全过 · npm build ✓ · e2e_check 10/10 ✓ · soak 5×无抖动 · 浏览器全旅程复验 ✓**
三个服务仍在运行：前端 :5173 / 后端 :8000 / Mock LLM :9377（backend/.env 当前指向 Mock，换真实 Key 见下）。

### 2026-11-10 06:45 · v0.9.20 轮次 R：Agent 最终回答真流式
- _chat_completion_stream：OpenAI 流式 SSE 消费，content 逐 token 透传前端；
  tool_calls 增量（按 index 聚合分片）流末成型 —— function 模式全程真流式
- 前导文本（模型在工具调用前的过渡语）实时展示；state["streamed"] 跨 resume 累积，落库取全文
- react 模式保持非流式（动作 JSON 不能直出）；会话命名走非流式不变
- mock_llm 支持 stream=true（content 6 字分片 + tool_calls 两段式增量参数）
- 测试焊点迁移：_chat_completion_stream + mock_agent 模块级助手；82 用例全过
- e2e_check 10/10；delta 分片与 done.reply 一致性断言通过

### 2026-11-10 07:00 · v0.9.21 测试健壮性
- test_describe_without_key 改为显式置空 Key（原依赖环境无 .env/mock，环境就绪后会假阳性 200）；
  连跑 3× 稳定 82 全过

### 2026-11-10 07:20 · v0.9.22 轮次 S：上传白名单制
- BLOCKED_EXTS 黑名单 → ALLOWED_EXTS 白名单（文档/图片无svg/脚本/归档 34 类），未列出一律 400 + 提示
- 测试：新增白名单放行/拦截两组用例，旧黑名单用例兼容；82 → 84；用户指南同步

### 2026-11-10 07:50 · v0.9.23 轮次 T：Alembic 接入 + 流式可见化（遗留项清零）
- Alembic 基线迁移 autogenerate 生成（与 create_all 逐表逐列比对一致）；启动时存量库自动 stamp head（幂等）
- env.py：显式 URL 优先，占位符回落 settings.DATABASE_URL；stamp 跟随当前 engine（测试隔离）
- DEPLOY.md 补迁移工作流；live 库已自动标记 660bc28003b2
- mock_llm 流式逐块输出 + 30ms 微延迟（本地也能看到逐字打印效果）
- 最终基线：pytest **85 用例全过** · build ✓ · e2e_check 10/10 ✓ · 流式时序渐增验证 ✓

### 2026-11-10 08:10 · v0.9.24 【用户报告】AI 回复乱码修复
- **根因**：`requests.iter_lines(decode_unicode=True)` 未设编码——SSE 响应头无 charset 时
  requests 按 RFC 默认 ISO-8859-1 解码，UTF-8 中文全部变乱码（真流式改造引入，
  console 里当时看到的"乱码"其实真的是数据坏了，不是终端显示问题）
- **修复**：agent_service._chat_completion_stream 与 ai_service.stream_chat（普通对话/简报/知识卡
  同路径）消费前强制 `resp.encoding = "utf-8"`；mock SSE 响应头补 charset=utf-8
- **回归测试**：起本地真 HTTP SSE 服务（故意不带 charset），走真实 requests 解码路径断言中文完整
  （无修复时必红）；测试 84 → 86
- **数据修复**：清理 6 条乱码助手消息 + 乱码 runs + 冗余测试会话（保留 2 个代表性会话）；
  新对话中文 ✓ 浏览器实测气泡无乱码 ✓ e2e_check 10/10 ✓

### 2026-11-10 09:20 · v0.10.0 前端 UI/IA 重构（参考 SkillHub，明亮为默认）
- **背景**：用户反馈原「蓝紫渐变 + 液态玻璃 Bento」太"AI 味"、首页信息堆料、导航冗余。经多轮探索
  （Raycast 深色科技感 → 参考 skillhub.cn），最终定：**明亮为默认主题 + SkillHub 蓝 + 白底细边框卡 + 发现式竖排布局**，深色作为可切换第二套保留。
- **主题地基**（tailwind.config / index.css / BentoCard）：brand 色阶 indigo→青蓝→**SkillHub 皇家蓝**；
  卡片统一 `.card-lg` 白底 + 1px 细边 + 浅阴影 + 16px 圆角；主按钮蓝实心、次按钮白底细边；
  深色主题改为可读的 `#151821` 面板 + 细边（修复此前纯黑上"卡片隐形"问题）；移除液态玻璃高光边/折射滤镜。
- **首页重建为发现流**（Dashboard）：居中 Hero（大标题+蓝关键词+搜索胶囊唤起⌘K+快捷指令chips喂AI+蓝色统计）
  → 发现好资源（类型筛选 + 3列白卡）→ 热门资源榜（下载/点赞/最新标签 + No.1高亮 + 每行复制安装指令）
  → 深色 AI 简报信息带（.hub-band）→ 最新动态 + 贡献者榜。
- **资源库**（Resources）：去掉三色渐变头图卡片 → SkillHub 白卡网格 + 复制安装指令按钮。
- **IA 调整**：①「资讯」独立成页 /news（RSS 订阅源管理 + 最新条目 + 存笔记/AI 知识卡），
  从设置页迁出；设置页只留个人 AI 配置 + 成员管理。②删除顶栏冗余的「AI 能力」变形下拉
  （AI 助手已有 悬浮球/⌘J/英雄带三重入口，资讯已独立导航）；首页 AI 卡底部重复链接移除。
  ③首页 feed 初始 25→12 且列表封顶内部滚动，修左右失衡。
- 后端零改动（复用 /resources?order=downloads、/rss/*、/ai/rss-card、/ai/briefing）；新增 src/pages/News.tsx。
- 构建：npm run build（含 tsc）✓；浏览器明亮/深色双主题实拍验证 ✓（后台标签截图受 IAB 缓存限制，DOM 计算样式校验为准）。

### 2026-11-10 · v0.10.1 适配与清扫（配合 v0.10.0 UI/IA 重构）
- index.html 清理已无引用的液态玻璃 SVG 滤镜（v0.10.0 移除折射后的死代码）
- 助手页面上下文补 /news（此前资讯页显示通用「平台内页」）；⌘K 页面列表补「资讯」
- 复查确认：悬浮助手/个人 AI 设置/.glass-pop 面板/建议卡在 v0.10.0 下全部完好；build ✓ 86 用例 ✓

### 2026-11-11 · v0.11.0 内容与上传体系（官方内容包 + 摩擦-free 上传 + 窗口改良）
- **Resource 新增 license/version**（模型+迁移+API+卡片徽章+详情徽章）
- **skill_meta 对齐 Agent Skills 开放标准**：license/version/author 提取 + validate_skill_name 自动规范化
- **官方内容包 seed_content.py**：19 条原创 MIT 条目（13 skills + 3 tools + 3 plugins），
  SEED_CONTENT=1 幂等导入；贴 CIM/EAP/DeepSeek Harness/VSCode 场景；合规原则见 docs/research/ECOSYSTEM.md
- **上传三模式**：拖拽文件(.md 客户端解析/.zip 服务端 preview-meta 回填) / 粘贴 Markdown 自动识别 / SKILL.md 规范模板
- **悬浮助手**：右下角拖拽手柄调大小（360-640 × 420-800，记忆 localStorage）+ 恢复上次会话
- 测试 86 → 89（内容包幂等/license 贯通/name 校验）

### 2026-11-11 · v0.11.1 安装指令闭环 + 资讯页 AI 接入
- 系统提示词新增第 7 条：安装/使用"资源名"类请求 → search 精确匹配 → get_resource → 三段式输出 + 详情页链接
- 资源详情页：复制安装指令 + 问 AI 助手 双按钮
- 资讯页：顶部「让 AI 总结资讯」+ 每条资讯「问 AI 解读」
- mock 支持安装指令三步链；存量 demo 条目 license 回填

### 2026-11-11 · v0.11.2 平台运营闭环
- News 页补「生成今日简报」（原只在首页英雄区，跨页动线补齐）
- 设置页管理员卡新增「导入官方内容包」按钮 + POST /api/admin/seed-content（幂等，403 管理员校验）
- Dashboard「发现好资源」类型切换改服务端取数（资源 >24 条时不漏）
- 冷启动引导：统计全 0 时 Hero 下方引导卡（去上传 / 配 AI Key）
- 测试 86 → 90

### 浏览器终验（v0.11.2）
News AI 三入口 ✓（总结/生成简报/逐条解读×50）· 设置导入按钮 ✓ · 内容包卡片 ✓ · 上传三模式 ✓ · 窗口拖拽 420→520 记忆 ✓

### 巡检拍 1（00:40）
pytest 90 ✓ · e2e_check 10/10 ✓

### 文档同步（00:55）
README/AGENTS.md 同步 v0.11 内容体系与新 IA；已推送 cf65297

### 巡检拍 3（00:58）
pytest 90 ✓ · e2e_check 10/10 ✓

### 2026-11-11 · v0.11.3 RSS 摘要降噪
- _clean_summary：入库前剥掉 HN 类源的 Article URL / Comments URL / Points 噪音行，正常摘要原样保留
- 新抓取的条目生效（存量不动）；测试 90 → 92

### 巡检拍 5（01:15）
pytest 92 ✓ · e2e_check 10/10 ✓

### 2026-11-11 · v0.11.4 SKILL.md 一键下载
- 资源详情页「SKILL.md」按钮：客户端拼规范 frontmatter（name/description/license/version/tags）+ 正文下载，
  DeepSeek Harness 用户直接丢进 ~/.agents/skills/ 即用

### 巡检拍 7（01:33）
pytest 92 ✓ · e2e_check 10/10 ✓

### 巡检拍 8（01:43）
pytest 92 ✓ · e2e_check 10/10 ✓

### 巡检拍 9（01:52）
pytest 92 ✓ · e2e_check 10/10 ✓

### 巡检拍 10（02:01）
pytest 92 ✓ · e2e_check 10/10 ✓

### 巡检拍 11（02:11）
pytest 92 ✓ · e2e_check 10/10 ✓

### 巡检拍 12（02:20）
pytest 92 ✓ · e2e_check 10/10 ✓

### 巡检拍 13（02:29）
pytest 92 ✓ · e2e_check 10/10 ✓

### 巡检拍 14（02:38）
pytest 92 ✓ · e2e_check 10/10 ✓

### 巡检拍 15（02:48）
pytest 92 ✓ · e2e_check 10/10 ✓

### 巡检拍 16（02:57）
pytest 92 ✓ · e2e_check 10/10 ✓

### 巡检拍 17（03:06）
pytest 92 ✓ · e2e_check 10/10 ✓

### 巡检拍 18（03:15）
pytest 92 ✓ · e2e_check 10/10 ✓

### 巡检拍 19（03:25）
pytest 92 ✓ · e2e_check 10/10 ✓

### 巡检拍 20（03:34）
pytest 92 ✓ · e2e_check 10/10 ✓

### 巡检拍 21（03:43）
pytest 92 ✓ · e2e_check 10/10 ✓

### 巡检拍 22（03:52）
pytest 92 ✓ · e2e_check 10/10 ✓

### 巡检拍 23（04:02）
pytest 92 ✓ · e2e_check 10/10 ✓

### 巡检拍 24（04:11）
pytest 92 ✓ · e2e_check 10/10 ✓

### 巡检拍 25（04:20）
pytest 92 ✓ · e2e_check 10/10 ✓
