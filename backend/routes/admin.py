"""管理路由：数据备份下载（仅管理员）。"""
from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse

from config import settings
from database.session import engine
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
