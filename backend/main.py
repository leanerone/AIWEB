"""AIWEB 后端入口：FastAPI 应用装配。"""
import logging
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

app = FastAPI(title="AIWEB - AI 分享平台", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",")],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routes import auth, chat, feed, memos, notes, resources, rss, settings as settings_routes  # noqa: E402

API = "/api"
app.include_router(auth.router, prefix=API)
app.include_router(resources.router, prefix=API)
app.include_router(memos.router, prefix=API)
app.include_router(notes.router, prefix=API)
app.include_router(chat.router, prefix=API)
app.include_router(rss.router, prefix=API)
app.include_router(feed.router, prefix=API)
app.include_router(settings_routes.router, prefix=API)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "aiweb"}


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        from routes.auth import seed_users
        seed_users(db)
    finally:
        db.close()
    logging.getLogger("aiweb").info("数据库就绪，默认账号已播种")


# 生产模式：托管前端构建产物（backend/dist）
_DIST = Path(__file__).resolve().parent.parent / "dist"
if _DIST.exists():
    app.mount("/assets", StaticFiles(directory=_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        file = _DIST / full_path
        if full_path and file.is_file():
            return FileResponse(file)
        return FileResponse(_DIST / "index.html")
