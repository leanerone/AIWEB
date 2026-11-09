"""认证服务（自 leanerone/web test1 移植，公司电脑实测可用）

- JWT 签发校验：密钥来自 config.settings（.env JWT_SECRET，未配置则临时密钥）
- 密码哈希：PBKDF2-SHA256（纯标准库）
- Windows SSO：读取后端进程登录用户（域内主机本机启动即自动登录）
"""
import getpass
import hashlib
import logging
import os
import secrets
import socket
import time
from typing import Optional

from config import settings

logger = logging.getLogger("aiweb.auth")

JWT_ALGORITHM = "HS256"

_PBKDF2_ITERATIONS = 100_000


def _jwt_secret() -> str:
    if settings.JWT_SECRET:
        return settings.JWT_SECRET
    logger.warning("未配置 JWT_SECRET，使用临时密钥：重启后 token 全部失效")
    return secrets.token_hex(32)


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), _PBKDF2_ITERATIONS
    ).hex()
    return f"pbkdf2_sha256${salt}${digest}"


def verify_password(password: str, stored: Optional[str]) -> bool:
    if not stored:
        return False
    try:
        _algo, salt, digest = stored.split("$")
    except ValueError:
        return False
    calc = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), _PBKDF2_ITERATIONS
    ).hex()
    return secrets.compare_digest(calc, digest)


def get_current_windows_user() -> dict:
    """获取当前 Windows 登录用户（后端进程账号）"""
    username = (
        os.environ.get("USERNAME")
        or os.environ.get("USER")
        or getpass.getuser()
        or "unknown"
    )
    userdomain = os.environ.get("USERDOMAIN") or "WORKGROUP"
    computer = os.environ.get("COMPUTERNAME") or socket.gethostname()
    return {
        "username": username,
        "display_name": username,
        "domain": userdomain,
        "computer": computer,
        "login_at": time.strftime("%Y-%m-%d %H:%M:%S"),
    }


def generate_token(username: str, role: str = "user") -> str:
    import jwt

    payload = {
        "sub": username,
        "role": role,
        "iat": int(time.time()),
        "exp": int(time.time()) + settings.JWT_EXPIRE_HOURS * 3600,
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=JWT_ALGORITHM)


def verify_token(token: str) -> Optional[dict]:
    import jwt

    try:
        return jwt.decode(token, _jwt_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None


# ── 登录防爆破：按用户名+来源 IP 计失败次数，连续失败锁定一段时间 ──
LOGIN_MAX_FAILS = 5
LOGIN_LOCK_SECONDS = 15 * 60

_login_fails: dict[str, tuple[int, float]] = {}  # key → (连续失败次数, 锁定截止时间戳)


def _fail_key(username: str, client_ip: str) -> str:
    return f"{username.lower()}@{client_ip}"


def login_locked(username: str, client_ip: str) -> int:
    """返回剩余锁定秒数；0 表示未锁定"""
    _gc_login_fails()
    _n, until = _login_fails.get(_fail_key(username, client_ip), (0, 0.0))
    remain = int(until - time.time())
    return max(0, remain)


def login_record_failure(username: str, client_ip: str) -> None:
    key = _fail_key(username, client_ip)
    n, _until = _login_fails.get(key, (0, 0.0))
    n += 1
    until = time.time() + LOGIN_LOCK_SECONDS if n >= LOGIN_MAX_FAILS else 0.0
    _login_fails[key] = (n, until)
    if until:
        logger.warning("账号 %s（%s）连续 %d 次登录失败，锁定 %d 分钟",
                       username, client_ip, n, LOGIN_LOCK_SECONDS // 60)


def login_record_success(username: str, client_ip: str) -> None:
    _login_fails.pop(_fail_key(username, client_ip), None)


def _gc_login_fails() -> None:
    """过期条目顺手清理（失败次数少于上限且已过锁定窗口的记录没有意义）"""
    now = time.time()
    for key in [k for k, (_n, until) in _login_fails.items() if until and until < now]:
        _login_fails.pop(key, None)
