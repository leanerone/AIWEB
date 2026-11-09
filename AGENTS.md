# AGENTS.md — AIWEB 开发约定与架构速览

> 面向在本仓库工作的 AI 助手与开发者。历史迭代细节见 `WORKLOG.md`，版本变更见 `CHANGELOG.md`。

## 项目定位

公司内网 AI 分享平台：资源库（Skills/工具/插件）+ 悬浮 AI 助手（Agent 工具循环）+ AI 每日简报
+ RSS 订阅 + Markdown 笔记 + Notes 链接解析 + Windows 域 SSO。单机 SQLite，零配置可跑。

## 技术栈

- 前端：React 18 + Vite + TypeScript + Tailwind + zustand + framer-motion（`npm run build` 含 tsc 类型检查）
- 后端：FastAPI + SQLAlchemy 2.0 + SQLite + PyJWT（`cd backend && python run.py`，8000 端口）
- 测试：后端 pytest（`cd backend && python -m pytest tests/ -q`，当前基线 **80 用例**）；
  API 全链路 `python scripts/e2e_check.py`（需起服务，可配 mock LLM `python scripts/mock_llm.py`）

## 架构地图

```
backend/
├── routes/            # 每域一个路由文件，统一挂 /api 前缀
│   ├── agent.py       # POST /agent/run、/agent/resume（SSE）、GET /runs/{id}
│   ├── assistant.py   # GET /assistant/suggestions（Proactive 建议卡）
│   ├── me.py          # GET/PUT /me/ai-config（个人 AI Key，Fernet 加密）
│   ├── chat.py        # 会话 CRUD + /chat/completions（普通流式，助手不走这里）
│   └── ...
├── services/
│   ├── agent_service.py   # Agent 主循环（_loop），SSE 事件：meta/step/delta/confirm/ask/error/done
│   ├── agent_tools.py     # 工具注册表 —— 加新工具改这里：_register(name, 描述, JSON Schema, handler, write, summary_args)
│   ├── ai_service.py      # get_ai_config(db, username) 生效链：个人 → 全局 KV → .env
│   ├── secret_box.py      # Fernet 加密（Key 密钥派生自 data/secret.key）
│   ├── fts.py             # FTS5 全文索引：增删改后必须同步 index_*/deindex_*（或重建）
│   ├── scheduler.py       # RSS 定时刷新 / 自动简报 / 每日备份 / agent_runs 清理
│   └── briefing.py        # 简报生成（路由与调度器共用）
└── database/
    ├── models.py          # 15 张表；新表直接加模型（create_all 建表）
    └── session.py         # ensure_schema_upgrade()：已有表加列用「缺则 ALTER」轻量迁移

src/
├── components/Assistant/FloatingAssistant.tsx  # 悬浮球 + 玻璃面板（挂在 Layout，全局可用）
├── stores/assistant.ts    # 助手全部逻辑（SSE 消费在 store 层，页面切换不断线）
├── stores/auth.ts         # token/user 持久化
└── services/api.ts        # axios 拦截器：自动解包 {success,data,message} 信封 —— 调用方拿到的就是 data
```

## 关键约定

1. **API 信封**：所有 JSON 接口返回 `{"success": bool, "data": ..., "detail/message"}`；前端 axios 已解包。
2. **SSE 事件**：`event: <name>\ndata: <json>\n\n`；Agent 事件见上；错误走 `error` 事件或 HTTP 状态码，绝不伪造内容。
3. **AI 配置**：一律通过 `get_ai_config(db, username)`（注意带 username 参数），别直接读 Setting 表。
4. **权限**：登录用 `get_current_user`，管理员用 `require_admin`；资源归属比较用 `created_by`。
   Windows 域账号大小写不敏感——用户查找用 `func.lower()`（见 routes/auth.py `_ensure_user`）。
5. **FTS 同步**：资源/笔记/RSS 增删改后调用 `fts.index_*/deindex_*`，否则搜索出现幻觉空窗。
6. **Agent 工具**：只读工具直接放行；`write=True` 的工具默认弹确认卡（用户 auto_exec 开启才自动执行）。
   handler 返回 `(ok, summary, result)`——summary 给任务卡一行展示，result 回传给模型（≤3000 字符）。
7. **提交规范**：中文 conventional 风格（`feat:` / `fix:` / `docs:` / `test:` / `chore:`），一次一个主题。
8. **WORKLOG.md**：每轮迭代追加一段（时间 + 版本号 + 要点 + 测试基线变化），这是项目的传统。

## 已知坑（历史教训，勿重蹈）

- axios 拦截器解包信封后，调用方泛型写 `api.get<never, T>`。
- `create_all` 不会给已有表加列 → 改表结构必须同时改 `ensure_schema_upgrade()`。
- Agent 首次调用成功后要锁定 `state["mode"]="function"`；否则 resume 会用错消息角色（真 OpenAI 会 400）。
- 不支持 `tools` 参数的 OpenAI 兼容代理：`_looks_like_tools_unsupported` 探测后自动降级 ReAct JSON 协议。
- 测试 mock `get_ai_config` 必须带 `username=None` 参数（签名已变）；需要"普通用户"前提的用例用
  `plain_user_token()`（SSO 进程账号在本机会映射为管理员）。
- 生成器里 mock 迭代器耗尽会抛 StopIteration（PEP 479 → RuntimeError），脚本序列要按调用次数给足。
- 补丁脚本写 f-string 含 `\n` 时注意 CRLF/LF 差异，最好用 `chr(10)`。
- 改公共 CSS 要复查定位属性是否被后写规则顶掉；改透明度要顺手算文字对比度（AA 线）。

## 快速联调（无真实 Key）

```bash
python scripts/mock_llm.py &                 # Mock LLM :9377
cd backend && python run.py &                # 后端 :8000（.env 指向 mock）
npm run dev                                  # 前端 :5173
python scripts/e2e_check.py                  # API 全链路 10 项
```
