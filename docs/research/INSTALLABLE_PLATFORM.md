# 平台演进规划:从「技能分享站」到「内网 AI 资源安装中枢」

> 2026-11-17 · 深入分析 + 完整工作内容。目标:让 AI Hub 成为内网的
> **MCP Server / Agent / Skill 的上传、分发、安装中枢**,作为企业 AI 后台支撑。

## 一、目标定位

用户愿景:打开网站 = 一个 AI 主界面(已完成 v0.14)。提问 → AI 分配。但背后必须有
**可安装的标准化资源**支撑——现在的 skill/tool/plugin 是「说明书式」资源(教 AI 怎么做),
缺少「可安装式」资源:**MCP Server**(给 AI 接能力)与 **Agent 包**(给 AI 一个执行体)。

```
用户提问 → AI 分配 → 推荐卡 → 「安装」→
  ├─ Skill:SKILL.md → ~/.agents/skills/(已有)
  ├─ MCP Server:server.json → claude_desktop_config.json / ZCode / DSH(新增)
  └─ Agent:bundle/config → 运行时(新增)
```

## 二、生态调研结论(2026-11)

### MCP Server 分发的主流格式
1. **官方 MCP Registry**(`registry.modelcontextprotocol.io`):`server.json` 清单,
   字段 = name/title/description/version/packages[]/remotes[];packages 支持
   **npm / pypi / nuget / cargo / oci(docker) / mcpb**(打包二进制)六种 registryType;
   所有权验证:package.json `mcpName` / README `mcp-name:` 注释 / OCI label
2. **Smithery**:`smithery.yaml` 清单 + `npx -y @smithery/cli install <server> --client claude` 一键装
3. **客户端配置**:`claude_desktop_config.json` 的 `mcpServers` 块
   (`command/args/env` 或远程 `{"type":"http","url":...}`)是事实上的安装终态;
   ZCode/DSH/Cursor 等各自有等价配置块

### 对平台的启示
- **不要自造格式**:清单采用 server.json 兼容子集(内网只装内网/白名单源),未来可直通官方 registry
- **安装配方(install recipe)按客户端生成**:同一资源 → Claude Desktop / ZCode / DSH / 裸命令行
  四种终态,一键复制
- **安全是主卖点**:企业内网装 MCP = 供应链审查。平台内建清单校验 + 密钥占位告警 +
  审批标记,是 VSCode 市场类产品没做好的事

## 三、现状差距分析

| 能力 | 现状 | 差距 |
|---|---|---|
| 资源类型 | skill/tool/plugin 三类 | 缺 **mcp / agent** 两类(被当"说明书"存,无结构化清单) |
| 清单结构 | 无(manifest 概念不存在) | 需 `manifest` JSON 列 + Schema 校验 |
| 安装 | 复制自然语言安装指令(给 AI 看的) | 缺 **per-client 安装配方**(给机器读的) |
| 密钥安全 | 上传白名单 + 私有可见性 ✓ | env 中的真实密钥无检测/占位机制 |
| 审批流 | 公开/私有 ✓ | 缺「未审核/已审核」标记与治理页 |
| 统计 | downloads/views ✓ | 缺「谁装过/哪个客户端」维度(可后置) |

## 四、完整工作内容(四阶段)

### Phase 1 · 数据模型与清单校验(地基,~1 个通宵)
1. `ALLOWED_TYPES += {"mcp", "agent"}`;前端 Tab 同步
2. Resource 加 `manifest` JSON 列(轻量迁移)+ `verified` bool
3. `services/mcp_manifest.py`:
   - `validate_mcp_manifest(obj)` —— server.json 兼容校验(必填 name/version/packages[].transport,
     registryType 白名单,env 只存 `{key, description, required}` 占位)
   - `detect_secrets(manifest)` —— env 值里疑似 sk-/AKIA/token 模式 → 警告并拒绝入库
   - `validate_agent_manifest(obj)` —— runtime(dsh/zcode/generic)+ entry 检查
4. 上传链路:JSON 粘贴 / 拖 .json → 校验 → 回填表单;`/api/resources/preview-meta` 支持 .json 清单

### Phase 2 · 安装配方生成(核心价值,~1 个通宵)
5. `GET /api/resources/{id}/install-recipe` → 按 `client` 参数生成:
   - `claude_desktop`:`{"mcpServers": {"<name>": {command/args/env}}}` 片段(stdio)
     或 `{"mcpServers": {"<name>": {"type":"http","url":...}}}`(remote)
   - `zcode` / `dsh`:等价配置块 + DSH 的 `~/.agents/skills/` 指引
   - `npx` / `uvx` / `docker`:裸命令行(按 packages[].registryType)
   - env 全部用占位符 `<YOUR_KEY>`,绝不回传真实值
6. 资源详情页「安装」面板:客户端 Tab + 配置块复制 + 需求环境变量清单
7. agent 工具 `get_install_recipe(name, client)`:悬浮助手直接回复安装配置

### Phase 3 · 治理与统计(~1 个通宵)
8. `verified` 标记:管理员设置页审批(公开的 mcp/agent 默认 unverified,卡片黄标)
9. 治理页:全部资源列表(含私有)+ 审核/下架按钮(规划已有,此处补 mcp/agent 字段展示)
10. 安装统计:manifest 版本变更记录进版本历史;recipe 复制计数

### Phase 4 · 进阶(可选)
11. `.mcpb` 打包上传(白名单加 .mcpb + fileSha256 记录)
12. 与 DSH/ZCode 运行时联动:平台提供 `GET /api/registry/server.json` 兼容端点,
    供客户端直接订阅内网 registry
13. 沙箱试运行(高风险,后置)

## 五、合规要点(内网硬要求)

- manifest 里 `command` 不做执行——平台只分发配置,执行在用户本机(责任边界清晰)
- env 密钥:只存占位与说明,真实值永不入库;`detect_secrets` 上传即拦
- registryType 白名单限定内网可达源;外链仓库只链接不搬运
- 公开 mcp/agent 走管理员审核(verified),未审核条目黄标提示

## 六、工作量与顺序

| 阶段 | 内容 | 预估 |
|---|---|---|
| P1 | 类型/列/校验服务/上传链路 | 1 个通宵 |
| P2 | 安装配方 API + 安装面板 + agent 工具 | 1 个通宵 |
| P3 | 审核标记/治理页/统计 | 1 个通宵 |
| P4 | mcpb/registry 端点/沙箱 | 视需求 |
