"""统一全文搜索路由：资源 / 笔记 / RSS 资讯一次查完。"""
from fastapi import APIRouter, Depends
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database.models import Memo, Resource, RssItem
from database.session import get_db
from routes.deps import get_current_user
from services import fts

router = APIRouter(prefix="/search", tags=["search"])


@router.get("")
def unified_search(q: str = "", limit: int = 20,
                   db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    """FTS5 全文检索；FTS 不可用时回落 LIKE（诚实降级）"""
    q = (q or "").strip()
    if not q:
        return {"success": True, "data": []}
    limit = max(1, min(limit, 50))
    try:
        if not fts.available(db):
            raise RuntimeError("fts5 unavailable")
        items = fts.search(db, q, limit)
    except Exception:
        items = _like_fallback(db, q, limit)
    return {"success": True, "data": items}


def _like_fallback(db: Session, q: str, limit: int) -> list[dict]:
    """FTS5 不可用时的 LIKE 降级（功能子集，保证可用）"""
    like = f"%{q}%"
    items: list[dict] = []
    for r in (db.query(Resource)
              .filter(or_(Resource.name.like(like), Resource.summary.like(like),
                          Resource.content.like(like)))
              .limit(limit).all()):
        items.append({"kind": "resource", "id": r.id, "title": r.name,
                      "snippet": (r.summary or r.content[:100])[:160],
                      "created_by": r.created_by,
                      "created_at": r.created_at.strftime("%Y-%m-%d %H:%M")})
    for m in (db.query(Memo)
              .filter(or_(Memo.title.like(like), Memo.content.like(like)))
              .limit(limit).all()):
        items.append({"kind": "memo", "id": m.id, "title": m.title,
                      "snippet": m.content[:160], "created_by": m.created_by,
                      "created_at": m.updated_at.strftime("%Y-%m-%d %H:%M")})
    for i in (db.query(RssItem).filter(RssItem.title.like(like))
              .limit(limit).all()):
        items.append({"kind": "rss", "id": i.id, "title": i.title,
                      "snippet": i.summary[:160],
                      "created_by": i.source.name if i.source else "RSS",
                      "created_at": (i.published_at or i.created_at).strftime("%Y-%m-%d %H:%M")})
    items.sort(key=lambda x: x["created_at"], reverse=True)
    return items[:limit]
