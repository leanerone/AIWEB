# 生态调研：主流技能/插件平台怎么做（v0.11 内容与上传体系依据）

> 调研时间：2026-11-11。结论服务于 AI Hub 的内容组织、上传体验与合规要求。

## 一、三大参照系

### 1. Agent Skills 开放标准（agentskills.io，Anthropic 发起后开放）
- **格式**：一个目录一个 `SKILL.md`（YAML frontmatter + Markdown 正文），
  可选 `scripts/`、`references/`、`assets/` 子目录
- **frontmatter**：必填 `name`（≤64 字符，小写字母/数字/连字符）与 `description`
  （写清「做什么 + 什么时候用」——**AI 靠它决定是否加载**）；可选 `license`、`version` 等
- **渐进式加载**：启动只读 name/description（省上下文），任务匹配才读全文
- **采用方**：Claude Code、DeepSeek Harness、众多 Agent 客户端（跨产品复用是卖点）

### 2. DeepSeek Harness（dsh，MIT 开源）
- 技能安装 = 把 `<name>/SKILL.md` 丢进 `~/.agents/skills/` 后重启
- **Skills 与 Plugins 的区分**：Skills 改变 Agent「怎么做事」，Plugins 改变 Agent「能碰到什么」
  ——这个区分我们直接沿用为平台的两类条目

### 3. VSCode Marketplace（微软）
- `package.json` manifest：`publisher` / `version` / `license`（无 LICENSE 文件时写
  `SEE LICENSE IN <filename>`）/ `categories`
- 企业侧要点：市场存在**供应链风险**（Wiz 2025 分析），企业做法是「审批白名单 + 遥测关闭 + 签名验证」

## 二、我们采纳的设计

| 参照 | 采纳点 | 落地 |
|---|---|---|
| Agent Skills | SKILL.md frontmatter 作为上传/导入的第一公民 | 上传/粘贴自动解析 name/description/tags/license/version |
| Agent Skills | name 规范（≤64、小写连字符） | `validate_skill_name` 自动规范化 |
| Agent Skills | description 写「触发场景」 | 上传表单 placeholder 明示 |
| dsh | skill/tool/plugin 三分类语义 | 平台原有三分类与之对齐 |
| VSCode 市场 | license 字段显式展示 | 资源卡/详情页许可徽章；无许可 = 默认版权保留，提示补齐 |
| VSCode 市场 | 企业白名单治理 | `vscode-ai-extensions-guide` 官方内容条目 + 建议安全部维护名单 |

## 三、合规红线（内容收集原则）

1. **只收两类内容**：
   - **平台原创**（AI Hub 撰写，MIT）——零风险，本次种子包 19 条全部此类
   - **外链引用**：只放链接 + 一句话介绍 + 许可标注，**不复制第三方正文/代码**
2. **许可白名单**：MIT / Apache-2.0 / BSD / CC0 / CC-BY（需署名）。GPL 系只链接不搬运
3. **无许可标注的第三方内容**：不收录；可提示作者补 LICENSE
4. **供应链**：上传附件白名单制（34 类）；企业内插件安装走安全部审批名单
5. **数据安全**：所有官方技能条目内置脱敏指引（data-desensitization-guide 为必读首条）

## 四、内容包现状（SEED_CONTENT=1 自动导入，幂等）

19 条原创条目（MIT）：13 skills（EAP/SECS 排障、CIM 日志、脱敏指引、周报/纪要、
Excel 选型、复盘模板、评审/SQL 清单、提示词入门、DSH 上手、Notes 用法等）
+ 3 tools（时间戳归一、Notes 批量导出、截图 OCR 选型）
+ 3 plugins（ZCode commit、SKILL.md 脚手架、VSCode×AI 选型指南）。

## 五、后续引入真实第三方内容的路径

1. 从 `anthropics/skills`、`ComposioHQ/awesome-claude-skills` 等仓库筛选 MIT 条目，
   人工改写适配公司场景后以「引用 + 改写」方式入库（保留 upstream 链接）
2. 资源详情页展示 `upstream` 字段（待加）记录来源仓库与 commit
3. 定期（月度）人工 review：许可变更/删库检测
