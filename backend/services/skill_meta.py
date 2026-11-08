"""SKILL.md frontmatter 解析：上传技能包时自动提取 name / description 等元数据。"""
import re


def parse_frontmatter(text: str) -> dict:
    """解析 YAML frontmatter（仅支持简单的 key: value 与 key: [a, b] 列表）"""
    m = re.match(r"^---\s*\r?\n(.*?)\r?\n---\s*\r?\n?", (text or ""), re.DOTALL)
    if not m:
        return {}
    out: dict = {}
    for line in m.group(1).splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        key = key.strip().strip("\"'").lower()
        value = value.strip().strip("\"'")
        if not key or not value:
            continue
        if value.startswith("[") and value.endswith("]"):
            items = [v.strip().strip("\"'") for v in value[1:-1].split(",") if v.strip()]
            out[key] = items
        else:
            out[key] = value
    return out


def extract_from_upload(path: str) -> dict:
    """从上传的附件提取元数据：.md 直接解析；.zip 内找 SKILL.md / *.md 解析。

    返回 {"name": str, "description": str, "tags": [..]}，找不到字段则为空。
    """
    import zipfile
    from pathlib import Path

    p = Path(path)
    out = {"name": "", "description": "", "tags": []}
    try:
        texts: list[str] = []
        if p.suffix.lower() == ".md":
            texts.append(p.read_text("utf-8", errors="ignore"))
        elif p.suffix.lower() == ".zip":
            with zipfile.ZipFile(p) as zf:
                names = [n for n in zf.namelist()
                         if n.lower().endswith(".md") and not n.startswith("__MACOSX")]
                # 优先 SKILL.md / README.md，且优先浅层路径
                names.sort(key=lambda n: (0 if n.lower().endswith("skill.md") else
                                          (1 if n.lower().endswith("readme.md") else 2), n.count("/")))
                for n in names[:3]:
                    texts.append(zf.read(n).decode("utf-8", errors="ignore"))
        for text in texts:
            fm = parse_frontmatter(text)
            if not out["name"]:
                out["name"] = str(fm.get("name", ""))
            if not out["description"]:
                out["description"] = str(fm.get("description", ""))
            if not out["tags"] and isinstance(fm.get("tags"), list):
                out["tags"] = [str(t) for t in fm["tags"]][:8]
            if out["name"] and out["description"]:
                break
    except Exception:
        pass
    return out
