"""后台任务：RSS 每小时自动刷新（启动即刷一次）+ SQLite 每日备份（保留最近 7 份）。"""
import logging
import sqlite3
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
    """用 sqlite3 backup API 在线备份主库（避免复制到写一半的文件导致备份损坏）"""
    url = settings.DATABASE_URL
    if not url.startswith("sqlite"):
        return None
    src = Path(url.replace("sqlite:///", ""))
    if not src.exists():
        return None
    dest = _backup_dir() / f"aiweb-{datetime.now().strftime('%Y%m%d-%H%M')}.sqlite"
    scon = sqlite3.connect(src)
    dcon = sqlite3.connect(dest)
    try:
        with dcon:
            scon.backup(dcon)
    finally:
        scon.close()
        dcon.close()
    backups = sorted(_backup_dir().glob("aiweb-*.sqlite"))
    for old in backups[:-BACKUP_KEEP]:
        old.unlink(missing_ok=True)
    logger.info("已备份：%s", dest.name)
    return dest.name


def _maybe_auto_briefing(db) -> None:
    """每天 AI_BRIEFING_HOUR 点后自动生成简报卡（当天已有则跳过）"""
    if settings.AI_BRIEFING_HOUR < 0:
        return
    now = datetime.now()
    if now.hour < settings.AI_BRIEFING_HOUR:
        return
    from database.models import FeedCard

    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    has_today = (db.query(FeedCard)
                 .filter(FeedCard.ref_type == "briefing", FeedCard.created_at >= day_start)
                 .count())
    if has_today:
        return
    try:
        from services.briefing import build_briefing
        card = build_briefing(db, created_by="system")
        logger.info("自动简报已生成：%s", card["title"])
    except Exception as e:
        logger.warning("自动简报未生成（AI 未配置 / RSS 为空 / 调用失败）：%s", e)


def _loop():
    last_backup = time.time()  # 首次自动备份在启动 24h 后；此前可用管理端手动备份
    while True:
        try:
            from database.session import SessionLocal
            from services.rss_service import refresh_all

            db = SessionLocal()
            try:
                result = refresh_all(db)
                if result.get("new"):
                    logger.info("RSS 自动刷新：新增 %s 条", result["new"])
                _maybe_auto_briefing(db)
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

        time.sleep(RSS_INTERVAL_SECONDS)


def start_scheduler():
    if not settings.ENABLE_SCHEDULER:
        logger.info("后台任务线程已禁用（ENABLE_SCHEDULER=0）")
        return
    # 启动即先刷一次 RSS，不必等第一个小时
    t = threading.Thread(target=_loop, name="aiweb-scheduler", daemon=True)
    t.start()
    logger.info("后台任务线程已启动（RSS 立即刷新后每 %s 秒 / 备份每 %s 秒）",
                RSS_INTERVAL_SECONDS, BACKUP_INTERVAL_SECONDS)
