"""敏感值加密存储：用户个人 AI Key 等落库前加密。

- 优先使用 cryptography(Fernet)，密钥从 data/secret.key(JWT 同源)经 SHA-256 派生；
- cryptography 不可用时诚实降级为明文存储并打警告日志（内网零依赖优先于强加密），
  解密侧对「明文/密文」双格式兼容，保证两种模式下写入的数据都能读回。
"""
import base64
import hashlib
import logging

from config import settings

logger = logging.getLogger("aiweb.secretbox")

try:
    from cryptography.fernet import Fernet, InvalidToken

    _FERNET = Fernet(base64.urlsafe_b64encode(
        hashlib.sha256(settings.JWT_SECRET.encode("utf-8")).digest()))
except ImportError:  # pragma: no cover - 仅在极简环境发生
    Fernet = None
    _FERNET = None

    class InvalidToken(Exception):
        pass

    logger.warning("cryptography 未安装：个人 AI Key 将明文存储（pip install cryptography 可启用加密）")

_PREFIX = "enc:v1:"


def encrypt(value: str) -> str:
    """加密字符串；空值原样返回"""
    if not value:
        return ""
    if _FERNET is None:
        return value
    return _PREFIX + _FERNET.encrypt(value.encode("utf-8")).decode("ascii")


def decrypt(value: str) -> str:
    """解密字符串；兼容历史明文与解密失败（如换库后密钥变化）两种情况"""
    if not value:
        return ""
    if _FERNET is None or not value.startswith(_PREFIX):
        return value  # 明文格式（降级模式写入或历史数据）
    try:
        return _FERNET.decrypt(value[len(_PREFIX):].encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError):
        logger.warning("解密失败（密钥可能已更换），按空值处理")
        return ""
