"""AI 服务：OpenAI 兼容接口调用（流式），配置来自设置表，未配置时诚实报错。"""
import json
import logging
import re
from typing import Generator

import requests

from config import settings

logger = logging.getLogger("aiweb.ai")


class AiNotConfigured(Exception):
    pass


def get_ai_config(db) -> dict:
    """设置表优先，缺省回落 .env"""
    from database.models import Setting

    kv = {s.key: s.value for s in db.query(Setting).all()}
    return {
        "api_base": (kv.get("ai_api_base") or settings.AI_API_BASE).rstrip("/"),
        "api_key": kv.get("ai_api_key") or settings.AI_API_KEY,
        "model": kv.get("ai_model") or settings.AI_MODEL,
    }


def stream_chat(db, messages: list[dict]) -> Generator[str, None, None]:
    """SSE 流式对话，逐段 yield 文本增量"""
    cfg = get_ai_config(db)
    if not cfg["api_key"]:
        raise AiNotConfigured("AI 未配置：请到「设置 → AI 配置」填写 API Key")

    try:
        resp = requests.post(
            f"{cfg['api_base']}/chat/completions",
            headers={"Authorization": f"Bearer {cfg['api_key']}"},
            json={"model": cfg["model"], "messages": messages, "stream": True},
            stream=True,
            timeout=(10, 180),
        )
        resp.raise_for_status()
    except requests.RequestException as e:
        detail = ""
        if e.response is not None:
            detail = e.response.text[:300]
        raise RuntimeError(f"AI 请求失败：{e} {detail}") from e

    for line in resp.iter_lines(decode_unicode=True):
        if not line or not line.startswith("data:"):
            continue
        data = line[5:].strip()
        if data == "[DONE]":
            break
        try:
            chunk = json.loads(data)
            delta = chunk["choices"][0].get("delta", {})
            piece = delta.get("content") or ""
            if piece:
                yield piece
        except (json.JSONDecodeError, KeyError, IndexError):
            continue


def summarize(db, text: str, max_len: int = 120) -> str:
    """生成摘要；AI 不可用时返回截断文本（诚实降级）"""
    try:
        out = "".join(
            stream_chat(
                db,
                [{"role": "system", "content": "用一句中文概括以下内容，不超过40字，直接输出摘要。"},
                 {"role": "user", "content": text[:3000]}],
            )
        )
        if out.strip():
            return out.strip()[:max_len]
    except Exception:
        logger.warning("AI 摘要失败，使用截断降级", exc_info=True)
    text = re.sub(r"\s+", " ", text or "").strip()
    return text[:max_len]
