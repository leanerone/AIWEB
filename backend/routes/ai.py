"""AI 能力路由：每日简报（RSS → AI 摘要 → 内容卡）。"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.models import FeedCard, RssItem, RssSource
from database.session import get_db
from routes.deps import get_current_user
from services.ai_service import AiNotConfigured, stream_chat

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/briefing")
def daily_briefing(db: Session = Depends(get_db), user: object = Depends(get_current_user)):
    """把启用的 RSS 源里最新条目交给 AI 生成「今日 AI 简报」，沉淀为内容卡"""
    items = (
        db.query(RssItem)
        .join(RssSource, RssItem.source_id == RssSource.id)
        .filter(RssSource.enabled.is_(True))
        .order_by(RssItem.published_at.desc().nullslast(), RssItem.id.desc())
        .limit(15)
        .all()
    )
    if not items:
        raise HTTPException(status_code=400, detail="没有可用的 RSS 条目：先到设置页添加订阅源并刷新")

    lines = "\n".join(f"- [{i.source.name}] {i.title}：{i.summary[:120]}" for i in items)
    prompt = (
        "以下是今天抓取的科技/AI 资讯标题与摘要。请写一份简明的中文简报（Markdown）：\n"
        "1. 用 3-5 条要点概括今天值得关注的动态；\n"
        "2. 最后加一行「# 亮点」点评最有价值的一条；\n"
        "总长度不超过 400 字，直接输出简报内容。\n\n" + lines
    )
    try:
        report = "".join(stream_chat(db, [{"role": "user", "content": prompt}]))
    except AiNotConfigured as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI 调用失败：{e}")
    if not report.strip():
        raise HTTPException(status_code=502, detail="AI 未返回内容")

    card = FeedCard(
        kind="ai",
        title=f"AI 每日简报 · {datetime.now().strftime('%m-%d %H:%M')}",
        content=report.strip(),
        summary=report.strip().replace("\n", " ")[:150],
        ref_type="briefing",
        created_by=user.username,
    )
    db.add(card)
    db.commit()
    return {"success": True, "data": {"id": card.id, "title": card.title, "content": card.content}}
