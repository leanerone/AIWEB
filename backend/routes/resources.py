"""资源库路由：skill / tool / plugin 统一管理，支持 zip 上传与下载。"""
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from config import settings
from database.models import Resource
from database.session import get_db
from routes.deps import get_current_user
from services.skill_meta import extract_from_upload

router = APIRouter(prefix="/resources", tags=["resources"])

ALLOWED_TYPES = {"skill", "tool", "plugin"}
MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20MB
BLOCKED_EXTS = {".exe", ".msi", ".scr", ".com", ".pif", ".cpl", ".js", ".vbs"}


class ResourceIn(BaseModel):
    type: str
    name: str
    summary: str = ""
    content: str = ""
    tags: list[str] = []
    author: str = ""
    source_type: str = "none"
    external_url: str | None = None


@router.get("")
def list_resources(
    keyword: str = "",
    type: str = "",
    tag: str = "",
    order: str = "new",
    liked: int = 0,
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db),
    user: object = Depends(get_current_user),
):
    query = db.query(Resource)
    if type in ALLOWED_TYPES:
        query = query.filter(Resource.type == type)
    if liked:
        query = query.filter(Resource.liked_by.contains(user.username))
    if keyword:
        like = f"%{keyword}%"
        query = query.filter(or_(Resource.name.like(like), Resource.summary.like(like),
                                 Resource.content.like(like)))
    if tag:
        query = query.filter(Resource.tags.contains(tag))
    total = query.count()
    order_map = {
        "new": Resource.created_at.desc(),
        "downloads": Resource.downloads.desc(),
        "likes": Resource.likes.desc(),
        "views": Resource.views.desc(),
    }
    items = (
        query.order_by(order_map.get(order, order_map["new"]))
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return {
        "success": True,
        "data": {"total": total, "items": [_serialize(r, user.username) for r in items]},
    }


def _serialize(r: Resource, viewer: str | None = None) -> dict:
    return {
        "id": r.id, "type": r.type, "name": r.name, "summary": r.summary,
        "content": r.content, "tags": r.tags or [], "author": r.author,
        "source_type": r.source_type, "file_name": r.file_name,
        "external_url": r.external_url, "downloads": r.downloads,
        "views": r.views, "likes": r.likes,
        "liked_by_me": bool(viewer and viewer in (r.liked_by or [])),
        "created_by": r.created_by,
        "created_at": r.created_at.strftime("%Y-%m-%d %H:%M"),
        "updated_at": r.updated_at.strftime("%Y-%m-%d %H:%M"),
    }


@router.post("")
async def create_resource(
    type: str = Form(...),
    name: str = Form(""),
    summary: str = Form(""),
    content: str = Form(""),
    tags: str = Form(""),
    author: str = Form(""),
    external_url: str = Form(""),
    file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    user: object = Depends(get_current_user),
):
    if type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="类型必须是 skill/tool/plugin")
    tag_list = [t.strip() for t in tags.replace("，", ",").split(",") if t.strip()]
    r = Resource(
        type=type, name=name.strip(), summary=summary, content=content,
        tags=tag_list, author=author, created_by=user.username,
    )
    if external_url:
        r.external_url = external_url
        r.source_type = "url"
    if file is not None:
        # 安全限制：大小 + 可执行扩展名黑名单
        ext = Path(file.filename or "").suffix.lower()
        if ext in BLOCKED_EXTS:
            raise HTTPException(status_code=400, detail=f"不允许上传 {ext} 类文件")
        file.file.seek(0, 2)
        size = file.file.tell()
        file.file.seek(0)
        if size > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=400, detail="附件超过 20MB 限制")
        r.source_type = "upload"
        r.file_name = file.filename
        if not r.name:
            r.name = Path(file.filename).stem  # 先用文件名占位，稍后被 frontmatter 覆盖
    if not r.name:
        raise HTTPException(status_code=400, detail="名称不能为空（或选择可解析的附件）")
    db.add(r)
    db.commit()
    db.refresh(r)

    if file is not None:
        dest_dir = Path(settings.UPLOAD_DIR) / str(r.id)
        dest_dir.mkdir(parents=True, exist_ok=True)
        safe_name = f"{uuid.uuid4().hex[:8]}_{Path(file.filename).name}"
        with open(dest_dir / safe_name, "wb") as f:
            shutil.copyfileobj(file.file, f)
        rel_path = str((dest_dir / safe_name).relative_to(settings.UPLOAD_DIR))
        r.file_path = rel_path

        # SKILL.md / README frontmatter 自动填充
        meta = extract_from_upload(Path(settings.UPLOAD_DIR) / rel_path)
        if meta["name"]:
            r.name = meta["name"]
        if meta["description"] and not r.summary:
            r.summary = meta["description"]
        if meta["description"] and not r.content:
            r.content = f"> 自动提取自 {r.file_name}\n\n{meta['description']}"
        if meta["tags"] and not tag_list:
            r.tags = meta["tags"]
        db.commit()
    return {"success": True, "data": _serialize(r, user.username)}


@router.get("/{resource_id}")
def get_resource(resource_id: int, db: Session = Depends(get_db),
                 user: object = Depends(get_current_user)):
    r = db.query(Resource).get(resource_id)
    if not r:
        raise HTTPException(status_code=404, detail="资源不存在")
    r.views += 1
    db.commit()
    return {"success": True, "data": _serialize(r, user.username)}


@router.post("/{resource_id}/like")
def like_resource(resource_id: int, db: Session = Depends(get_db),
                  user: object = Depends(get_current_user)):
    """点赞 / 取消点赞（按用户去重）"""
    r = db.query(Resource).get(resource_id)
    if not r:
        raise HTTPException(status_code=404, detail="资源不存在")
    liked_by = list(r.liked_by or [])
    if user.username in liked_by:
        liked_by.remove(user.username)
    else:
        liked_by.append(user.username)
    r.liked_by = liked_by
    r.likes = len(liked_by)
    db.commit()
    return {"success": True, "data": {"likes": r.likes, "liked_by_me": user.username in liked_by}}


@router.put("/{resource_id}")
def update_resource(resource_id: int, body: ResourceIn,
                    db: Session = Depends(get_db), user: object = Depends(get_current_user)):
    r = db.query(Resource).get(resource_id)
    if not r:
        raise HTTPException(status_code=404, detail="资源不存在")
    if body.type in ALLOWED_TYPES:
        r.type = body.type
    r.name = body.name.strip() or r.name
    r.summary = body.summary
    r.content = body.content
    r.tags = body.tags
    r.author = body.author
    if body.external_url:
        r.external_url = body.external_url
        if r.source_type != "upload":
            r.source_type = "url"
    db.commit()
    return {"success": True, "data": _serialize(r, user.username)}


@router.delete("/{resource_id}")
def delete_resource(resource_id: int, db: Session = Depends(get_db),
                    user: object = Depends(get_current_user)):
    r = db.query(Resource).get(resource_id)
    if not r:
        raise HTTPException(status_code=404, detail="资源不存在")
    if user.role != "admin" and r.created_by != user.username:
        raise HTTPException(status_code=403, detail="只能删除自己上传的资源")
    if r.file_path:
        p = Path(settings.UPLOAD_DIR) / r.file_path
        if p.exists():
            p.unlink(missing_ok=True)
    db.delete(r)
    db.commit()
    return {"success": True}


@router.get("/{resource_id}/download")
def download_resource(resource_id: int, db: Session = Depends(get_db),
                      _: object = Depends(get_current_user)):
    r = db.query(Resource).get(resource_id)
    if not r or not r.file_path:
        raise HTTPException(status_code=404, detail="该资源没有附件")
    path = Path(settings.UPLOAD_DIR) / r.file_path
    if not path.exists():
        raise HTTPException(status_code=404, detail="附件文件丢失")
    r.downloads += 1
    db.commit()
    return FileResponse(path, filename=r.file_name or path.name)
