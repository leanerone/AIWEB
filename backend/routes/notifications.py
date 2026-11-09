"""站内通知路由：评论/点赞事件投递 + 列表/已读。"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.models import Notification
from database.session import get_db
from routes.deps import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


def notify(db: Session, username: str, ntype: str, title: str,
           ref_type: str | None = None, ref_id: int | None = None,
           content: str = "") -> None:
    """投递一条通知；给自己产生的事件不投（用户名缺失同样跳过）"""
    if not username:
        return
    db.add(Notification(username=username, ntype=ntype, title=title[:250],
                        content=content[:500], ref_type=ref_type, ref_id=ref_id))


class ReadIn(BaseModel):
    ids: list[int] = []
    all: bool = False


@router.get("")
def list_notifications(page: int = 1, limit: int = 20,
                       db: Session = Depends(get_db), user: object = Depends(get_current_user)):
    query = db.query(Notification).filter(Notification.username == user.username)
    total = query.count()
    unread = query.filter(Notification.read.is_(False)).count()
    page = max(1, page)
    limit = max(1, min(limit, 100))
    items = (query.order_by(Notification.created_at.desc(), Notification.id.desc())
             .offset((page - 1) * limit).limit(limit).all())
    return {
        "success": True,
        "data": {
            "total": total, "unread": unread,
            "items": [
                {"id": n.id, "ntype": n.ntype, "title": n.title, "content": n.content,
                 "ref_type": n.ref_type, "ref_id": n.ref_id, "read": n.read,
                 "created_at": n.created_at.strftime("%Y-%m-%d %H:%M")}
                for n in items
            ],
        },
    }


@router.get("/unread-count")
def unread_count(db: Session = Depends(get_db), user: object = Depends(get_current_user)):
    """顶栏铃铛轮询用：未读数"""
    n = (db.query(Notification)
         .filter(Notification.username == user.username, Notification.read.is_(False))
         .count())
    return {"success": True, "data": {"unread": n}}


@router.post("/read")
def mark_read(body: ReadIn, db: Session = Depends(get_db),
              user: object = Depends(get_current_user)):
    """标记已读：指定 ids 或全部；只能操作自己的通知"""
    query = db.query(Notification).filter(
        Notification.username == user.username, Notification.read.is_(False))
    if body.all:
        query.update({"read": True}, synchronize_session=False)
    elif body.ids:
        query.filter(Notification.id.in_(body.ids)).update({"read": True}, synchronize_session=False)
    else:
        raise HTTPException(status_code=400, detail="请提供 ids 或 all=true")
    db.commit()
    return {"success": True}
