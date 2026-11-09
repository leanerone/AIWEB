"""笔记（Memo）路由：Markdown 笔记 CRUD + 置顶 + 搜索。"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database.models import Memo
from database.session import get_db
from routes.deps import get_current_user

router = APIRouter(prefix="/memos", tags=["memos"])


class MemoIn(BaseModel):
    title: str
    content: str = ""
    tags: list[str] = []
    pinned: bool = False


def _serialize(m: Memo) -> dict:
    return {
        "id": m.id, "title": m.title, "content": m.content, "tags": m.tags or [],
        "pinned": m.pinned, "created_by": m.created_by,
        "created_at": m.created_at.strftime("%Y-%m-%d %H:%M"),
        "updated_at": m.updated_at.strftime("%Y-%m-%d %H:%M"),
    }


@router.get("")
def list_memos(keyword: str = "", tag: str = "", created_by: str = "", page: int = 1, limit: int = 50,
               db: Session = Depends(get_db), _: object = Depends(get_current_user)):
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
    return {"success": True, "data": {"total": total, "items": [_serialize(m) for m in items]}}


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
    return {"success": True, "data": _serialize(m)}


@router.get("/{memo_id}")
def get_memo(memo_id: int, db: Session = Depends(get_db),
             _: object = Depends(get_current_user)):
    m = db.get(Memo, memo_id)
    if not m:
        raise HTTPException(status_code=404, detail="笔记不存在")
    return {"success": True, "data": _serialize(m)}


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
    return {"success": True, "data": _serialize(m)}


@router.delete("/{memo_id}")
def delete_memo(memo_id: int, db: Session = Depends(get_db),
                _: object = Depends(get_current_user)):
    m = db.get(Memo, memo_id)
    if not m:
        raise HTTPException(status_code=404, detail="笔记不存在")
    db.delete(m)
    db.commit()
    return {"success": True}
