"""SKILL.md frontmatter 解析：上传/导入技能包时自动提取元数据。

对齐 Agent Skills 开放标准（agentskills.io）：
- name ≤64 字符，仅小写字母/数字/连字符
- description 驱动 Agent 发现（≤1024 字符）
- 可选 license / version / author / tags
"""
import re

_NAME_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")


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


def validate_skill_name(name: str) -> tuple[bool, str]:
    """Agent Skills 规范的 name 校验；返回 (是否合规, 规范化建议)"""
    n = (name or "").strip()
    if not n:
        return False, ""
    if _NAME_RE.fullmatch(n):
        return True, n
    # 自动规范化：大写→小写、空格/下划线→连字符、去非法字符
    fixed = re.sub(r"[^a-z0-9-]+", "-", n.lower()).strip("-")
    fixed = re.sub(r"-{2,}", "-", fixed)[:64]
    return (bool(_NAME_RE.fullmatch(fixed)), fixed)


def extract_from_upload(path: str) -> dict:
    """从上传的附件提取元数据：.md 直接解析；.zip 内找 SKILL.md / *.md 解析。

    返回 {"name", "description", "tags", "license", "version", "author"}，找不到字段则为空。
    """
    import zipfile
    from pathlib import Path

    p = Path(path)
    out = {"name": "", "description": "", "tags": [], "license": "", "version": "", "author": ""}
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
            for key in ("name", "description", "license", "version", "author"):
                if not out[key]:
                    out[key] = str(fm.get(key, ""))
            if not out["tags"] and isinstance(fm.get("tags"), list):
                out["tags"] = [str(t) for t in fm["tags"]][:8]
            if out["name"] and out["description"]:
                break
        # 规范化 name（Agent Skills 标准）
        ok, fixed = validate_skill_name(out["name"])
        if ok:
            out["name"] = fixed
    except Exception:
        pass
    return out
