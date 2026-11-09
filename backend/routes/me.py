"""个人设置路由：每人自己的 AI 配置（Key 加密落库），与全局配置无关。"""
from database.models import UserAiConfig
from database.session import get_db
from fastapi import APIRouter, Depends, HTTPException
from routes.deps import get_current_user
from services.ai_service import get_ai_config
from services.secret_box import decrypt, encrypt
from sqlalchemy.orm import Session

router = APIRouter(prefix="/me", tags=["me"])

MASK = "********"


def _masked(uc: UserAiConfig | None) -> dict:
    return {
        "has_config": bool(uc and (uc.api_key_encrypted or uc.api_base or uc.model)),
        "api_base": uc.api_base if uc else "",
        "api_key": MASK if (uc and uc.api_key_encrypted) else "",
        "model": uc.model if uc else "",
        "system_prompt": uc.system_prompt if uc else "",
        "auto_exec": bool(uc.auto_exec) if uc else False,
    }


def _get_uc(db: Session, username: str) -> UserAiConfig | None:
    return db.query(UserAiConfig).filter(UserAiConfig.username == username).first()


@router.get("/ai-config")
def get_my_ai_config(db: Session = Depends(get_db), user: object = Depends(get_current_user)):
    """读个人 AI 配置（Key 打码）+ 当前生效链信息"""
    uc = _get_uc(db, user.username)
    effective = get_ai_config(db, user.username)
    return {
        "success": True,
        "data": {
            **_masked(uc),
            "effective": {
                "api_base": effective["api_base"],
                "model": effective["model"],
                "has_key": bool(effective["api_key"]),
                "source": effective["source"],  # user / global / env
                "auto_exec": effective["auto_exec"],
            },
        },
    }


@router.put("/ai-config")
def put_my_ai_config(body: dict, db: Session = Depends(get_db),
                     user: object = Depends(get_current_user)):
    """写个人 AI 配置。api_key 传打码值/空值 = 不修改；传 "-" = 清除。"""
    uc = _get_uc(db, user.username)
    if uc is None:
        uc = UserAiConfig(username=user.username)
        db.add(uc)

    if "api_base" in body:
        uc.api_base = str(body.get("api_base") or "").strip()[:250]
    if "model" in body:
        uc.model = str(body.get("model") or "").strip()[:120]
    if "system_prompt" in body:
        uc.system_prompt = str(body.get("system_prompt") or "")[:2000]
    if "auto_exec" in body:
        uc.auto_exec = bool(body.get("auto_exec"))

    key = body.get("api_key")
    if key is not None:
        key = str(key).strip()
        if key == "-":
            uc.api_key_encrypted = ""  # 显式清除
        elif key and key != MASK:
            if len(key) < 8:
                raise HTTPException(status_code=400, detail="API Key 长度不对，请检查后重试")
            uc.api_key_encrypted = encrypt(key)

    db.commit()
    return {"success": True, "data": {"has_key": bool(uc.api_key_encrypted)}}


@router.get("/ai-config/reveal")
def reveal_key_segment(db: Session = Depends(get_db), user: object = Depends(get_current_user)):
    """展示 Key 尾部 4 位用于确认是哪把钥匙（绝不返回完整 Key）"""
    uc = _get_uc(db, user.username)
    if not uc or not uc.api_key_encrypted:
        return {"success": True, "data": {"tail": ""}}
    key = decrypt(uc.api_key_encrypted)
    return {"success": True, "data": {"tail": key[-4:] if len(key) >= 8 else "****"}}
