# AIWEB · AI Hub

公司内网 AI 分享平台：聚合 **Skills（SKILL.md 技能包）/ 小工具 / 插件**，内置 **AI 流式对话 + 内容沉淀**、**RSS 资讯订阅**、**Markdown 笔记**，兼容 **HCL Notes 链接**（解析 + 一键唤起本机 Notes 客户端），支持 **Windows 域自动登录**。

视觉风格：明亮 Bento 网格（大圆角 / 柔和阴影 / 蓝紫渐变 / framer-motion 微动效），支持深色模式。

## 界面预览

| 明亮 | 深色 |
|---|---|
| ![明亮](docs/screenshots/dashboard-light.png) | ![深色](docs/screenshots/dashboard-dark.png) |


## 功能总览

| 模块 | 说明 |
|---|---|
| 首页 Bento | 欢迎卡 + 统计数字滚动（Skills/工具/插件/笔记）+ 聚合动态 Feed（筛选 + 分页）+ 贡献者榜 + **我的收藏** |
| 资源库 | skill / tool / plugin 统一管理：Markdown 详情、标签、搜索、zip/脚本附件上传下载、下载计数、**点赞**、**SKILL.md 元数据自动提取** |
| 笔记 | Markdown 编辑、置顶、标签、搜索 |
| Notes 链接库 | 粘贴 notes:// 链接 / NDL / 富文本 → 解析服务器/数据库/文档 → 点「打开」唤起 Notes 客户端 |
| AI 对话 | OpenAI 兼容 API、SSE 流式输出（可**停止生成**）、Markdown 渲染、多会话、**资源问答 RAG**（自动检索平台资源注入上下文），好回复一键「沉淀为内容卡」 |
| AI 每日简报 | 一键抓取 RSS 最新资讯 → AI 生成中文简报 → 沉淀到首页动态；**每天 8 点自动生成**（`AI_BRIEFING_HOUR` 可配） |
| RSS 资讯 | 设置页管理订阅源，手动刷新抓取（feedparser），条目可**一键存为笔记** |
| 认证 | Windows 域 SSO（后端进程账号自动登录）+ 手动账密兜底，JWT 鉴权 |
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

**测试**：`cd backend && python -m pytest tests/ -q`（49 个用例，自动使用独立测试库）

**登录**：打开页面自动尝试 Windows 域 SSO（在公司域内电脑本机启动后端即直登）；
失败时手动登录，内置账号 `administrator` / `eap.engineer` / `cim.user`，初始密码 `cim123456`
（可通过 `backend/.env` 的 `DEFAULT_USER_PASSWORD` 修改）。

### backend/.env 可选配置

```
JWT_SECRET=换成一个随机长字符串
DEFAULT_USER_PASSWORD=cim123456
AI_API_BASE=https://api.openai.com/v1
AI_API_KEY=sk-xxx        # 也可在「设置」页配置，设置页优先
AI_MODEL=gpt-4o-mini
AI_BRIEFING_HOUR=8       # 每天自动生成 AI 简报的整点（-1 关闭）
ENABLE_SCHEDULER=1       # 后台线程总开关（RSS/自动简报/每日备份）
CORS_ORIGINS=*
```

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
│   ├── components/         # BentoCard / StatCard / Layout / CommandPalette / NotesLinkCard / ui/*
│   ├── pages/              # Login / Dashboard / Resources / ResourceDetail / Memos / Chat / Settings
│   ├── stores/  hooks/  services/  utils/
├── backend/
│   ├── routes/             # auth / ai / admin / resources / comments / memos / notes / chat / rss / feed / settings
│   ├── services/           # auth(移植自 test1) / notes解析 / skill_meta / ai / rss / scheduler
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
