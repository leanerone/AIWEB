from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from config.settings import DATABASE_URL

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)


@event.listens_for(engine, "connect")
def _fk_pragma(dbapi_conn, _record):
    """SQLite 默认不强制外键；启用后 ondelete=CASCADE 才真正生效（删源清条目等）"""
    if DATABASE_URL.startswith("sqlite"):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_schema_upgrade() -> None:
    """轻量列迁移：create_all 只建新表，不会给已有表加列。
    这里对后续版本新增的列做「缺则 ALTER」补齐（幂等）。"""

    additions: dict[str, list[tuple[str, str]]] = {
        "chat_messages": [("meta", "JSON")],
    }
    with engine.begin() as conn:
        for table, columns in additions.items():
            existing = {row[1] for row in conn.execute(
                text(f"PRAGMA table_info({table})")).fetchall()}
            if not existing:
                continue  # 表还不存在（全新库 create_all 会直接建全）
            for col, col_type in columns:
                if col not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                    print(f"[migrate] {table}.{col} 已补充")
