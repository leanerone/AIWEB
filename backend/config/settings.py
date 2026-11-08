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

JWT_SECRET = os.getenv("JWT_SECRET") or secrets.token_hex(32)
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "168"))

DEFAULT_USER_PASSWORD = os.getenv("DEFAULT_USER_PASSWORD", "cim123456")

# AI（OpenAI 兼容）兜底配置；设置页保存的配置优先
AI_API_BASE = os.getenv("AI_API_BASE", "https://api.openai.com/v1")
AI_API_KEY = os.getenv("AI_API_KEY", "")
AI_MODEL = os.getenv("AI_MODEL", "gpt-4o-mini")

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")

# 对话上下文最大轮数
CHAT_CONTEXT_ROUNDS = int(os.getenv("CHAT_CONTEXT_ROUNDS", "12"))
