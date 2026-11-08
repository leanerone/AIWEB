"""HCL Notes 链接解析服务

支持三类常见格式（粘贴即可识别）：
1. 纯 notes:// URL        notes://Server/C1257E6A/0A1B.../3C4D...?OpenDocument
2. Notes 客户端"复制文档链接"的 NDL 格式（含 <REPLICA>/<VIEW>/<NOTE>/<HINT>/<REM> 标签）
3. 富文本/网页里的 <a href="notes://...">标题</a> 形式

解析结果用于前端信息卡展示 + notes:// 协议一键唤起本机 Notes 客户端。
"""
import re


_HEX32 = re.compile(r"^[0-9A-Fa-f]{32}$")
_HEX_OD = re.compile(r"^(?:OF|ON)?[0-9A-Fa-f]{16,}(?:ON[0-9A-Fa-f:]+)?$", re.IGNORECASE)


def _clean_unid(value: str) -> str:
    """从 OFxxxxONyyyy:zzzz 形式中提取 UNID 部分"""
    value = value.strip()
    m = re.match(r"^(?:OF)?([0-9A-Fa-f]{16,})(?:ON.*)?$", value, re.IGNORECASE)
    return m.group(1) if m else value


def parse_notes_url(text: str) -> dict:
    text = (text or "").strip()
    result = {
        "valid": False,
        "url": "",
        "title": "",
        "server": "",
        "database": "",
        "view": "",
        "document": "",
        "replica_id": "",
        "view_id": "",
        "note_id": "",
        "raw_text": text,
    }
    if not text:
        return result

    # ── 1) NDL 块 ─────────────────────────────────────────────
    ndl_m = re.search(r"<NDL>(.*?)</NDL>", text, re.DOTALL | re.IGNORECASE)
    if ndl_m:
        ndl = ndl_m.group(1)
        result["title"] = text[: ndl_m.start()].strip().lstrip("<>").strip()

        m = re.search(r"<REPLICA\s+([0-9A-Fa-f:]+)\s*>", ndl)
        if m:
            result["replica_id"] = m.group(1)
        m = re.search(r"<VIEW\s+([^>]+)>", ndl)
        if m:
            result["view_id"] = _clean_unid(m.group(1))
        m = re.search(r"<NOTE\s+([^>]+)>", ndl)
        if m:
            result["note_id"] = _clean_unid(m.group(1))
        m = re.search(r"<HINT>(.*?)</HINT>", ndl, re.DOTALL | re.IGNORECASE)
        if m:
            result["server"] = m.group(1).strip()
        rem = re.search(r"<REM>(.*?)</REM>", ndl, re.DOTALL | re.IGNORECASE)
        if rem:
            rem_text = rem.group(1)
            for key, field in (("Database", "database"), ("View", "view"), ("Document", "document")):
                fm = re.search(rf"{key}\s*'([^']*)'", rem_text)
                if fm and fm.group(1):
                    result[field] = fm.group(1).strip()

        if result["server"] and result["database"]:
            db = result["database"]
            path = db if db.lower().endswith(".nsf") else f"{db}.nsf"
            tail = ""
            if result["note_id"]:
                tail = f"/{result['view_id']}/{result['note_id']}" if result["view_id"] else f"/0/{result['note_id']}"
            result["url"] = f"notes://{result['server']}/{path}{tail}"
        elif result["replica_id"]:
            replica = result["replica_id"].replace(":", "")
            result["url"] = f"notes://{result['server']}/__{replica}.nsf"

    # ── 2) <a href="notes://..."> 标题 </a> ────────────────────
    if not result["url"]:
        a_m = re.search(r'<a[^>]+href\s*=\s*["\'](notes://[^"\']+)["\'][^>]*>(.*?)</a>', text, re.IGNORECASE | re.DOTALL)
        if a_m:
            result["url"] = a_m.group(1)
            result["title"] = re.sub(r"<[^>]+>", "", a_m.group(2)).strip()

    # ── 3) 任意位置的 notes:// 链接 ─────────────────────────────
    if not result["url"]:
        u_m = re.search(r"notes://[^\s\"'<>）)\]]+", text)
        if u_m:
            result["url"] = u_m.group(0).rstrip(".,;，。；")

    if result["url"]:
        result["valid"] = True
        # 从 URL 再补齐字段：notes://server/<db路径...>/view/note
        u = re.match(r"notes://([^/?#]+)/([^?#]*)", result["url"], re.IGNORECASE)
        if u:
            if not result["server"]:
                result["server"] = u.group(1)
            segments = [s for s in u.group(2).split("/") if s]
            if segments:
                last = segments[-1]
                note_candidate = last if _HEX32.match(last) else _clean_unid(last)
                if len(segments) >= 3:
                    # 中间所有段是数据库路径（可含组织单元），倒数第二段是视图
                    if not result["database"]:
                        result["database"] = "/".join(segments[:-2])
                    if not result["view_id"]:
                        result["view_id"] = segments[-2]
                    if not result["note_id"]:
                        result["note_id"] = note_candidate
                else:
                    if not result["database"]:
                        result["database"] = segments[0]
                    if len(segments) == 2 and not result["note_id"]:
                        result["note_id"] = note_candidate

    if not result["title"]:
        # 无 NDL 标题时，用文本第一行（去掉链接本身）充当标题
        fallback = re.sub(r"notes://\S+", "", text).strip()
        fallback = re.sub(r"<[^>]+>", " ", fallback).strip()
        result["title"] = fallback.splitlines()[0].strip()[:200] if fallback else ""
    if not result["title"] and result["document"]:
        result["title"] = result["document"]

    return result


def note_card_fields(parsed: dict) -> dict:
    """前端信息卡展示用的字段子集"""
    return {k: parsed.get(k, "") for k in ("url", "title", "server", "database", "view", "document")}
