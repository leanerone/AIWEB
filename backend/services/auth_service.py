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
