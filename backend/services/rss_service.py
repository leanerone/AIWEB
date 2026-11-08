"""RSS 抓取服务：feedparser 拉取订阅源，条目去重入库。"""
import logging
import re
from datetime import datetime, timezone

import feedparser
import requests

from database.models import RssItem, RssSource

logger = logging.getLogger("aiweb.rss")

_UA = {"User-Agent": "Mozilla/5.0 (compatible; AIWeb/1.0; +intranet)"}


def _strip_html(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text or "")
    return re.sub(r"\s+", " ", text).strip()


def _to_dt(entry) -> datetime | None:
    for attr in ("published_parsed", "updated_parsed"):
        st = getattr(entry, attr, None)
        if st:
            try:
                return datetime.fromtimestamp(
                    __import__("calendar").timegm(st), tz=timezone.utc
                ).replace(tzinfo=None)
            except Exception:
                pass
    return None


def refresh_source(source: RssSource, db) -> dict:
    """抓取单个源，返回 {fetched, new}"""
    try:
        resp = requests.get(source.url, headers=_UA, timeout=(8, 30))
        resp.raise_for_status()
    except requests.RequestException as e:
        logger.warning("RSS 抓取失败 %s: %s", source.url, e)
        return {"fetched": 0, "new": 0, "error": str(e)}

    feed = feedparser.parse(resp.content)
    existing_links = {
        i.link for i in db.query(RssItem).filter(RssItem.source_id == source.id).all()
    }
    added = 0
    for entry in feed.entries[:50]:
        link = getattr(entry, "link", "") or ""
        title = _strip_html(getattr(entry, "title", ""))[:500]
        if not title or (link and link in existing_links):
            continue
        item = RssItem(
            source_id=source.id,
            title=title,
            link=link,
            summary=_strip_html(getattr(entry, "summary", ""))[:1000],
            published_at=_to_dt(entry),
        )
        db.add(item)
        existing_links.add(link)
        added += 1
    source.last_fetch_at = datetime.now()
    db.commit()
    return {"fetched": len(feed.entries), "new": added}


def refresh_all(db) -> dict:
    total_new = 0
    results = {}
    for source in db.query(RssSource).filter(RssSource.enabled.is_(True)).all():
        r = refresh_source(source, db)
        results[source.name] = r
        total_new += r.get("new", 0)
    return {"new": total_new, "sources": results}
