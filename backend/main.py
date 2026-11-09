"""AIWEB 后端入口：FastAPI 应用装配。"""
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from config import settings
from database.models import Base
from database.session import engine, SessionLocal

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    from database.session import ensure_schema_upgrade

    ensure_schema_upgrade()  # create_all 不给已有表加列，这里幂等补齐
    db = SessionLocal()
    try:
        from routes.auth import seed_users
        seed_users(db)
        try:
            from services import fts
            fts.rebuild(db)  # 全文索引全量重建（顺带自愈遗漏的增量同步）
        except Exception:
            logging.getLogger("aiweb").warning("FTS5 初始化失败，全文搜索将使用 LIKE 回落",
                                               exc_info=True)
    finally:
        db.close()
    logging.getLogger("aiweb").info("数据库就绪，默认账号已播种")
    import os

    if os.getenv("SEED_DEMO", "").strip() == "1":
        from seed_demo import seed_demo
        seed_demo()
    from services.scheduler import start_scheduler
    start_scheduler()
    yield


app = FastAPI(title="AIWEB - AI 分享平台", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",")],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routes import (agent, ai, admin, assistant, auth, bookmarks, chat, comments, feed, me,
                    memos, notes, notifications, resources, rss, search,
                    settings as settings_routes)  # noqa: E402

API = "/api"
app.include_router(auth.router, prefix=API)
app.include_router(me.router, prefix=API)
app.include_router(ai.router, prefix=API)
app.include_router(agent.router, prefix=API)
app.include_router(assistant.router, prefix=API)
app.include_router(admin.router, prefix=API)
app.include_router(resources.router, prefix=API)
app.include_router(comments.router, prefix=API)
app.include_router(memos.router, prefix=API)
app.include_router(notes.router, prefix=API)
app.include_router(chat.router, prefix=API)
app.include_router(rss.router, prefix=API)
app.include_router(feed.router, prefix=API)
app.include_router(settings_routes.router, prefix=API)
app.include_router(search.router, prefix=API)
app.include_router(bookmarks.router, prefix=API)
app.include_router(notifications.router, prefix=API)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "aiweb"}


# 生产模式：托管前端构建产物（backend/dist）
_DIST = Path(__file__).resolve().parent.parent / "dist"
if _DIST.exists():
    app.mount("/assets", StaticFiles(directory=_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        from fastapi import HTTPException

        # /api/* 兜底 404（避免吞掉未注册接口）；其余全部交给 SPA，根路径同样返回 index.html
        if full_path.startswith("api"):
            raise HTTPException(status_code=404, detail="Not Found")
        file = _DIST / full_path
        if full_path and file.is_file():
            return FileResponse(file)
        return FileResponse(_DIST / "index.html")
