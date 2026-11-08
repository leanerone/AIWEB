"""后台任务：RSS 每小时自动刷新 + SQLite 每日备份（保留最近 7 份）。"""
import logging
import shutil
import threading
import time
from datetime import datetime
from pathlib import Path

from config import settings

logger = logging.getLogger("aiweb.scheduler")

RSS_INTERVAL_SECONDS = 3600
BACKUP_INTERVAL_SECONDS = 86400
BACKUP_KEEP = 7


def _backup_dir() -> Path:
    d = Path(settings.DATABASE_URL.replace("sqlite:///", "")).parent / "backups"
    d.mkdir(parents=True, exist_ok=True)
    return d


def run_backup() -> str | None:
    """复制 SQLite 主库文件为带日期备份，保留最近 BACKUP_KEEP 份"""
    url = settings.DATABASE_URL
    if not url.startswith("sqlite"):
        return None
    src = Path(url.replace("sqlite:///", ""))
    if not src.exists():
        return None
    dest = _backup_dir() / f"aiweb-{datetime.now().strftime('%Y%m%d-%H%M')}.sqlite"
    shutil.copy2(src, dest)
    backups = sorted(_backup_dir().glob("aiweb-*.sqlite"))
    for old in backups[:-BACKUP_KEEP]:
        old.unlink(missing_ok=True)
    logger.info("已备份：%s", dest.name)
    return dest.name


def _loop():
    last_backup = 0.0
    while True:
        time.sleep(RSS_INTERVAL_SECONDS)
        try:
            from database.session import SessionLocal
            from services.rss_service import refresh_all

            db = SessionLocal()
            try:
                result = refresh_all(db)
                if result.get("new"):
                    logger.info("RSS 自动刷新：新增 %s 条", result["new"])
            finally:
                db.close()
        except Exception:
            logger.exception("RSS 自动刷新失败")

        # 备份节流：距上次超过 24h 才执行
        now = time.time()
        if now - last_backup >= BACKUP_INTERVAL_SECONDS:
            try:
                run_backup()
                last_backup = now
            except Exception:
                logger.exception("自动备份失败")


def start_scheduler():
    t = threading.Thread(target=_loop, name="aiweb-scheduler", daemon=True)
    t.start()
    logger.info("后台任务线程已启动（RSS 每 %s 秒 / 备份每 %s 秒）",
                RSS_INTERVAL_SECONDS, BACKUP_INTERVAL_SECONDS)
