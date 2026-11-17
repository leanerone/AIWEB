"""管理路由：数据备份下载（仅管理员）。"""
from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from config import settings
from database.session import engine
from database.session import get_db
from routes.deps import require_admin

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/backup")
def backup(_: object = Depends(require_admin)):
    """下载 SQLite 数据库文件备份"""
    url = settings.DATABASE_URL
    if not url.startswith("sqlite"):
        return {"success": False, "message": "仅 SQLite 模式支持备份下载"}
    db_path = url.replace("sqlite:///", "")
    return FileResponse(db_path, filename="aiweb-backup.sqlite")


@router.post("/seed-content")
def admin_seed_content(db: Session = Depends(get_db), _: object = Depends(require_admin)):
    """管理员手动导入官方内容包（幂等，与 SEED_CONTENT=1 相同逻辑）"""
    from seed_content import seed_content

    seed_content()
    return {"success": True, "data": {"message": "官方内容包已导入"}}


@router.post("/verify/{resource_id}")
def admin_verify(resource_id: int, body: dict, db: Session = Depends(get_db),
                 _: object = Depends(require_admin)):
    """管理员审核公开的 MCP/Agent 资源:verified 标记(黄标/绿标)"""
    from database.models import Resource

    r = db.get(Resource, resource_id)
    if not r:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="资源不存在")
    r.verified = bool(body.get("verified", True))
    db.commit()
    return {"success": True, "data": {"id": r.id, "verified": r.verified}}
