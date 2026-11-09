"""资源评论路由。"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.models import Resource, ResourceComment
from database.session import get_db
from routes.deps import get_current_user
from routes.notifications import notify

router = APIRouter(prefix="/resources", tags=["comments"])


class CommentIn(BaseModel):
    content: str


@router.get("/{resource_id}/comments")
def list_comments(resource_id: int, db: Session = Depends(get_db),
                  _: object = Depends(get_current_user)):
    comments = (
        db.query(ResourceComment)
        .filter(ResourceComment.resource_id == resource_id)
        .order_by(ResourceComment.created_at.asc())
        .all()
    )
    return {
        "success": True,
        "data": [
            {"id": c.id, "content": c.content, "created_by": c.created_by,
             "created_at": c.created_at.strftime("%Y-%m-%d %H:%M")}
            for c in comments
        ],
    }


@router.post("/{resource_id}/comments")
def add_comment(resource_id: int, body: CommentIn, db: Session = Depends(get_db),
                user: object = Depends(get_current_user)):
    content = (body.content or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="评论不能为空")
    r = db.get(Resource, resource_id)
    if not r:
        raise HTTPException(status_code=404, detail="资源不存在")
    c = ResourceComment(resource_id=resource_id, content=content[:2000], created_by=user.username)
    db.add(c)
    if r.created_by and r.created_by != user.username:  # 通知资源创建者（不通知自己）
        notify(db, r.created_by, "comment",
               f"{user.display_name or user.username} 评论了你的资源「{r.name}」",
               ref_type="resource", ref_id=r.id, content=content[:100])
    db.commit()
    db.refresh(c)
    return {"success": True, "data": {"id": c.id, "content": c.content,
            "created_by": c.created_by, "created_at": c.created_at.strftime("%Y-%m-%d %H:%M")}}


@router.delete("/comments/{comment_id}")
def delete_comment(comment_id: int, db: Session = Depends(get_db),
                   user: object = Depends(get_current_user)):
    c = db.get(ResourceComment, comment_id)
    if not c:
        raise HTTPException(status_code=404, detail="评论不存在")
    if user.role != "admin" and c.created_by != user.username:
        raise HTTPException(status_code=403, detail="只能删除自己的评论")
    db.delete(c)
    db.commit()
    return {"success": True}
