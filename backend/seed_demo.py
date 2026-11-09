"""演示数据播种：SEED_DEMO=1 时启动自动填充示例内容，方便首次打开就能看到效果。"""
import logging

from database.models import FeedCard, Memo, Resource, RssSource
from database.session import SessionLocal

logger = logging.getLogger("aiweb.seed")

SKILL_MD = """## 功能

- 批量读取指定目录下所有 Excel（.xlsx/.xls）
- 按列名合并汇总，输出 `merged.xlsx`
- 支持跳过空表与密码保护表（自动忽略并记录）

## 用法

```bash
python excel_batch_merge.py D:\\logs\\weekly\\ -o merged.xlsx
```

## 依赖

`pandas` + `openpyxl`（`pip install pandas openpyxl`）
"""

TOOL_MD = """检查并修复本机 `notes://` 协议注册的小工具。

场景：重装 Notes 后点击网页里的 notes:// 链接没反应，运行本脚本一键修复注册表关联。

```powershell
.\fix-notes-protocol.ps1   # 需管理员 PowerShell
```
"""


def seed_demo() -> None:
    db = SessionLocal()
    try:
        if db.query(Resource).count() > 0:
            return  # 已有数据则不播种
        db.add_all([
            Resource(type="skill", name="excel-batch-merge", summary="批量合并多个 Excel 周报成一个汇总表",
                     content=SKILL_MD, tags=["excel", "周报", "自动化"], author="leanerone",
                     source_type="path", external_url="", created_by="administrator"),
            Resource(type="tool", name="fix-notes-protocol", summary="修复 notes:// 协议关联，一键恢复链接唤起",
                     content=TOOL_MD, tags=["notes", "注册表"], author="leanerone",
                     source_type="none", created_by="administrator"),
            Resource(type="plugin", name="zcode-commit-helper", summary="ZCode 插件：按团队规范自动生成 commit message",
                     content="读取暂存区 diff，调用 AI 生成符合 Conventional Commits 的提交信息，支持中英双语。\n\n安装：复制到 `~/.zcode/plugins/` 后重启 ZCode。",
                     tags=["zcode", "git"], author="leanerone", source_type="none",
                     created_by="administrator"),
        ])
        db.add_all([
            Memo(title="EAP 排障 Checklist", content="## 机台通信超时排查顺序\n1. ping 机台 IP\n2. 查 HSMS 状态（SELECT 请求有无响应）\n3. 看 EAP 日志里的 T3 超时\n4. 联系设备科确认网线/交换机\n\n详细案例：notes://CN99/PU/CIM/CIMLOG.nsf/0/9F2C7A1E1234ABCDEF0123456789ABCD?OpenDocument",
                 tags=["EAP", "排障"], pinned=True, created_by="administrator"),
            Memo(title="AI 周报助手使用心得", content="把本周工作项列表丢给 AI，让它按「完成 / 进行中 / 风险」三段生成周报初稿，人工再润色，效率提升明显。注意敏感数据脱敏后再粘贴。",
                 tags=["AI", "周报"], created_by="administrator"),
        ])
        db.add(FeedCard(kind="ai", title="AI 每日简报 · 示例",
                        content="### 今日要点\n- **大模型端侧化加速**：多家厂商推出离线推理方案，内网工具可直接集成\n- **代码助手普及**：ZCode/Claude Code 类 CLI 成为新工作流\n- **企业知识库 RAG** 落地成本继续下降\n\n# 亮点\n端侧模型让「不出内网也能用 AI」变得现实，适合我们公司的数据安全要求。",
                        summary="端侧模型 / 代码助手 CLI / 企业 RAG 三条趋势速览（示例卡片）",
                        ref_type="briefing", created_by="administrator"))
        db.add(RssSource(name="Hacker News · AI", url="https://hnrss.org/newest?q=AI", enabled=True))
        db.commit()
        logger.info("演示数据已播种（SEED_DEMO=1）")
    finally:
        db.close()
