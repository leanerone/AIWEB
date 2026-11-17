"""MCP Server / Agent 清单校验与安装配方服务。

清单格式对齐 MCP 官方 Registry 的 server.json(v0.1 兼容子集):
  name / title / description / version / packages[{registryType, identifier, transport}]
Agent 清单:runtime(dsh/zcode/generic)+ entry + files。

安全红线:env 只允许 {key, description, required} 占位结构,真实密钥值一律拦截。
"""
import json
import re
from typing import Any

ALLOWED_REGISTRIES = {"npm", "pypi", "nuget", "cargo", "oci", "mcpb"}
ALLOWED_TRANSPORTS = {"stdio", "http", "sse", "streamable-http"}
RUNTIME_HINTS = {"npm": "npx", "pypi": "uvx", "nuget": "dnx",
                 "oci": "docker", "mcpb": "binary", "cargo": "binary"}

# 疑似真实密钥的特征(值中出现即拒绝入库)
_SECRET_PATTERNS = [
    re.compile(r"\bsk-[A-Za-z0-9]{16,}"),            # OpenAI 风格
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),              # AWS AccessKey
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}\b"),    # GitHub Token
    re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}"),    # Slack Token
    re.compile(r"\beyJ[A-Za-z0-9_-]{20,}\.eyJ"),      # JWT
    re.compile(r"(?i)\b(bearer|authorization)\s*[:=]\s*\S{16,}"),
]

_NAME_RE = re.compile(r"^[a-z0-9][a-z0-9._/-]{2,127}$")


def _find_secrets(obj: Any, path: str = "") -> list[str]:
    """递归找疑似真实密钥值,返回路径列表(如 env.API_KEY)"""
    hits: list[str] = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            p = f"{path}.{k}" if path else str(k)
            hits.extend(_find_secrets(v, p))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            hits.extend(_find_secrets(v, f"{path}[{i}]"))
    elif isinstance(obj, str):
        for pat in _SECRET_PATTERNS:
            if pat.search(obj):
                hits.append(path)
                break
    return hits


def _norm_env(entries: Any) -> list[dict] | None:
    """env 规范化:只接受 {key, description?, required?} 结构;真实值一律丢弃"""
    if entries is None:
        return []
    if not isinstance(entries, list):
        return None
    out = []
    for e in entries:
        if not isinstance(e, dict) or not str(e.get("key", "")).strip():
            return None  # 结构非法(把字符串值当 env 传 = 想塞真实密钥)
        out.append({
            "key": str(e["key"]).strip()[:64],
            "description": str(e.get("description", ""))[:200],
            "required": bool(e.get("required", True)),
        })
    return out


def validate_mcp_manifest(obj: dict) -> tuple[bool, list[str], dict]:
    """校验 MCP server 清单。返回 (合法, 错误列表, 规范化后的 manifest)。
    合法时 manifest 里只含占位 env,可直接用于安装配方生成。"""
    errors: list[str] = []
    if not isinstance(obj, dict):
        return False, ["清单必须是 JSON 对象"], {}

    name = str(obj.get("name", "")).strip()
    if not _NAME_RE.fullmatch(name):
        errors.append(f"name 不符合规范({name!r}):应为 小写字母/数字/./-/_ 组成、3~128 字符")
    if not str(obj.get("description", "")).strip():
        errors.append("description 不能为空(用户靠它理解这个 MCP 做什么)")

    version = str(obj.get("version", "1.0.0")).strip()
    transport = str(obj.get("transport", "stdio")).lower()
    if transport not in ALLOWED_TRANSPORTS:
        errors.append(f"transport 非法:{transport}(允许 {'/'.join(sorted(ALLOWED_TRANSPORTS))})")

    manifest: dict = {
        "name": name, "title": str(obj.get("title", ""))[:100],
        "description": str(obj.get("description", ""))[:500],
        "version": version, "transport": transport,
    }

    # 远程 MCP(http/sse)
    if transport in ("http", "sse"):
        url = str(obj.get("remoteUrl", "")).strip()
        if not url.startswith(("http://", "https://")):
            errors.append("remoteUrl 必须是 http(s) 地址")
        else:
            manifest["remoteUrl"] = url[:500]
    # 本地 MCP:packages
    else:
        packages = obj.get("packages")
        if not isinstance(packages, list) or not packages:
            errors.append("packages 不能为空(至少一个 registryType + identifier)")
        else:
            norm: list[dict] = []
            for i, p in enumerate(packages):
                if not isinstance(p, dict):
                    errors.append(f"packages[{i}] 不是对象")
                    continue
                rt = str(p.get("registryType", "")).lower()
                ident = str(p.get("identifier", "")).strip()
                if rt not in ALLOWED_REGISTRIES:
                    errors.append(f"packages[{i}].registryType 非法:{rt}")
                    continue
                if not ident:
                    errors.append(f"packages[{i}].identifier 不能为空")
                    continue
                norm.append({
                    "registryType": rt, "identifier": ident[:200],
                    "version": str(p.get("version", version))[:30],
                    "transport": str(p.get("transport", "stdio")).lower(),
                    "runtimeHint": str(p.get("runtimeHint", RUNTIME_HINTS.get(rt, "binary"))),
                })
            manifest["packages"] = norm

    env = _norm_env(obj.get("env"))
    if env is None:
        errors.append("env 必须是 [{key, description?, required?}] 结构——真实密钥值不允许入库")
    else:
        manifest["env"] = env

    secret_paths = _find_secrets(obj)
    if secret_paths:
        errors.append(f"检测到疑似真实密钥,拒绝入库:{', '.join(secret_paths[:5])}(env 请只填 key+说明)")

    return (not errors), errors, manifest


def validate_agent_manifest(obj: dict) -> tuple[bool, list[str], dict]:
    """校验 Agent 包清单:runtime + entry + files"""
    errors: list[str] = []
    if not isinstance(obj, dict):
        return False, ["清单必须是 JSON 对象"], {}

    name = str(obj.get("name", "")).strip()
    if not _NAME_RE.fullmatch(name):
        errors.append(f"name 不符合规范({name!r})")
    runtime = str(obj.get("runtime", "generic")).lower()
    if runtime not in ("dsh", "zcode", "generic"):
        errors.append(f"runtime 非法:{runtime}(允许 dsh/zcode/generic)")

    entry = str(obj.get("entry", "SKILL.md")).strip()
    if not entry:
        errors.append("entry 不能为空(入口文件)")

    files = obj.get("files")
    norm_files: list[dict] = []
    if files is not None:
        if not isinstance(files, list):
            errors.append("files 必须是数组")
        else:
            for i, f in enumerate(files):
                if not isinstance(f, dict) or not str(f.get("path", "")).strip():
                    errors.append(f"files[{i}] 缺 path")
                    continue
                norm_files.append({
                    "path": str(f["path"]).strip()[:200],
                    "description": str(f.get("description", ""))[:200],
                })

    manifest = {
        "name": name, "runtime": runtime, "entry": entry[:200],
        "description": str(obj.get("description", ""))[:500],
        "files": norm_files, "version": str(obj.get("version", "1.0.0"))[:30],
    }
    secret_paths = _find_secrets(obj)
    if secret_paths:
        errors.append(f"检测到疑似真实密钥,拒绝入库:{', '.join(secret_paths[:5])}")

    return (not errors), errors, manifest


def parse_manifest_json(text: str) -> tuple[dict | None, str]:
    """解析 JSON 文本;返回 (对象或 None, 错误消息)"""
    try:
        obj = json.loads(text or "")
        if not isinstance(obj, dict):
            return None, "清单必须是 JSON 对象"
        return obj, ""
    except json.JSONDecodeError as e:
        return None, f"JSON 解析失败:{e}"


def install_recipes(rtype: str, name: str, manifest: dict) -> dict[str, str]:
    """生成各客户端安装配方。返回 {client: 配置文本}"""
    recipes: dict[str, str] = {}

    if rtype == "mcp" and manifest.get("transport") in ("http", "sse"):
        remote = {"type": manifest["transport"], "url": manifest["remoteUrl"]}
        block = json.dumps({manifest["name"]: remote}, ensure_ascii=False, indent=2)
        recipes["claude_desktop"] = f'// claude_desktop_config.json → mcpServers 里加入:\n{block}'
        recipes["zcode"] = f'// ZCode MCP 配置里加入:\n{block}'
        recipes["raw"] = f"远程 MCP:{manifest['remoteUrl']}(transport={manifest['transport']})"
        return recipes

    if rtype == "mcp":
        env_placeholders = {e["key"]: f"<{e['key']}>" for e in manifest.get("env", [])}
        for p in manifest.get("packages", []):
            rt, ident, hint = p["registryType"], p["identifier"], p.get("runtimeHint", "")
            if rt == "npm":
                cmd = f'npx -y {ident}@{p.get("version", "latest")}'
                srv = {"command": "npx", "args": ["-y", f"{ident}@{p.get('version', 'latest')}"]}
                if env_placeholders:
                    srv["env"] = env_placeholders
                block = json.dumps({name: srv}, ensure_ascii=False, indent=2)
                recipes["claude_desktop"] = f'// claude_desktop_config.json → mcpServers 里加入:\n{block}'
                recipes["raw"] = f"# 运行命令\n{cmd}\n# 需要环境变量:" + "".join(
                    f"\n#   {e['key']} - {e['description']}" for e in manifest.get("env", []))
            elif rt == "pypi":
                recipes["raw"] = (f"# 运行命令\nuvx {ident}@{p.get('version', 'latest')}"
                                  + "".join(f"\n#   {e['key']}={e['description']}" for e in manifest.get("env", [])))
                srv = {"command": "uvx", "args": [f"{ident}@{p.get('version', 'latest')}"]}
                if env_placeholders:
                    srv["env"] = env_placeholders
                block = json.dumps({name: srv}, ensure_ascii=False, indent=2)
                recipes["claude_desktop"] = f'// claude_desktop_config.json → mcpServers 里加入:\n{block}'
            elif rt == "oci":
                recipes["raw"] = f"# Docker 运行\ndocker run -i --rm {ident}" + "".join(
                    f" -e {e['key']}" for e in manifest.get("env", []))
            if hint and hint != "binary":
                recipes[f"runtime:{rt}"] = f"运行时:{hint}"
        recipes["zcode"] = recipes.get("claude_desktop", "").replace("claude_desktop_config.json", "ZCode MCP 配置")
        recipes["dsh"] = ("# DeepSeek Harness:把本 MCP 的启动命令加到 dsh 的 MCP 配置,"
                          "或先用平台「下载安装包」取 server.json")
        return recipes

    if rtype == "agent":
        runtime = manifest.get("runtime", "generic")
        entry = manifest.get("entry", "SKILL.md")
        if runtime == "dsh":
            recipes["dsh"] = (f"# 下载安装包解压到 DeepSeek Harness 的技能目录\n"
                              f"mkdir -p ~/.agents/skills/{name} && 解压后 SKILL.md 位于 ~/.agents/skills/{name}/{entry}")
        elif runtime == "zcode":
            recipes["zcode"] = f"# ZCode Agent:解压安装包后按 {entry} 的说明注册"
        else:
            recipes["raw"] = f"# 通用 Agent:解压安装包,入口文件 {entry}"
        return recipes

    if rtype == "skill":
        recipes["raw"] = ("# Agent Skills 标准安装\n"
                          f"mkdir -p ~/.agents/skills/{name} && 将下载的 SKILL.md 放入该目录")
        return recipes

    return recipes
