"""AI 每日简报：最新 RSS 条目 → AI 生成中文简报 → 沉淀为首页内容卡。

路由（手动点击）与调度器（每天定时）共用本函数；异常由调用方决定
转 HTTPException（路由）还是记录日志（调度）。
"""
import logging
from datetime import datetime

from database.models import FeedCard, RssItem, RssSource
from services.ai_service import stream_chat

logger = logging.getLogger("aiweb.briefing")


def build_briefing(db, created_by: str = "system") -> dict:
    """返回 {id, title, content}；无 RSS 条目抛 ValueError，AI 故障照常向上抛"""
    items = (
        db.query(RssItem)
        .join(RssSource, RssItem.source_id == RssSource.id)
        .filter(RssSource.enabled.is_(True))
        .order_by(RssItem.published_at.desc().nullslast(), RssItem.id.desc())
        .limit(15)
        .all()
    )
    if not items:
        raise ValueError("没有可用的 RSS 条目：先到设置页添加订阅源并刷新")

    lines = "\n".join(f"- [{i.source.name}] {i.title}：{i.summary[:120]}" for i in items)
    prompt = (
        "以下是今天抓取的科技/AI 资讯标题与摘要。请写一份简明的中文简报（Markdown）：\n"
        "1. 用 3-5 条要点概括今天值得关注的动态；\n"
        "2. 最后加一行「# 亮点」点评最有价值的一条；\n"
        "总长度不超过 400 字，直接输出简报内容。\n\n" + lines
    )
    report = "".join(stream_chat(db, [{"role": "user", "content": prompt}]))
    if not report.strip():
        raise RuntimeError("AI 未返回内容")

    card = FeedCard(
        kind="ai",
        title=f"AI 每日简报 · {datetime.now().strftime('%m-%d %H:%M')}",
        content=report.strip(),
        summary=report.strip().replace("\n", " ")[:150],
        ref_type="briefing",
        created_by=created_by,
    )
    db.add(card)
    db.commit()
    return {"id": card.id, "title": card.title, "content": card.content}
