"""应用配置：优先读 backend/.env，全部有默认值，零配置可跑。"""
import os
import secrets
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass

_BASE = Path(__file__).resolve().parent.parent

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{(_BASE / 'data' / 'aiweb.sqlite').as_posix()}")
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", _BASE / "uploads" / "resources"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
(_BASE / "data").mkdir(parents=True, exist_ok=True)

JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "168"))


def _load_jwt_secret() -> str:
    """未显式配置时，首次生成的密钥持久化到 data/secret.key，
    保证重启后 token 仍然有效（否则每次重启全员掉线）。"""
    env = os.getenv("JWT_SECRET", "").strip()
    if env:
        return env
    secret_file = _BASE / "data" / "secret.key"
    try:
        if secret_file.exists():
            saved = secret_file.read_text(encoding="utf-8").strip()
            if saved:
                return saved
        secret = secrets.token_hex(32)
        secret_file.write_text(secret, encoding="utf-8")
        return secret
    except OSError:
        return secrets.token_hex(32)


JWT_SECRET = _load_jwt_secret()

# 后台调度线程（RSS 定时刷新 / 每日备份）开关，默认开启；测试环境可关闭
ENABLE_SCHEDULER = os.getenv("ENABLE_SCHEDULER", "1") == "1"

DEFAULT_USER_PASSWORD = os.getenv("DEFAULT_USER_PASSWORD", "cim123456")

# AI（OpenAI 兼容）兜底配置；设置页保存的配置优先
AI_API_BASE = os.getenv("AI_API_BASE", "https://api.openai.com/v1")
AI_API_KEY = os.getenv("AI_API_KEY", "")
AI_MODEL = os.getenv("AI_MODEL", "gpt-4o-mini")

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")

# 对话上下文最大轮数
CHAT_CONTEXT_ROUNDS = int(os.getenv("CHAT_CONTEXT_ROUNDS", "12"))

# 自动每日简报：每天该整点由调度器生成（-1 关闭）
AI_BRIEFING_HOUR = int(os.getenv("AI_BRIEFING_HOUR", "8"))
