"""设置路由：全局 KV 配置（AI 配置等），读时敏感值打码。"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.models import Setting
from database.session import get_db
from routes.deps import get_current_user
from services.ai_service import get_ai_config

router = APIRouter(prefix="/settings", tags=["settings"])

MASKED_KEYS = {"ai_api_key"}
ALLOWED_KEYS = {"ai_api_base", "ai_api_key", "ai_model"}


@router.get("")
def get_settings(db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    kv = {s.key: s.value for s in db.query(Setting).all()}
    cfg = get_ai_config(db)
    data = {
        "ai_api_base": kv.get("ai_api_base", ""),
        "ai_api_key": ("*" * 8) if kv.get("ai_api_key") else "",
        "ai_model": kv.get("ai_model", ""),
        "effective": {
            "api_base": cfg["api_base"],
            "has_key": bool(cfg["api_key"]),
            "model": cfg["model"],
        },
    }
    return {"success": True, "data": data}


@router.put("")
def put_settings(body: dict, db: Session = Depends(get_db),
                 _: object = Depends(get_current_user)):
    for key, value in (body or {}).items():
        if key not in ALLOWED_KEYS:
            continue
        if key in MASKED_KEYS and (value == "" or set(value) == {"*"}):
            continue  # 打码值/空值不覆盖
        row = db.get(Setting, key)
        if row:
            row.value = str(value)
        else:
            db.add(Setting(key=key, value=str(value)))
    db.commit()
    return {"success": True}
