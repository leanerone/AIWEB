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
from database.models import Bookmark, Resource
from database.session import get_db
from routes.deps import get_current_user
from routes.notifications import notify
from services import fts
from services.skill_meta import extract_from_upload

router = APIRouter(prefix="/resources", tags=["resources"])

ALLOWED_TYPES = {"skill", "tool", "plugin"}
MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20MB
# 上传白名单：只允许文档/数据/文本/脚本/归档类（v0.9.22 由黑名单升级，防未知可执行格式）
ALLOWED_EXTS = {
    # 文档
    ".md", ".txt", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".ppt", ".pptx",
    ".json", ".xml", ".yml", ".yaml", ".ini", ".log",
    # 图片（不含 svg：内联脚本风险）
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".bmp",
    # 脚本/代码
    ".py", ".sh", ".bat", ".ps1", ".sql", ".html", ".css", ".ts", ".tsx", ".jsm", ".lua",
    # 归档
    ".zip", ".7z", ".gz", ".tar",
}


class ResourceIn(BaseModel):
    type: str
    name: str
    summary: str = ""
    content: str = ""
    tags: list[str] = []
    author: str = ""
    source_type: str = "none"
    external_url: str | None = None


def _safe_external_url(url: str | None) -> str | None:
    """外链只允许 http(s)，防 javascript: 注入"""
    if not url:
        return None
    url = url.strip()
    if url.lower().startswith(("http://", "https://")):
        return url
    return None


@router.get("")
def list_resources(
    keyword: str = "",
    type: str = "",
    tag: str = "",
    order: str = "new",
    liked: int = 0,
    created_by: str = "",
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
    if created_by:
        query = query.filter(Resource.created_by == created_by)
    if keyword:
        like = f"%{keyword}%"
        query = query.filter(or_(Resource.name.like(like), Resource.summary.like(like),
                                 Resource.content.like(like)))
    if tag:
        query = query.filter(Resource.tags.contains(tag))
    total = query.count()
    limit = max(1, min(limit, 200))
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
    # 当前用户在本页资源上的收藏状态（一次批量查询，避免 N+1）
    marked: set[int] = set()
    if items:
        marked = {b.target_id for b in db.query(Bookmark)
                  .filter(Bookmark.username == user.username,
                          Bookmark.target_type == "resource",
                          Bookmark.target_id.in_([r.id for r in items])).all()}
    return {
        "success": True,
        "data": {"total": total,
                 "items": [_serialize(r, user.username, r.id in marked) for r in items]},
    }


def _serialize(r: Resource, viewer: str | None = None, bookmarked: bool = False) -> dict:
    return {
        "id": r.id, "type": r.type, "name": r.name, "summary": r.summary,
        "content": r.content, "tags": r.tags or [], "author": r.author,
        "source_type": r.source_type, "file_name": r.file_name,
        "external_url": r.external_url, "downloads": r.downloads,
        "views": r.views, "likes": r.likes,
        "liked_by_me": bool(viewer and viewer in (r.liked_by or [])),
        "bookmarked_by_me": bool(bookmarked),
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
        r.external_url = _safe_external_url(external_url)
        if r.external_url:
            r.source_type = "url"
    if file is not None:
        # 安全限制：大小 + 可执行扩展名黑名单
        ext = Path(file.filename or "").suffix.lower()
        if ext not in ALLOWED_EXTS:
            allowed_preview = ", ".join(sorted(ALLOWED_EXTS)[:10])
            raise HTTPException(
                status_code=400,
                detail=f"不允许上传 {ext or '无扩展名'} 类文件（白名单制，常见：{allowed_preview}…）")
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

    fts.index_resource(db, r)  # 全文索引同步
    db.commit()
    return {"success": True, "data": _serialize(r, user.username)}


@router.get("/{resource_id}")
def get_resource(resource_id: int, db: Session = Depends(get_db),
                 user: object = Depends(get_current_user)):
    r = db.get(Resource, resource_id)
    if not r:
        raise HTTPException(status_code=404, detail="资源不存在")
    r.views += 1
    bookmarked = bool(db.query(Bookmark)
                      .filter(Bookmark.username == user.username,
                              Bookmark.target_type == "resource",
                              Bookmark.target_id == resource_id).first())
    db.commit()
    return {"success": True, "data": _serialize(r, user.username, bookmarked)}


@router.post("/{resource_id}/like")
def like_resource(resource_id: int, db: Session = Depends(get_db),
                  user: object = Depends(get_current_user)):
    """点赞 / 取消点赞（按用户去重）；点赞时通知资源创建者"""
    r = db.get(Resource, resource_id)
    if not r:
        raise HTTPException(status_code=404, detail="资源不存在")
    liked_by = list(r.liked_by or [])
    turning_on = user.username not in liked_by
    if turning_on:
        liked_by.append(user.username)
    else:
        liked_by.remove(user.username)
    r.liked_by = liked_by
    r.likes = len(liked_by)
    if turning_on and r.created_by and r.created_by != user.username:
        notify(db, r.created_by, "like",
               f"{user.display_name or user.username} 赞了你的资源「{r.name}」",
               ref_type="resource", ref_id=r.id)
    db.commit()
    return {"success": True, "data": {"likes": r.likes, "liked_by_me": user.username in liked_by}}


@router.put("/{resource_id}")
def update_resource(resource_id: int, body: ResourceIn,
                    db: Session = Depends(get_db), user: object = Depends(get_current_user)):
    r = db.get(Resource, resource_id)
    if not r:
        raise HTTPException(status_code=404, detail="资源不存在")
    old_summary, old_content = r.summary, r.content
    # 更新前快照旧状态（版本历史）
    from database.models import ResourceVersion

    db.add(ResourceVersion(resource_id=r.id, name=r.name, summary=r.summary,
                           content=r.content, tags=r.tags or [], file_name=r.file_name,
                           external_url=r.external_url, updated_by=user.username))
    if body.type in ALLOWED_TYPES:
        r.type = body.type
    r.name = body.name.strip() or r.name
    r.summary = body.summary
    r.content = body.content
    r.tags = body.tags
    r.author = body.author
    if body.external_url:
        safe = _safe_external_url(body.external_url)
        if safe:
            r.external_url = safe
            if r.source_type != "upload":
                r.source_type = "url"
    db.commit()
    fts.index_resource(db, r)  # 全文索引同步
    db.commit()
    # 通知收藏过/点赞过的用户（更新者本人除外），内容实质变化才通知
    if body.summary != old_summary or body.content != old_content:
        watchers: set[str] = set()
        for b in db.query(Bookmark).filter(Bookmark.target_type == "resource",
                                           Bookmark.target_id == r.id).all():
            watchers.add(b.username)
        watchers.update(r.liked_by or [])
        watchers.discard(user.username)
        from routes.notifications import notify

        for name in list(watchers)[:50]:  # 上限保护，避免大范围刷屏
            notify(db, name, "system",
                   f"你关注的资源「{r.name}」有更新",
                   ref_type="resource", ref_id=r.id)
        db.commit()
    return {"success": True, "data": _serialize(r, user.username)}


@router.delete("/{resource_id}")
def delete_resource(resource_id: int, db: Session = Depends(get_db),
                    user: object = Depends(get_current_user)):
    r = db.get(Resource, resource_id)
    if not r:
        raise HTTPException(status_code=404, detail="资源不存在")
    if user.role != "admin" and r.created_by != user.username:
        raise HTTPException(status_code=403, detail="只能删除自己上传的资源")
    if r.file_path:
        p = Path(settings.UPLOAD_DIR) / r.file_path
        if p.exists():
            p.unlink(missing_ok=True)
    fts.deindex_resource(db, resource_id)  # 全文索引同步
    db.delete(r)
    db.commit()
    return {"success": True}


@router.get("/{resource_id}/download")
def download_resource(resource_id: int, db: Session = Depends(get_db),
                      _: object = Depends(get_current_user)):
    r = db.get(Resource, resource_id)
    if not r or not r.file_path:
        raise HTTPException(status_code=404, detail="该资源没有附件")
    path = Path(settings.UPLOAD_DIR) / r.file_path
    if not path.exists():
        raise HTTPException(status_code=404, detail="附件文件丢失")
    r.downloads += 1
    db.commit()
    return FileResponse(path, filename=r.file_name or path.name)


@router.get("/{resource_id}/versions")
def list_versions(resource_id: int, db: Session = Depends(get_db),
                  user: object = Depends(get_current_user)):
    """资源历史版本（最新在前，最多 20 条）"""
    from database.models import ResourceVersion

    r = db.get(Resource, resource_id)
    if not r:
        raise HTTPException(status_code=404, detail="资源不存在")
    rows = (db.query(ResourceVersion)
            .filter(ResourceVersion.resource_id == resource_id)
            .order_by(ResourceVersion.id.desc())
            .limit(20).all())
    return {"success": True, "data": [
        {"id": v.id, "name": v.name, "summary": v.summary,
         "tags": v.tags or [], "file_name": v.file_name,
         "updated_by": v.updated_by,
         "created_at": v.created_at.strftime("%Y-%m-%d %H:%M")}
        for v in rows]}


@router.post("/{resource_id}/restore/{version_id}")
def restore_version(resource_id: int, version_id: int, db: Session = Depends(get_db),
                    user: object = Depends(get_current_user)):
    """回滚到指定版本：先快照当前状态，再套用历史版本字段"""
    from database.models import ResourceVersion

    r = db.get(Resource, resource_id)
    if not r:
        raise HTTPException(status_code=404, detail="资源不存在")
    if user.role != "admin" and r.created_by != user.username:
        raise HTTPException(status_code=403, detail="只能回滚自己的资源")
    v = db.get(ResourceVersion, version_id)
    if not v or v.resource_id != resource_id:
        raise HTTPException(status_code=404, detail="版本不存在")
    # 回滚前也快照当前状态（可再滚回来）
    db.add(ResourceVersion(resource_id=r.id, name=r.name, summary=r.summary,
                           content=r.content, tags=r.tags or [], file_name=r.file_name,
                           external_url=r.external_url, updated_by=user.username))
    r.name = v.name
    r.summary = v.summary
    r.content = v.content
    r.tags = v.tags
    r.file_name = v.file_name
    if v.external_url:
        r.external_url = v.external_url
    db.commit()
    fts.index_resource(db, r)
    db.commit()
    return {"success": True, "data": _serialize(r, user.username)}
