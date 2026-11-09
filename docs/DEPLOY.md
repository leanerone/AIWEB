# 部署指南（内网 Windows）

单端口 8000 服务全站：FastAPI 构建产物托管模式（`backend/../dist` 存在时自动生效）。

## 1. 构建前端

```bash
npm ci
npm run build        # 产出 dist/（含 TS 类型检查）
```

## 2. 后端

```bash
cd backend
pip install -r requirements.txt        # 生产依赖；测试额外装 requirements-dev.txt
python run.py                          # http://0.0.0.0:8000
```

首次启动自动：建表 → 播种默认账号 → 全量重建 FTS5 全文索引 → 启动后台线程
（RSS 每小时刷新 + 每天 8 点自动简报 + SQLite 每日备份保留 7 份）。

## 3. backend/.env 配置

| 键 | 默认 | 说明 |
|---|---|---|
| `JWT_SECRET` | 自动生成并存 `data/secret.key` | 建议显式配置固定随机长串 |
| `JWT_EXPIRE_HOURS` | 168 | token 有效期（小时） |
| `DEFAULT_USER_PASSWORD` | cim123456 | 内置演示账号初始密码 |
| `AI_API_BASE` / `AI_API_KEY` / `AI_MODEL` | OpenAI 全局兜底 | 成员可在「设置 → 个人 AI 设置」配自己的 Key（个人优先，加密存储）；此界面不再保存全局键 |
| `AI_BRIEFING_HOUR` | 8 | 每日自动简报整点，`-1` 关闭 |
| `ENABLE_SCHEDULER` | 1 | 后台线程总开关（调试/测试可设 0） |
| `CHAT_CONTEXT_ROUNDS` | 12 | 对话携带上下文轮数 |
| `SEED_DEMO` | 空 | 设 `1` 播种演示数据 |
| `CORS_ORIGINS` | * | 逗号分隔白名单；纯同源托管可忽略 |

## 4. 开机自启（任选其一）

- **任务计划程序**：新建任务「登录时」运行 `start-all.bat`（开发模式双端口）；
  或 `python run.py`（生产单端口，需先 build）。
- **NSSM 服务**：`nssm install AIHub "C:\python312\python.exe" "C:\AIWEB\backend\run.py"`，
  随后 `nssm start AIHub`，崩溃自动重启。
- 内网机器直接双击 `start-all.bat` 也可长期使用。

## 5. 数据与备份

- 数据库：`backend/data/aiweb.sqlite`；附件：`backend/uploads/`；两者都被 `.gitignore` 排除。
- 自动备份：`backend/data/backups/aiweb-YYYYmmdd-HHMM.sqlite`，保留最近 7 份（sqlite3 在线备份 API）。
- 手动备份：管理员在「设置」页可下载当前数据库。
- 迁移/恢复：停服 → 复制 `aiweb.sqlite`（或某份 backup 改名覆盖）→ 启动即可；
  全文索引启动时自动重建，无需手工干预。

## 6. 升级步骤

```bash
git pull
pip install -r backend/requirements.txt   # 依赖有变化时
npm ci && npm run build
# 重启后端服务
```

## 7. 验证

```bash
curl http://localhost:8000/api/health     # {"status":"ok","app":"aiweb"}
cd backend && python -m pytest tests/ -q  # 49 用例
```

CI：推送到 GitHub 后 `.github/workflows/ci.yml` 自动跑 pytest + 前端构建。

## 数据库迁移（Alembic）

- v0.9.22 起 Schema 变更走 Alembic（`backend/migrations/`）；启动时自动给存量库打 baseline 标记（幂等）
- 全新部署：`python -m alembic upgrade head`（或照旧让启动时 create_all 建表，二者等价）
- 存量部署：无需操作，启动时自动 `stamp`；也可手动 `python -m alembic stamp head`
- 后续改模型：`python -m alembic revision --autogenerate -m "说明"` → 检查脚本 → `python -m alembic upgrade head`

