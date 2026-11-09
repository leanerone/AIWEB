"""SQLite FTS5 全文索引：资源 / 笔记 / RSS 统一全文检索。

设计要点：
- 采用应用层同步（路由增删改后调用 index_*/deindex_*）+ 启动时全量重建，
  不依赖触发器；即使某次同步遗漏，重启后重建也能自愈。
- 普通模式 FTS5 表（文本随索引存储，DELETE 直接生效）。external-content
  模式虽然省空间，但按 rowid 删除需要精确回放原始列值，一旦不同步就报
  「database disk image is malformed」，内网数据量下省这点空间不值得。
- unicode61 分词器下连续中文只有一个 token，无法子串检索。这里对索引与
  查询两侧统一做「CJK 逐字空格切分 + 短语匹配」，2 个字的中文查询也能命中。
- SQLite 版本过旧无 FTS5 时，自动回落 LIKE 搜索（available() 探测）。
"""
import logging
import re

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger("aiweb.fts")

# CJK 汉字 / 假名 / 谚文
_CJK = re.compile(r"([\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af])")

_FTS_DDL = [
    """CREATE VIRTUAL TABLE IF NOT EXISTS fts_resources USING fts5(
        name, summary, content, tags)""",
    """CREATE VIRTUAL TABLE IF NOT EXISTS fts_memos USING fts5(
        title, content, tags)""",
    """CREATE VIRTUAL TABLE IF NOT EXISTS fts_rss USING fts5(
        title, summary)""",
]

_SQL_INSERT = {
    "fts_resources": "INSERT INTO fts_resources(rowid, name, summary, content, tags) "
                     "VALUES (:id, :a, :b, :c, :d)",
    "fts_memos": "INSERT INTO fts_memos(rowid, title, content, tags) "
                 "VALUES (:id, :a, :b, :d)",
    "fts_rss": "INSERT INTO fts_rss(rowid, title, summary) "
               "VALUES (:id, :a, :b)",
}


def normalize(s: str) -> str:
    """CJK 逐字之间插入空格并转小写，使每个汉字成为独立 token"""
    if not s:
        return ""
    return _CJK.sub(r"\1 ", str(s)).lower()


def phrase_query(q: str) -> str:
    """兼容保留：整串短语匹配（严格模式）"""
    norm = normalize(q).strip()
    if not norm:
        return ""
    return '"' + norm.replace('"', " ") + '"'


def search_query(q: str) -> str:
    """构造 FTS5 查询：ASCII 词精确匹配；连续中文拆成相邻二元组，组间 OR。

    长中文短语（如「协议帧格式是什么」）在索引里几乎不可能整体相邻，
    二元组 OR 兼顾召回与相关度（bm25 对命中多的文档排名靠前）。
    """
    norm = normalize(q).strip()
    if not norm:
        return ""
    clauses: list[str] = []
    run: list[str] = []

    def esc(t: str) -> str:
        return '"' + t.replace('"', " ").strip() + '"'

    def flush_run():
        nonlocal run
        if not run:
            return
        if len(run) == 1:
            clauses.append(esc(run[0]))
        else:
            for i in range(len(run) - 1):
                clauses.append(esc(f"{run[i]} {run[i + 1]}"))
        run = []

    for token in norm.split():
        if len(token) == 1 and _CJK.fullmatch(token):
            run.append(token)
        elif re.search(r"[\w\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]", token):
            flush_run()
            clauses.append(esc(token))
        # 纯标点 token 跳过（否则空短语会让 FTS5 报语法错）
    flush_run()
    return " OR ".join(dict.fromkeys(clauses))  # 去重且保序


def available(db: Session) -> bool:
    try:
        db.execute(text("SELECT 1 FROM pragma_module_list('fts5')"))
        return True
    except Exception:
        return False


def ensure_schema(db: Session):
    for ddl in _FTS_DDL:
        db.execute(text(ddl))


def _index_row(db: Session, table: str, rowid: int, *fields: str):
    params = {"id": rowid}
    keys = {"fts_resources": ("a", "b", "c", "d"),
            "fts_memos": ("a", "b", "d"),
            "fts_rss": ("a", "b")}[table]
    for key, value in zip(keys, fields):
        params[key] = normalize(value)
    db.execute(text(f"DELETE FROM {table} WHERE rowid=:id"), {"id": rowid})
    db.execute(text(_SQL_INSERT[table]), params)


def index_resource(db: Session, r) -> None:
    _index_row(db, "fts_resources", r.id, r.name, r.summary, r.content or "",
               " ".join(r.tags or []))


def deindex_resource(db: Session, rid: int) -> None:
    db.execute(text("DELETE FROM fts_resources WHERE rowid=:id"), {"id": rid})


def index_memo(db: Session, m) -> None:
    _index_row(db, "fts_memos", m.id, m.title, m.content or "", " ".join(m.tags or []))


def deindex_memo(db: Session, mid: int) -> None:
    db.execute(text("DELETE FROM fts_memos WHERE rowid=:id"), {"id": mid})


def index_rss_item(db: Session, i) -> None:
    _index_row(db, "fts_rss", i.id, i.title, i.summary or "")


def deindex_rss_item(db: Session, iid: int) -> None:
    db.execute(text("DELETE FROM fts_rss WHERE rowid=:id"), {"id": iid})


def rebuild(db: Session) -> None:
    """全量重建（启动时调用，内网数据量毫秒级；顺带自愈遗漏的增量同步）"""
    ensure_schema(db)
    for t in ("fts_resources", "fts_memos", "fts_rss"):
        db.execute(text(f"DELETE FROM {t}"))
    for rid, name, summary, content, tags in db.execute(text(
            "SELECT id, name, summary, content, COALESCE(tags,'[]') FROM resources")):
        _index_row(db, "fts_resources", rid, name or "", summary or "", content or "", tags or "")
    for mid, title, content, tags in db.execute(text(
            "SELECT id, title, content, COALESCE(tags,'[]') FROM memos")):
        _index_row(db, "fts_memos", mid, title or "", content or "", tags or "")
    for iid, title, summary in db.execute(text("SELECT id, title, summary FROM rss_items")):
        _index_row(db, "fts_rss", iid, title or "", summary or "")
    db.commit()
    logger.info("FTS5 全文索引已重建")


def search(db: Session, q: str, limit: int = 20) -> list[dict]:
    """统一全文检索，按 bm25 相关度混排返回 resource / memo / rss"""
    match = search_query(q)
    if not match:
        return []
    limit = max(1, min(limit, 50))
    items: list[dict] = []

    rows = db.execute(text(
        "SELECT rowid, bm25(fts_resources) AS rank, "
        "snippet(fts_resources, -1, '', '', '…', 14) AS snip "
        "FROM fts_resources WHERE fts_resources MATCH :q ORDER BY rank LIMIT :lim"),
        {"q": match, "lim": limit}).all()
    for rid, _rank, snip in rows:
        r = db.get(_model_lazy("Resource"), int(rid))
        if r:
            items.append({"kind": "resource", "id": r.id, "title": r.name,
                          "snippet": (snip or r.summary or "")[:160],
                          "created_by": r.created_by,
                          "created_at": r.created_at.strftime("%Y-%m-%d %H:%M")})

    rows = db.execute(text(
        "SELECT rowid, bm25(fts_memos) AS rank, "
        "snippet(fts_memos, -1, '', '', '…', 14) AS snip "
        "FROM fts_memos WHERE fts_memos MATCH :q ORDER BY rank LIMIT :lim"),
        {"q": match, "lim": limit}).all()
    for mid, _rank, snip in rows:
        m = db.get(_model_lazy("Memo"), int(mid))
        if m:
            items.append({"kind": "memo", "id": m.id, "title": m.title,
                          "snippet": (snip or "")[:160],
                          "created_by": m.created_by,
                          "created_at": m.updated_at.strftime("%Y-%m-%d %H:%M")})

    rows = db.execute(text(
        "SELECT rowid, bm25(fts_rss) AS rank, "
        "snippet(fts_rss, -1, '', '', '…', 14) AS snip "
        "FROM fts_rss WHERE fts_rss MATCH :q ORDER BY rank LIMIT :lim"),
        {"q": match, "lim": limit}).all()
    for iid, _rank, snip in rows:
        i = db.get(_model_lazy("RssItem"), int(iid))
        if i:
            items.append({"kind": "rss", "id": i.id, "title": i.title,
                          "snippet": (snip or i.summary or "")[:160],
                          "created_by": i.source.name if i.source else "RSS",
                          "created_at": (i.published_at or i.created_at).strftime("%Y-%m-%d %H:%M")})

    items.sort(key=lambda x: x["created_at"], reverse=True)
    return items[:limit]


def _model_lazy(name: str):
    from database import models
    return getattr(models, name)
