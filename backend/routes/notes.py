"""Notes 链接路由：解析 + 保存 + 列表检索。"""
from fastapi import APIRouter, Depends, Body
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database.models import NoteLink
from database.session import get_db
from routes.deps import get_current_user
from services.notes_service import parse_notes_url

router = APIRouter(prefix="/notes", tags=["notes"])


@router.post("/parse")
def parse(raw_text: str = Body(..., embed=True), user: object = Depends(get_current_user)):
    """粘贴任意文本（notes:// 链接 / NDL / 含链接的富文本），返回解析结果"""
    parsed = parse_notes_url(raw_text)
    parsed["valid"] = bool(parsed.get("url"))
    return {"success": True, "data": parsed}


@router.post("/links")
def save_link(raw_text: str = Body(..., embed=True), db: Session = Depends(get_db),
              user: object = Depends(get_current_user)):
    parsed = parse_notes_url(raw_text)
    if not parsed.get("url"):
        return {"success": False, "message": "未识别到 Notes 链接"}
    link = NoteLink(
        raw_text=raw_text[:2000], url=parsed["url"], title=parsed["title"],
        server=parsed["server"], database=parsed["database"], view=parsed["view"],
        document=parsed["document"], replica_id=parsed["replica_id"],
        view_id=parsed["view_id"], note_id=parsed["note_id"], created_by=user.username,
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return {"success": True, "data": {"id": link.id, **{k: parsed[k] for k in
            ("url", "title", "server", "database", "view", "document")}}}


@router.get("/links")
def list_links(keyword: str = "", page: int = 1, limit: int = 20,
               db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    query = db.query(NoteLink)
    if keyword:
        like = f"%{keyword}%"
        query = query.filter(or_(NoteLink.title.like(like), NoteLink.database.like(like),
                                 NoteLink.document.like(like), NoteLink.url.like(like)))
    total = query.count()
    page = max(1, page)  # 钳制：page<1 会产生负 OFFSET 导致 500
    limit = max(1, min(limit, 100))
    items = (query.order_by(NoteLink.created_at.desc())
             .offset((page - 1) * limit).limit(limit).all())
    return {
        "success": True,
        "data": {
            "total": total,
            "items": [
                {"id": l.id, "url": l.url, "title": l.title, "server": l.server,
                 "database": l.database, "document": l.document,
                 "created_at": l.created_at.strftime("%Y-%m-%d %H:%M")}
                for l in items
            ],
        },
    }


@router.delete("/links/{link_id}")
def delete_link(link_id: int, db: Session = Depends(get_db),
                _: object = Depends(get_current_user)):
    link = db.get(NoteLink, link_id)
    if link:
        db.delete(link)
        db.commit()
    return {"success": True}
