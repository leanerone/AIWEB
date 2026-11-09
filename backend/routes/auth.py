"""认证路由：Windows SSO 自动登录 + 手动账密登录 + Token 校验 + 成员管理。"""
import time

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from sqlalchemy import func
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import settings
from database.models import User
from database.session import get_db
from routes.deps import get_current_user, require_admin
from services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])

KNOWN_DISPLAY = {
    "administrator": {"display_name": "管理员", "role": "admin", "department": "IT"},
}


def _ensure_user(db: Session, username: str, display_name: str = "", role: str = "user",
                 department: str = "") -> User:
    # Windows 域账号大小写不敏感：SSO 进程账号（如 Administrator）应命中已播种的同名小写账号
    user = (db.query(User)
            .filter(func.lower(User.username) == username.strip().lower())
            .first())
    if not user:
        user = User(
            username=username,
            display_name=display_name or username,
            role=role if username == "administrator" else role,
            department=department,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def seed_users(db: Session) -> None:
    """首次启动播种默认账号（密码为 .env DEFAULT_USER_PASSWORD）"""
    _ensure_user(db, "administrator", display_name="管理员", role="admin", department="IT")
    _ensure_user(db, "eap.engineer", display_name="EAP 工程师", department="制造")
    _ensure_user(db, "cim.user", display_name="CIM 用户", department="制造")
    for u in db.query(User).filter(User.password_hash.is_(None)).all():
        u.password_hash = auth_service.hash_password(settings.DEFAULT_USER_PASSWORD)
    db.commit()


class LoginRequest(BaseModel):
    username: str
    password: str


@router.get("/windows")
def windows_sso(db: Session = Depends(get_db)):
    """Windows 域 SSO：后端进程账号自动登录（域内电脑本机启动即用）"""
    info = auth_service.get_current_windows_user()
    user = _ensure_user(db, info["username"], display_name=info["username"])
    return {
        "success": True,
        "data": {
            "token": auth_service.generate_token(user.username, user.role),
            "user": {
                "id": user.id,
                "username": user.username,
                "display_name": user.display_name,
                "role": user.role,
                "department": user.department,
                "domain": info["domain"],
                "computer": info["computer"],
                "login_at": info["login_at"],
            },
            "expires_in": settings.JWT_EXPIRE_HOURS * 3600,
        },
    }


@router.post("/login")
def login(request: LoginRequest, http_request: Request, db: Session = Depends(get_db)):
    """手动登录（防爆破：连续失败 5 次锁定 15 分钟，按 用户名+来源IP 计）"""
    client_ip = http_request.client.host if http_request.client else "-"
    username = request.username.strip()
    locked = auth_service.login_locked(username, client_ip)
    if locked:
        raise HTTPException(status_code=429,
                            detail=f"登录失败次数过多，请 {max(1, locked // 60)} 分钟后再试")
    user = db.query(User).filter(User.username == username).first()
    if not user or not auth_service.verify_password(request.password, user.password_hash):
        auth_service.login_record_failure(username, client_ip)
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    auth_service.login_record_success(username, client_ip)
    return {
        "success": True,
        "data": {
            "token": auth_service.generate_token(user.username, user.role),
            "user": {
                "id": user.id,
                "username": user.username,
                "display_name": user.display_name,
                "role": user.role,
                "department": user.department,
            },
            "expires_in": settings.JWT_EXPIRE_HOURS * 3600,
        },
    }


@router.get("/verify")
def verify(user: User = Depends(get_current_user)):
    return {
        "success": True,
        "data": {
            "id": user.id,
            "username": user.username,
            "display_name": user.display_name,
            "role": user.role,
            "department": user.department,
            "verified_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        },
    }


@router.get("/users")
def list_users(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    users = db.query(User).order_by(User.id).all()
    return {
        "success": True,
        "data": [
            {"id": u.id, "username": u.username, "display_name": u.display_name,
             "role": u.role, "department": u.department}
            for u in users
        ],
    }


@router.post("/users")
def create_user(
    body: dict = Body(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    username = (body.get("username") or "").strip()
    password = body.get("password") or ""
    if not username or not password:
        raise HTTPException(status_code=400, detail="用户名和密码不能为空")
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=400, detail="用户名已存在")
    user = User(
        username=username,
        display_name=body.get("display_name") or username,
        role=body.get("role", "user"),
        department=body.get("department", ""),
        password_hash=auth_service.hash_password(password),
    )
    db.add(user)
    db.commit()
    return {"success": True}
