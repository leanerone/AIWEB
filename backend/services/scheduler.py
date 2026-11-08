"""RSS 定时自动刷新：守护线程每小时拉取一次启用的订阅源。"""
import logging
import threading
import time

logger = logging.getLogger("aiweb.scheduler")

INTERVAL_SECONDS = 3600


def _loop():
    while True:
        time.sleep(INTERVAL_SECONDS)
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


def start_scheduler():
    t = threading.Thread(target=_loop, name="rss-scheduler", daemon=True)
    t.start()
    logger.info("RSS 自动刷新线程已启动（每 %s 秒）", INTERVAL_SECONDS)
