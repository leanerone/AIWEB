"""笔记（Memo）路由：Markdown 笔记 CRUD + 置顶 + 搜索 + 收藏。"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database.models import Bookmark, Memo
from database.session import get_db
from routes.deps import get_current_user
from services import fts

router = APIRouter(prefix="/memos", tags=["memos"])


class MemoIn(BaseModel):
    title: str
    content: str = ""
    tags: list[str] = []
    pinned: bool = False


def _serialize(m: Memo, bookmarked: bool = False) -> dict:
    return {
        "id": m.id, "title": m.title, "content": m.content, "tags": m.tags or [],
        "pinned": m.pinned, "created_by": m.created_by,
        "bookmarked_by_me": bool(bookmarked),
        "created_at": m.created_at.strftime("%Y-%m-%d %H:%M"),
        "updated_at": m.updated_at.strftime("%Y-%m-%d %H:%M"),
    }


@router.get("")
def list_memos(keyword: str = "", tag: str = "", created_by: str = "", page: int = 1, limit: int = 50,
               db: Session = Depends(get_db), user: object = Depends(get_current_user)):
    query = db.query(Memo)
    if keyword:
        like = f"%{keyword}%"
        query = query.filter(or_(Memo.title.like(like), Memo.content.like(like)))
    if tag:
        query = query.filter(Memo.tags.contains(tag))
    if created_by:
        query = query.filter(Memo.created_by == created_by)
    total = query.count()
    page = max(1, page)  # 钳制：page<1 会产生负 OFFSET 导致 500
    limit = max(1, min(limit, 200))
    items = (
        query.order_by(Memo.pinned.desc(), Memo.updated_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    marked: set[int] = set()
    if items:
        marked = {b.target_id for b in db.query(Bookmark)
                  .filter(Bookmark.username == user.username,
                          Bookmark.target_type == "memo",
                          Bookmark.target_id.in_([m.id for m in items])).all()}
    return {"success": True, "data": {"total": total,
                                      "items": [_serialize(m, m.id in marked) for m in items]}}


@router.post("")
def create_memo(body: MemoIn, db: Session = Depends(get_db),
                user: object = Depends(get_current_user)):
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="标题不能为空")
    m = Memo(title=body.title.strip(), content=body.content, tags=body.tags,
             pinned=body.pinned, created_by=user.username)
    db.add(m)
    db.commit()
    db.refresh(m)
    fts.index_memo(db, m)  # 全文索引同步
    db.commit()
    return {"success": True, "data": _serialize(m)}


@router.get("/{memo_id}")
def get_memo(memo_id: int, db: Session = Depends(get_db),
             user: object = Depends(get_current_user)):
    m = db.get(Memo, memo_id)
    if not m:
        raise HTTPException(status_code=404, detail="笔记不存在")
    bookmarked = bool(db.query(Bookmark)
                      .filter(Bookmark.username == user.username,
                              Bookmark.target_type == "memo",
                              Bookmark.target_id == memo_id).first())
    return {"success": True, "data": _serialize(m, bookmarked)}


@router.put("/{memo_id}")
def update_memo(memo_id: int, body: MemoIn, db: Session = Depends(get_db),
                _: object = Depends(get_current_user)):
    m = db.get(Memo, memo_id)
    if not m:
        raise HTTPException(status_code=404, detail="笔记不存在")
    m.title = body.title.strip() or m.title
    m.content = body.content
    m.tags = body.tags
    m.pinned = body.pinned
    db.commit()
    fts.index_memo(db, m)  # 全文索引同步
    db.commit()
    return {"success": True, "data": _serialize(m)}


@router.delete("/{memo_id}")
def delete_memo(memo_id: int, db: Session = Depends(get_db),
                _: object = Depends(get_current_user)):
    m = db.get(Memo, memo_id)
    if not m:
        raise HTTPException(status_code=404, detail="笔记不存在")
    fts.deindex_memo(db, memo_id)  # 全文索引同步
    db.delete(m)
    db.commit()
    return {"success": True}
