"""一次性数据修复：合并大小写变体的重复用户（如 Administrator / administrator）。

用法：python scripts/dedupe_users.py          # 默认对 backend/data/aiweb.sqlite
把变体账号的数据引用改到规范账号（优先 role=admin 或纯小写者），删除重复行。
"""
import sqlite3
import sys
from pathlib import Path

DB = Path(__file__).resolve().parent.parent / "backend" / "data" / "aiweb.sqlite"

REF_TABLES = {  # 表名: 用户名列
    "resources": "created_by",
    "resource_comments": "created_by",
    "memos": "created_by",
    "note_links": "created_by",
    "chat_sessions": "created_by",
    "feed_cards": "created_by",
    "agent_runs": "username",
    "agent_tool_calls": "username",
    "bookmarks": "username",
    "notifications": "username",
    "user_ai_configs": "username",
}


def main() -> None:
    if not DB.exists():
        print("库不存在：", DB)
        sys.exit(1)
    con = sqlite3.connect(DB)
    users = con.execute("SELECT username, role FROM users").fetchall()
    groups: dict[str, list[tuple[str, str]]] = {}
    for username, role in users:
        groups.setdefault(username.lower(), []).append((username, role or "user"))

    merged = 0
    for lower, rows in groups.items():
        if len(rows) == 1:
            continue
        canonical = min(rows, key=lambda r: (r[1] != "admin", r[0] != lower, len(r[0])))
        variants = [r[0] for r in rows if r[0] != canonical[0]]
        print(f"合并 {variants} -> {canonical[0]}")
        for table, col in REF_TABLES.items():
            try:
                cur = con.execute(
                    f"UPDATE {table} SET {col}=? WHERE lower({col})=?",
                    (canonical[0], lower))
                if cur.rowcount:
                    print(f"  {table}.{col}: {cur.rowcount} 行")
            except sqlite3.IntegrityError:
                # 唯一约束（如 user_ai_configs.username）：规范账号已有行，删除变体行
                con.execute(f"DELETE FROM {table} WHERE lower({col})=?", (lower,))
                print(f"  {table}.{col}: 变体行已删除（唯一约束）")
            except sqlite3.OperationalError:
                pass  # 表不存在（旧库）
        marks = ",".join("?" * len(variants))
        dcur = con.execute(f"DELETE FROM users WHERE lower(username) IN ({marks})", 
                           [v.lower() for v in variants])
        if dcur.rowcount != len(variants):
            print(f"  ⚠ users 删除行数 {dcur.rowcount} != 预期 {len(variants)}，请检查")
            sys.exit(1)
        merged += len(variants)
    con.commit()
    con.close()
    print(f"完成：合并 {merged} 个重复账号")


if __name__ == "__main__":
    main()
