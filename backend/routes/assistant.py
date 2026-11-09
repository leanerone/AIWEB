"""悬浮助手主动建议：observe 模式 —— 只建议，不自动执行。

对应 dsh-superagent 的「面板只显示需要人的事」：
首页已有今日简报 → 建议查看；24h 内有新资讯 → 建议了解；这些都只是建议卡，
用户点执行才真正发生（写操作仍走 Agent 的 confirm/auto_exec 通道）。
"""
from datetime import datetime, timedelta

from database.models import FeedCard, RssItem
from database.session import get_db
from fastapi import APIRouter, Depends
from routes.deps import get_current_user
from sqlalchemy.orm import Session

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.get("/suggestions")
def suggestions(db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    items: list[dict] = []
    today = datetime.now().date()
    day_start = datetime.combine(today, datetime.min.time())

    briefing = (db.query(FeedCard)
                .filter(FeedCard.ref_type == "briefing", FeedCard.created_at >= day_start)
                .order_by(FeedCard.id.desc()).first())
    if briefing:
        items.append({"id": "briefing", "title": "今日 AI 简报已就绪",
                      "desc": briefing.summary[:60] or briefing.title,
                      "action": "nav", "ref": "/briefings"})

    day_ago = datetime.now() - timedelta(hours=24)
    new_rss = db.query(RssItem).filter(RssItem.created_at >= day_ago).count()
    if new_rss > 0:
        items.append({"id": "rss", "title": f"过去 24 小时新增 {new_rss} 条资讯",
                      "desc": "可以让我总结今天的动态，或去订阅页管理源",
                      "action": "prompt", "ref": "总结一下最近的 AI 资讯要点"})

    return {"success": True, "data": {"items": items}}
