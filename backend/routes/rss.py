"""RSS 路由：订阅源 CRUD + 手动刷新 + 条目列表。"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.models import RssItem, RssSource
from database.session import get_db
from routes.deps import get_current_user
from services.rss_service import refresh_all, refresh_source

router = APIRouter(prefix="/rss", tags=["rss"])


class SourceIn(BaseModel):
    name: str
    url: str
    enabled: bool = True


@router.get("/sources")
def list_sources(db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    sources = db.query(RssSource).order_by(RssSource.id).all()
    return {
        "success": True,
        "data": [
            {"id": s.id, "name": s.name, "url": s.url, "enabled": s.enabled,
             "last_fetch_at": s.last_fetch_at.strftime("%Y-%m-%d %H:%M") if s.last_fetch_at else None,
             "last_error": s.last_error or ""}
            for s in sources
        ],
    }


@router.post("/sources")
def create_source(body: SourceIn, db: Session = Depends(get_db),
                  _: object = Depends(get_current_user)):
    if not body.url.strip():
        raise HTTPException(status_code=400, detail="URL 不能为空")
    if db.query(RssSource).filter(RssSource.url == body.url.strip()).first():
        raise HTTPException(status_code=400, detail="该订阅源已存在")
    s = RssSource(name=body.name.strip() or body.url.strip()[:50],
                  url=body.url.strip(), enabled=body.enabled)
    db.add(s)
    db.commit()
    return {"success": True}


@router.put("/sources/{source_id}")
def update_source(source_id: int, body: SourceIn, db: Session = Depends(get_db),
                  _: object = Depends(get_current_user)):
    s = db.get(RssSource, source_id)
    if not s:
        raise HTTPException(status_code=404, detail="订阅源不存在")
    s.name = body.name.strip() or s.name
    s.url = body.url.strip() or s.url
    s.enabled = body.enabled
    db.commit()
    return {"success": True}


@router.delete("/sources/{source_id}")
def delete_source(source_id: int, db: Session = Depends(get_db),
                  _: object = Depends(get_current_user)):
    s = db.get(RssSource, source_id)
    if not s:
        raise HTTPException(status_code=404, detail="订阅源不存在")
    db.delete(s)
    db.commit()
    return {"success": True}


@router.post("/refresh")
def refresh(db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    return {"success": True, "data": refresh_all(db)}


@router.post("/sources/{source_id}/refresh")
def refresh_one(source_id: int, db: Session = Depends(get_db),
                _: object = Depends(get_current_user)):
    s = db.get(RssSource, source_id)
    if not s:
        raise HTTPException(status_code=404, detail="订阅源不存在")
    return {"success": True, "data": refresh_source(s, db)}


@router.get("/items")
def list_items(keyword: str = "", source_id: int = 0, page: int = 1, limit: int = 20,
               db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    query = db.query(RssItem)
    if source_id:
        query = query.filter(RssItem.source_id == source_id)
    if keyword:
        query = query.filter(RssItem.title.like(f"%{keyword}%"))
    total = query.count()
    limit = max(1, min(limit, 100))
    items = (query.order_by(RssItem.published_at.desc().nullslast(), RssItem.id.desc())
             .offset((page - 1) * limit).limit(limit).all())
    return {
        "success": True,
        "data": {
            "total": total,
            "items": [
                {"id": i.id, "title": i.title, "link": i.link, "summary": i.summary,
                 "source": i.source.name if i.source else "",
                 "published_at": i.published_at.strftime("%Y-%m-%d %H:%M") if i.published_at else ""}
                for i in items
            ],
        },
    }
