# AIWEB · AI Hub

公司内网 AI 分享平台：聚合 **Skills（SKILL.md 技能包）/ 小工具 / 插件**，内置 **悬浮 AI 助手**（Agent 工具循环：查资源 / 写笔记 / 生成简报，写操作先确认）、**RSS 资讯订阅 + AI 每日简报**、**Markdown 笔记**，兼容 **HCL Notes 链接**（解析 + 一键唤起本机 Notes 客户端），支持 **Windows 域自动登录**。

视觉风格：明亮 Bento 网格（大圆角 / 柔和阴影 / 蓝紫渐变 / framer-motion 微动效），支持深色模式。
卡片为**液态玻璃**质感（`mask-composite` 高光边 + 半透磨砂底），浮层（⌘K / 通知 / 下拉菜单）额外使用
`feDisplacementMap` SVG 折射滤镜——仅 Chromium 生效，其余浏览器自动回退普通磨砂（`has-refract` 能力探测）。
首页与登录页采用「机房实拍底图 + 暗玻璃面板」的英雄带，顶栏为**变形下拉导航**（规格存档于
`docs/design/halden-hero-morphing-nav-spec.txt`，实现见 `src/components/MegaMenu.tsx`）。

## 界面预览

| 明亮 | 深色 |
|---|---|
| ![明亮](docs/screenshots/dashboard-light.png) | ![深色](docs/screenshots/dashboard-dark.png) |

| 悬浮 AI 助手（Agent 对话 + 任务卡） |
|---|
| ![AI 助手](docs/screenshots/assistant-dark.png) |


## 功能总览

| 模块 | 说明 |
|---|---|
| 首页 Bento | 欢迎卡 + 统计数字滚动（Skills/工具/插件/笔记）+ 聚合动态 Feed（筛选 + 分页）+ 贡献者榜 + **我的收藏** |
| 资源库 | skill / tool / plugin 统一管理：Markdown 详情、标签、搜索、zip/脚本附件上传下载、下载计数、**点赞**、**SKILL.md 元数据自动提取** |
| 笔记 | Markdown 编辑、置顶、标签、搜索 |
| Notes 链接库 | 粘贴 notes:// 链接 / NDL / 富文本 → 解析服务器/数据库/文档 → 点「打开」唤起 Notes 客户端 |
| AI 助手 | 右下角悬浮窗随时唤起（无独立页面）：**Agent 工具循环**（search/list/get 读工具直通；create_memo/bookmark/briefing/save_card 写工具默认**确认卡**，个人设置可开自动执行）、**ask_user 结构化提问**、任务卡轨迹、工具审计；SSE 流式、停止/重新生成、Markdown、多会话、页面上下文自动注入 |
| AI 每日简报 | 一键抓取 RSS 最新资讯 → AI 生成中文简报 → 沉淀到首页动态；**每天 8 点自动生成**；**`/briefings` 归档页**可回看历史简报 |
| RSS 资讯 | 设置页管理订阅源，手动刷新抓取（feedparser），条目可**一键存为笔记** |
| 认证 | Windows 域 SSO（后端进程账号自动登录）+ 手动账密兜底（**失败 5 次锁 15 分钟**），JWT 鉴权 |
| 个人 AI 配置 | 每人自己的 API Key（**Fernet 加密落库**）/ Base / 模型 / 人设 / 自动执行开关，生效链：个人 → 全局 → .env |
| 全局 | **深色模式**（顶栏切换）、⌘K **FTS5 全文搜索**（页面/资源/笔记/资讯，中文分词）、**收藏夹**（资源/笔记 ☆）、**通知中心**（评论/点赞提醒）、Toast/确认弹窗/空状态 |

## 技术栈

- 前端：React 18 + Vite + TypeScript + Tailwind CSS + framer-motion + zustand + react-markdown
- 后端：FastAPI + SQLAlchemy 2.0 + SQLite（零配置）+ PyJWT + feedparser

## 快速开始

```bash
# 前端
npm install
npm run dev          # http://localhost:5173

# 后端（新终端）
cd backend
pip install -r requirements.txt
python run.py        # http://localhost:8000，SQLite 自动建表 + 播种默认账号
```

或直接双击 `start-all.bat` 一键启动两端。

**演示模式**：想首次打开就有示例内容？在 `backend/.env` 加 `SEED_DEMO=1` 再启动（自动播种示例 Skills/笔记/简报/RSS 源；已有数据时不重复播种）。

**测试**：`cd backend && python -m pytest tests/ -q`（51 个用例，自动使用独立测试库）

**登录**：打开页面自动尝试 Windows 域 SSO（在公司域内电脑本机启动后端即直登）；
失败时手动登录，内置账号 `administrator` / `eap.engineer` / `cim.user`，初始密码 `cim123456`
（可通过 `backend/.env` 的 `DEFAULT_USER_PASSWORD` 修改）。

### backend/.env 可选配置

```
JWT_SECRET=换成一个随机长字符串
DEFAULT_USER_PASSWORD=cim123456
AI_API_BASE=https://api.openai.com/v1
AI_API_KEY=sk-xxx        # 全局兜底 Key（成员可在个人设置里配自己的 Key，个人优先）
AI_MODEL=gpt-4o-mini
AI_BRIEFING_HOUR=8       # 每天自动生成 AI 简报的整点（-1 关闭）
ENABLE_SCHEDULER=1       # 后台线程总开关（RSS/自动简报/每日备份）
CORS_ORIGINS=*
```

> v0.9 起 AI Key 为**个人配置**（设置页折叠卡，加密存储）；`.env` 里的全局键仅作兜底，界面不再保存全局键。
> 想在本地无真实 Key 联调？`python scripts/mock_llm.py` 起一个 Mock LLM（127.0.0.1:9377），`.env` 指向它即可。

## 生产部署（可选）

`npm run build` 后把 `dist` 放到 `backend/` 同级命名为 `dist`（或改 `backend/main.py` 中 `_DIST` 路径），
FastAPI 会自动托管前端静态文件，单端口 8000 即可服务全站。

完整部署指南（Windows 自启 / 备份恢复 / 升级 / CI）见 [docs/DEPLOY.md](docs/DEPLOY.md)。

## Notes 链接使用说明

支持三种粘贴格式，均可解析并一键唤起本机 Notes 客户端（需已安装 Notes）：

1. `notes://Server/库路径/视图UNID/文档UNID?OpenDocument`
2. Notes 客户端「复制文档链接」出的 NDL 文本（含 `<REPLICA>/<VIEW>/<NOTE>/<HINT>/<REM>` 标签）
3. 邮件/网页里的 `<a href="notes://...">标题</a>` 富文本

## 目录结构

```
aiweb/
├── src/                    # 前端
│   ├── components/         # BentoCard / Layout / MegaMenu / Assistant(悬浮助手) / NotesLinkCard / ui/*
│   ├── pages/              # Login / Dashboard / Resources / ResourceDetail / Memos / Chat / Settings
│   ├── stores/  hooks/  services/  utils/
├── backend/
│   ├── routes/             # auth / me / agent / assistant / ai / admin / resources / comments / memos / notes / chat / rss / feed / settings
│   ├── services/           # auth(含登录防爆破) / agent(工具循环) / agent_tools(工具注册表) / notes解析 / skill_meta / ai / rss / scheduler
│   ├── database/           # models + session（create_all 自动建表）
│   ├── tests/              # pytest（19 用例，独立测试库）
│   ├── seed_demo.py        # SEED_DEMO=1 演示数据
│   └── config/  uploads/  data/
├── docs/USER_GUIDE.md      # 使用指南
├── scripts/smoke.bat       # 一键冒烟自测
└── start-all.bat
```

详细使用说明见 [docs/USER_GUIDE.md](docs/USER_GUIDE.md)。

MIT License
