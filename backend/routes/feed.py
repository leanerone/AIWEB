"""聚合路由：首页 Bento 统计 + 动态 Feed。"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.models import (ChatSession, FeedCard, Memo, Resource, RssItem,
                             RssSource)
from database.session import get_db
from routes.deps import get_current_user

router = APIRouter(prefix="/hub", tags=["hub"])


@router.delete("/cards/{card_id}")
def delete_card(card_id: int, db: Session = Depends(get_db),
                user: object = Depends(get_current_user)):
    """删除内容卡（创建者或管理员）"""
    card = db.get(FeedCard, card_id)
    if not card:
        raise HTTPException(status_code=404, detail="内容卡不存在")
    if user.role != "admin" and card.created_by != user.username:
        raise HTTPException(status_code=403, detail="只能删除自己创建的内容卡")
    db.delete(card)
    db.commit()
    return {"success": True}


@router.get("/stats")
def stats(db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    def count(model):
        return db.query(model).count()

    return {
        "success": True,
        "data": {
            "skills": db.query(Resource).filter(Resource.type == "skill").count(),
            "tools": db.query(Resource).filter(Resource.type == "tool").count(),
            "plugins": db.query(Resource).filter(Resource.type == "plugin").count(),
            "memos": count(Memo),
            "chats": count(ChatSession),
            "rss_sources": db.query(RssSource).filter(RssSource.enabled.is_(True)).count(),
            "rss_items": count(RssItem),
            "cards": count(FeedCard),
        },
    }


@router.get("/today")
def today_count(db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    """今日新增条目数（资源+笔记+内容卡+资讯），用于顶栏铃铛"""
    from datetime import date, datetime

    start = datetime.combine(date.today(), datetime.min.time())
    n = sum([
        db.query(Resource).filter(Resource.created_at >= start).count(),
        db.query(Memo).filter(Memo.created_at >= start).count(),
        db.query(FeedCard).filter(FeedCard.created_at >= start).count(),
        db.query(RssItem).filter(RssItem.created_at >= start).count(),
    ])
    return {"success": True, "data": {"new_today": n}}


@router.get("/contributors")
def contributors(db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    """贡献者榜：资源 + 笔记 + 内容卡计数 Top 8"""
    from collections import Counter

    counter: Counter = Counter()
    for name, in db.query(Resource.created_by).all():
        if name:
            counter[name] += 2  # 资源权重更高
    for name, in db.query(Memo.created_by).all():
        if name:
            counter[name] += 1
    for name, in db.query(FeedCard.created_by).all():
        if name:
            counter[name] += 1
    top = counter.most_common(8)
    max_count = top[0][1] if top else 1
    return {
        "success": True,
        "data": [
            {"user": name, "count": count, "percent": round(count * 100 / max_count)}
            for name, count in top
        ],
    }


@router.get("/feed")
def feed(limit: int = 30, db: Session = Depends(get_db),
         _: object = Depends(get_current_user)):
    """聚合动态：内容卡 + 最新资源 + 最新笔记 + 最新 RSS，混排时间线"""
    items: list[dict] = []

    for c in db.query(FeedCard).order_by(FeedCard.created_at.desc()).limit(limit).all():
        items.append({
            "kind": c.kind, "id": c.id, "title": c.title, "summary": c.summary,
            "content": c.content, "source_url": c.source_url or "",
            "created_by": c.created_by,
            "created_at": c.created_at.strftime("%Y-%m-%d %H:%M"),
            "created_ts": c.created_at.timestamp(),
        })

    for r in db.query(Resource).order_by(Resource.created_at.desc()).limit(limit).all():
        items.append({
            "kind": "resource", "id": r.id, "title": r.name,
            "summary": r.summary or r.content[:150],
            "ref_type": r.type, "ref_id": r.id, "created_by": r.created_by,
            "created_at": r.created_at.strftime("%Y-%m-%d %H:%M"),
            "created_ts": r.created_at.timestamp(),
        })

    for m in db.query(Memo).order_by(Memo.created_at.desc()).limit(limit).all():
        items.append({
            "kind": "note", "id": m.id, "title": m.title,
            "summary": m.content.replace("\n", " ")[:150],
            "ref_type": "memo", "ref_id": m.id, "created_by": m.created_by,
            "created_at": m.created_at.strftime("%Y-%m-%d %H:%M"),
            "created_ts": m.created_at.timestamp(),
        })

    for i in db.query(RssItem).order_by(RssItem.published_at.desc().nullslast(),
                                        RssItem.id.desc()).limit(limit).all():
        items.append({
            "kind": "rss", "id": i.id, "title": i.title, "summary": i.summary[:150],
            "source_url": i.link, "ref_type": "rss", "ref_id": i.id,
            "created_by": i.source.name if i.source else "RSS",
            "created_at": (i.published_at or i.created_at).strftime("%Y-%m-%d %H:%M"),
            "created_ts": (i.published_at or i.created_at).timestamp(),
        })

    items.sort(key=lambda x: x.get("created_ts", 0), reverse=True)
    for it in items:
        it.pop("created_ts", None)
    return {"success": True, "data": items[:limit]}
