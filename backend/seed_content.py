"""官方内容包播种：SEED_CONTENT=1 时启动导入（按 name 幂等 upsert，不覆盖人工改动之外的字段）。

所有条目均为 AI Hub 原创撰写（MIT），可放心在内网使用；外部分类参考
Agent Skills 开放标准（agentskills.io）/ VSCode Marketplace / DeepSeek Harness 的组织方式。
"""
import logging

from database.models import Resource
from database.session import SessionLocal

logger = logging.getLogger("aiweb.seed_content")

LICENSE = "MIT"
AUTHOR = "AI Hub 官方"

PACK: list[dict] = [
    # ═══════════ Skills：半导体 CIM / 制造场景 ═══════════
    {
        "type": "skill", "name": "eap-comm-troubleshoot", "version": "1.0.0",
        "summary": "EAP/HSMS 通信故障排查：从 ping 到 T3 超时的分层定位法",
        "tags": ["EAP", "HSMS", "排障", "半导体"],
        "content": """## 适用场景
机台通信异常：EAP 显示 Offline、HSMS 断链、远程指令无响应、T3 超时。

## 分层定位法（从下往上）
1. **物理层**：ping 机台 IP；不通先查网线/交换机端口/VLAN 划分
2. **链路层**：HSMS 状态。SELECT 请求有无响应？`LinkTest` 定时器是否漂移？
3. **协议层**：抓 SML 看 T3（回复超时）/T5（连接间隔）/T6（控制事务超时）/T7（NOT SELECTED 超时）哪个先到
4. **应用层**：SML 消息到了但 EAP 脚本没动作 → 查 Scenario/Recipe 匹配与 CEID 订阅

## 快速判断表
| 现象 | 大概率原因 | 第一步动作 |
|---|---|---|
| ping 不通 | 网络/端口 | 找网络组查交换机 |
| SELECT 无响应 | 设备端 HSMS 未启用 | 查设备端 IP/Port 配置 |
| T3 超时 | 设备忙/Recipe 卡住 | 查设备端 ALID 与状态 |
| S1F14 拒绝 | 参数不匹配 | 对 SML 逐字段比对 |

## 提示词
把本技能交给 AI 时，附上：现象、开始时间、抓到的 SML 片段（脱敏后），让它按分层法逐层排除。""",
    },
    {
        "type": "skill", "name": "secs-gem-message-quickref", "version": "1.0.0",
        "summary": "SECS/GEM 常用消息速查：S1/S2/S5/S6/S7/S14 高频 Stream/Function 对照",
        "tags": ["SECS", "GEM", "SML", "半导体"],
        "content": """## 高频消息对照
| Stream.Function | 方向 | 用途 |
|---|---|---|
| S1F1/F2 | 双向 | Are You There |
| S1F13/F14 | Host↔Eq | 建立通信（Establish Communication） |
| S1F3/F4 | Host→Eq | 状态查询（SV/DV/EC） |
| S2F13/F14 | Host→Eq | 设备常数查询 |
| S2F41/F42 | Host→Eq | 远程命令（PP-SELECT/START/STOP） |
| S5F1/F2 | Eq→Host | 告警上报（ALID） |
| S6F11/F12 | Eq→Host | 事件上报（CEID，含 TraceData） |
| S7Fx | Host↔Eq | Recipe 传输（上传/下载/校验） |
| S14Fx | Host↔Eq | 载具/晶圆映射（300mm E90） |

## 排查提醒
- F0 = 中止该 Stream 的事务
- W 位=1 表示需要 S9 系列确认；S9F1/F3/F5/F7/F9 各对应一种错误
- 拿到 SML 先看 System Bytes 配对，再逐字段比对

把抓到的 SML 交给 AI 时，让它先标注每条消息的 Stream.Function、方向与 W 位，再分析语义。""",
    },
    {
        "type": "skill", "name": "cim-log-analysis", "version": "1.0.0",
        "summary": "CIM 日志分析套路：时间对齐、关键字矩阵与 AI 辅助分析模板",
        "tags": ["CIM", "日志", "排障"],
        "content": """## 三步法
1. **圈时间窗**：以告警时刻 ±5 分钟为窗口，把 EAP/MES/设备三方日志拉到同一张表
2. **对齐时间戳**：确认各方日志时区与时钟偏差（设备本地时间常漂移），统一到同一基准
3. **关键字矩阵**：按 `Error / Warning / ALID / CEID / Timeout / Abort / Retry` 逐列过滤

## 交给 AI 的模板
```
以下是某机台 14:00-14:10 的三方日志（已脱敏）。
请按时间顺序输出事件链：每行 = 时刻 | 来源 | 事件 | 推断的因果关系。
最后给出：最可能的根因（1 条）+ 验证方法（1 条）。
```

## 注意
- 日志里有配方参数时先脱敏（见 data-desensitization-guide）
- 大文件先切片再喂（单次 ≤3000 行）""",
    },
    {
        "type": "skill", "name": "data-desensitization-guide", "version": "1.0.0",
        "summary": "送 AI 前的数据脱敏指引：什么能贴、什么必须改、怎么改",
        "tags": ["安全", "合规", "必读"],
        "content": """## 红线（绝不贴给任何 AI）
- 账号密码、API Key、Token、证书
- 员工身份证号 / 手机号 / 银行卡号
- 客户名称与未公开的产品型号、良率、报价
- 未公开的工艺参数区间（可 causing 反推配方）

## 替换手法
| 原始 | 替换为 |
|---|---|
| 机台真实编号 | `EQP-001` |
| 产品型号 | `PRODUCT-A` |
| 良率数值 | 保持数量级即可（如 97.2% → 9x.x%） |
| 内网 IP / 主机名 | `10.x.x.x` / `HOST-xx` |

## 快速自检
粘贴前问自己三个问题：
1. 这段信息能反推出具体客户/产品吗？
2. 里面有能登录任何系统的凭据吗？
3. 截图里有没有背景窗口带敏感内容？（截图最容易漏）""",
    },
    {
        "type": "skill", "name": "weekly-report-writer", "version": "1.1.0",
        "summary": "AI 周报生成：完成/进行中/风险三段式 + 本周数字提炼",
        "tags": ["周报", "效率"],
        "content": """## 用法
把本周工作项丢给 AI（乱列即可），让它输出三段式周报。

## 提示词模板
```
以下是我本周的工作项（未整理）：
<paste>

请生成周报，格式：
## 本周完成
- 成果式描述（动词开头，带数字/结果）
## 进行中
- 事项 + 当前状态 + 预计完成
## 风险与需要的支持
- 风险 + 影响面 + 需要谁做什么

要求：每条不超过 2 行；数字保留；不要扩写虚构内容。
```

## 经验
- 先跑一遍让它列「缺失信息」，补完再出稿，质量高一档
- 敏感数据先按 data-desensitization-guide 处理""",
    },
    {
        "type": "skill", "name": "meeting-minutes-structured", "version": "1.0.0",
        "summary": "会议纪要结构化：结论先行、行动项带 owner 和 deadline",
        "tags": ["会议", "效率"],
        "content": """## 提示词模板
```
以下是会议录音转写/速记（混乱，无结构）：
<paste>

请输出：
## 一句话结论
## 关键决定（每条：决定内容 + 决定依据）
## 行动项表格（事项 | Owner | 截止 | 依赖）
## 遗留问题（未达成一致的）
不要虚构未提到的内容；听不清的标注 [?]。
```

## 经验
- 行动项表格是灵魂：没有 Owner 和截止日期的条目直接标红提醒补齐
- 会后把纪要存到平台笔记，加 `[[相关笔记]]` 双链""",
    },
    {
        "type": "skill", "name": "excel-batch-guide", "version": "1.0.0",
        "summary": "Excel 批处理选型指南：pandas / Power Query / VBA 何时用哪个",
        "tags": ["excel", "自动化"],
        "content": """## 选型口诀
- **一次性、格式乱** → Power Query（可视化清洗，不用写代码）
- **每周固定、要进系统** → Python + pandas（可脚本化、可进 Git）
- **要操作打开中的工作簿/公式重算** → VBA（无奈之选）

## pandas 最小可用模板
```python
import pandas as pd
from pathlib import Path

files = Path(r"D:\\weekly").glob("*.xlsx")
df = pd.concat([pd.read_excel(f) for f in files], ignore_index=True)
df.to_excel("merged.xlsx", index=False)
```

## 让 AI 帮你写
把「列名样例 + 目标输出格式 + 文件数量级」三样发给 AI（先脱敏），让它出完整脚本，再丢一份样例文件验证。""",
    },
    {
        "type": "skill", "name": "incident-postmortem-template", "version": "1.0.0",
        "summary": "故障复盘模板：时间线 → 根因 → 5Why → 防再发清单",
        "tags": ["复盘", "运维"],
        "content": """## 模板结构
```
## 事故概述（影响面/持续时间/发现方式）
## 时间线（发现 → 响应 → 定位 → 恢复，精确到分钟）
## 直接原因 vs 根因（5Why，追问到流程/制度层）
## 为什么没更早发现（监控/告警盲区）
## 防再发清单（每条：动作 | Owner | 截止 | 验证方式）
```

## 用 AI 辅助
把脱敏后的时间线交给 AI：让它找时间线里的断点（两件事之间无因果衔接的地方），
断点往往是没查清的环节。复盘结论存到平台笔记并打标签，下次同类故障先搜历史。""",
    },
    {
        "type": "skill", "name": "code-review-checklist", "version": "1.0.0",
        "summary": "代码评审清单：正确性/可读性/边界/安全四层 20 检查项",
        "tags": ["评审", "代码"],
        "content": """## 四层清单
**正确性**：边界条件（空/单元素/超大）· 错误处理是否吞异常 · 并发与共享状态 · 事务边界
**可读性**：命名见名知义 · 函数 ≤50 行 · 魔法数字提取 · 注释解释「为什么」而非「做什么」
**边界与契约**：输入校验 · 分页/limit 钳制 · SQL 拼接 · 路径拼接（防穿越） · 依赖版本锁定
**安全**：密钥硬编码 · 日志打印敏感值 · 外链/文件类型白名单 · 最小权限

## 给 AI 的评审提示词
```
请按以下四层审查这段代码，每层只列「确实存在的问题」，
没有问题的层写「本层通过」。不要泛泛建议。
```
（配合平台资源库的 AI 助手使用，粘贴前先脱敏。）""",
    },
    {
        "type": "skill", "name": "sql-optimization-checklist", "version": "1.0.0",
        "summary": "SQL 优化检查清单：从 EXPLAIN 到索引设计的固定顺序",
        "tags": ["sql", "数据库"],
        "content": """## 固定排查顺序
1. **看执行计划**：全表扫描？索引没命中？先用 EXPLAIN 再谈优化
2. **WHERE 列上有没有函数/隐式转换**（最常见：字符串列 = 数字）
3. **索引设计**：区分度高的列在前；联合索引遵循最左前缀
4. **SELECT ***：只取需要的列；大字段单独查
5. **深分页**：`LIMIT 100000,20` → 改游标（WHERE id > last_id LIMIT 20）
6. **大批量写**：批处理 + 事务分包，避免长事务锁表

## 让 AI 帮忙
把 `EXPLAIN` 输出 + 建表语句（脱敏）发给 AI，让它指出未命中索引的原因并给出改写版本。""",
    },
    {
        "type": "skill", "name": "intranet-prompt-basics", "version": "1.0.0",
        "summary": "内网 AI 提示词入门：背景/任务/约束/格式四要素 + 平台快捷用法",
        "tags": ["提示词", "入门", "必读"],
        "content": """## 四要素
```
【背景】我是 CIM 工程师，在做…
【任务】请帮我…
【约束】用中文；不超过 X 字；不要虚构；敏感字段用占位符
【格式】表格 / 分点 / 直接输出结果
```

## 平台专属用法
- 悬浮助手（Ctrl+J）**能直接调平台工具**：查资源、读笔记、写笔记、生成简报
- 写操作（建笔记/收藏/发布）默认会先弹确认卡，放心用
- 在资源详情页问「这个怎么用」，助手自动知道你在看哪个资源

## 常见坏习惯
- 只说「帮我优化」不说优化目标（更快？更短？更稳？）
- 一段话塞五个任务（拆开发，一个任务一条）
- 贴敏感原文（先看 data-desensitization-guide）""",
    },
    {
        "type": "skill", "name": "deepseek-harness-quickstart", "version": "1.0.0",
        "summary": "DeepSeek Harness 上手：安装、skills 目录、SKILL.md 最小结构",
        "tags": ["DeepSeek", "Harness", "AI"],
        "content": """## 是什么
DeepSeek Harness（dsh，MIT 开源，developer preview）：DeepSeek 的 Agent 运行时，
基于 Cordis 插件化框架。**Skills 改变它怎么做事，Plugins 改变它能碰到什么。**

## Skills 安装
把技能目录丢进 `~/.agents/skills/` 后重启 dsh：
```
~/.agents/skills/
└── my-skill/
    └── SKILL.md
```

## SKILL.md 最小结构（Agent Skills 开放标准）
```markdown
---
name: my-skill
description: 一句话说明做什么、什么时候用（AI 靠它决定何时加载）
---

## 步骤
1. …
2. …
```
- name：≤64 字符，小写字母/数字/连字符
- description 是「发现入口」：写清触发场景比写细节更重要

## 与本平台的关系
在平台资源库上传你的 SKILL.md（会自动提取 name/description/tags），
同事下载后放进 skills 目录即可用；配合 VSCode 插件开发体验更佳。""",
    },
    # ═══════════ Tools ═══════════
    {
        "type": "tool", "name": "log-timestamp-normalizer", "version": "1.0.0",
        "summary": "多源日志时间戳归一：统一时区/格式，输出对齐后的合并时间线",
        "tags": ["日志", "脚本", "排障"],
        "content": """## 解决什么
三方日志时间格式各异（`2026-11-11 14:03:02.123` / `14:03:02` / epoch 毫秒），
人工对齐费时且容易错。本脚本把多种格式归一到统一时区后按时间排序输出。

## 用法
```python
# normalize_ts.py <输入目录> [-o merged_timeline.csv] [--tz Asia/Shanghai]
```
识别规则可按需扩展 `TS_PATTERNS` 列表。

## 依赖
仅标准库 + 可选 `python-dateutil`。MIT 许可，可自由改造。

## 让 AI 帮你扩展
把「新格式样例」发给助手，让它往 TS_PATTERNS 里加一条正则即可。""",
    },
    {
        "type": "tool", "name": "notes-link-batch-export", "version": "1.0.0",
        "summary": "Notes 视图批量导出文档链接清单（notes:// 格式，可直接入库）",
        "tags": ["notes", "脚本"],
        "content": """## 解决什么
要把 Notes 某视图下几百条文档链接整理成清单贴到平台「Notes 链接库」，
手动一条条复制不现实。

## 思路
LotusScript 或 COM 遍历视图 → 拼接 `notes://server/db/view/unid?OpenDocument` → 输出 CSV。

## Excel/COM 版最小代码
```vba
' 在 Notes 客户端所在机器运行
Set s = CreateObject("Lotus.NotesSession")
Call s.Initialize("密码")
Set db = s.GetDatabase("CN99/PU", "CIM/CIMLOG.nsf")
Set view = db.GetView("($All)")
Set doc = view.GetFirstDocument
Do While Not doc Is Nothing
    Print doc.NotesURL
    Set doc = view.GetNextDocument(doc)
Loop
```
输出后到平台「Notes 链接库 → 批量导入」直接粘贴。注意凭据不落盘。""",
    },
    {
        "type": "tool", "name": "screenshot-ocr-workflow", "version": "1.0.0",
        "summary": "截图取词工作流：本地 OCR 方案选型（内网不出图）",
        "tags": ["OCR", "效率", "安全"],
        "content": """## 场景
老机台界面是截图才能拿到的文本（HMI/工控屏），要转文字给 AI 分析。
**内网安全要求：图片不能出门。**

## 本地方案选型
| 方案 | 优点 | 缺点 |
|---|---|---|
| Windows 自带 OCR（PowerShell UWP API） | 零安装 | 中文一般 |
| PaddleOCR（本地部署） | 中文强 | 首次下载模型要外网，之后离线 |
| Tesseract + chi_sim | 轻量 | 布局复杂时差 |

## 工作流
1. Win+Shift+S 截图
2. 本地 OCR 出文本
3. 按数据脱敏指引检查后，再交给 AI 分析""",
    },
    # ═══════════ Plugins / 生态指南 ═══════════
    {
        "type": "plugin", "name": "zcode-commit-helper", "version": "1.1.0",
        "summary": "ZCode 插件：按团队规范自动生成 Conventional Commits 提交信息",
        "tags": ["zcode", "git", "插件"],
        "content": """## 功能
读取 git 暂存区 diff，调用 AI 生成符合 Conventional Commits 的提交信息，
支持中英双语与 scope 自动推断。

## 安装
复制到 `~/.zcode/plugins/` 后重启 ZCode。

## 规范示例
```
feat: v0.10.0 前端 UI/IA 重构
fix: SSE 消费强制 UTF-8 修复中文乱码
```
类型前缀：feat / fix / docs / test / chore / refactor。""",
    },
    {
        "type": "plugin", "name": "dsh-skill-scaffold", "version": "1.0.0",
        "summary": "SKILL.md 脚手架：一条命令生成符合 Agent Skills 标准的技能骨架",
        "tags": ["dsh", "脚手架", "SKILL.md"],
        "content": """## 解决什么
想给 DeepSeek Harness / Claude Code 写技能，但每次都忘记 frontmatter 规范。

## 脚手架（复制到终端即可）
```bash
mkdir -p ~/.agents/skills/my-skill && cat > ~/.agents/skills/my-skill/SKILL.md <<'MD'
---
name: my-skill
description: 一句话说明做什么、什么时候用（AI 靠它决定何时加载本技能）
license: MIT
version: 0.1.0
---

## 步骤
1. …

## 注意
- …
MD
```

## 规范要点（agentskills.io）
- name：≤64 字符，小写字母/数字/连字符
- description：触发场景写清楚，这决定 AI 会不会用它
- 复杂技能可加 scripts/ 与 references/ 目录（渐进式加载）

## 发布
写完到平台资源库上传，自动提取元数据供全组使用。""",
    },
    {
        "type": "plugin", "name": "vscode-ai-extensions-guide", "version": "1.0.0",
        "summary": "VSCode × AI 合规插件选型指南：按用途分类 + 许可自查方法",
        "tags": ["vscode", "插件", "选型"],
        "content": """## 用途分类速查
| 用途 | 方向 | 说明 |
|---|---|---|
| Python 开发 | 微软官方 Python 扩展族 | 单位标配，注意 Pylance 许可 |
| Notebook | Jupyter 扩展族 | 与数据分析工作流配合 |
| 远程开发 | Remote-SSH / WSL | 连跳板机/内网开发机常用 |
| AI 助手类 | 公司统一指定的那款 | **以公司安全部门白名单为准** |
| Git 增强 | GitLens 等 | 注意核心/Pro 功能许可差异 |

## 合规三步自查法（装任何插件前）
1. **看许可**：市场页侧栏 License 字段；无标注 = 默认版权保留，别用于工作
2. **看发布者**：优先微软官方/知名组织；个人发布者看下载量与更新时间
3. **看数据面**：设置里关掉「遥测」；AI 类插件确认数据不出内网（这是硬要求）

> 供应链提醒：VSCode 市场存在恶意扩展风险（见 Wiz 2025 分析），只装清单内或经审批的插件。

## 建议
把本组最终批准的插件清单整理成一条资源并保持更新，谁要装新插件先来这里对名单。""",
    },
    {
        "type": "skill", "name": "notes-link-usage", "version": "1.0.0",
        "summary": "Notes 链接使用指南：三种粘贴格式 + 一键唤起本机客户端",
        "tags": ["notes", "入门"],
        "content": """## 三种可解析格式
1. `notes://Server/库路径/视图UNID/文档UNID?OpenDocument`
2. Notes 客户端「复制文档链接」出的 NDL 文本（含 `<REPLICA>/<VIEW>/<HINT>` 标签）
3. 邮件/网页里的 `<a href="notes://...">标题</a>` 富文本

## 平台用法
- 笔记正文里直接写 notes:// 链接 → 自动识别成可点击卡片
- 「Notes 链接库」支持批量导入（每行一条）与搜索
- 点击卡片唤起本机 Notes 客户端（需已装 Notes；协议坏了用 fix-notes-protocol 修复）""",
    },
]


def seed_content() -> None:
    """按 name 幂等导入：已存在且 created_by=aihub-official 的条目跳过（不覆盖人工改动）"""
    db = SessionLocal()
    try:
        created = skipped = 0
        for item in PACK:
            exists = (db.query(Resource)
                      .filter(Resource.name == item["name"],
                              Resource.created_by == "aihub-official")
                      .first())
            if exists:
                skipped += 1
                continue
            db.add(Resource(
                type=item["type"], name=item["name"], summary=item["summary"],
                content=item["content"], tags=item["tags"],
                author=AUTHOR, license=LICENSE, version=item.get("version", "1.0.0"),
                source_type="none", created_by="aihub-official",
            ))
            created += 1
        db.commit()
        # 存量演示条目补许可标注（一次性，幂等）
        for legacy in ("excel-batch-merge", "fix-notes-protocol", "zcode-commit-helper"):
            r = db.query(Resource).filter(Resource.name == legacy,
                                          Resource.license == "").first()
            if r:
                r.license = "MIT"
                r.version = r.version or "1.0.0"
        db.commit()
        logger.info("官方内容包播种完成：新增 %d，跳过 %d（SEED_CONTENT=1）", created, skipped)
    finally:
        db.close()
