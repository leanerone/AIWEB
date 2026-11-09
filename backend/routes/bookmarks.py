"""收藏夹路由：资源 / 笔记的用户级收藏 toggle 与列表。"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.models import Bookmark, Memo, Resource
from database.session import get_db
from routes.deps import get_current_user
from routes.memos import _serialize as serialize_memo
from routes.resources import _serialize as serialize_resource

router = APIRouter(prefix="/bookmarks", tags=["bookmarks"])

TARGET_TYPES = {"resource", "memo"}


class BookmarkIn(BaseModel):
    target_type: str
    target_id: int


def _get_target(db: Session, target_type: str, target_id: int):
    model = Resource if target_type == "resource" else Memo
    return db.get(model, target_id)


@router.post("/toggle")
def toggle(body: BookmarkIn, db: Session = Depends(get_db),
           user: object = Depends(get_current_user)):
    """收藏 / 取消收藏（幂等 toggle）"""
    if body.target_type not in TARGET_TYPES:
        raise HTTPException(status_code=400, detail="target_type 必须是 resource/memo")
    if not _get_target(db, body.target_type, body.target_id):
        raise HTTPException(status_code=404, detail="目标不存在或已删除")
    q = (db.query(Bookmark)
         .filter(Bookmark.username == user.username,
                 Bookmark.target_type == body.target_type,
                 Bookmark.target_id == body.target_id))
    existing = q.first()
    if existing:
        db.delete(existing)
        db.commit()
        return {"success": True, "data": {"bookmarked": False}}
    db.add(Bookmark(username=user.username, target_type=body.target_type,
                    target_id=body.target_id))
    db.commit()
    return {"success": True, "data": {"bookmarked": True}}


@router.get("")
def list_bookmarks(type: str = "resource", db: Session = Depends(get_db),
                   user: object = Depends(get_current_user)):
    """我的收藏列表（含目标详情，目标已删除的收藏自动清理）"""
    if type not in TARGET_TYPES:
        raise HTTPException(status_code=400, detail="type 必须是 resource/memo")
    marks = (db.query(Bookmark)
             .filter(Bookmark.username == user.username, Bookmark.target_type == type)
             .order_by(Bookmark.created_at.desc(), Bookmark.id.desc())
             .limit(200).all())
    items = []
    stale_ids: list[int] = []
    for b in marks:
        target = _get_target(db, type, b.target_id)
        if not target:
            stale_ids.append(b.id)
            continue
        s = serialize_resource(target, user.username) if type == "resource" else serialize_memo(target)
        items.append({"bookmark_id": b.id, "bookmarked_at": b.created_at.strftime("%Y-%m-%d %H:%M"),
                      "target": s})
    if stale_ids:  # 目标已删除 → 清理悬挂收藏
        (db.query(Bookmark).filter(Bookmark.id.in_(stale_ids))
         .delete(synchronize_session=False))
        db.commit()
    return {"success": True, "data": {"total": len(items), "items": items}}
