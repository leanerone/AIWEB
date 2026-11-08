"""路由公共依赖：当前登录用户解析。"""
from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from database.models import User
from database.session import get_db
from services import auth_service


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    """从 Authorization: Bearer <token> 解析用户，无效即 401"""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="未登录")
    token = authorization.split(" ", 1)[1].strip()
    payload = auth_service.verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="登录已失效")
    user = db.query(User).filter(User.username == payload.get("sub")).first()
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return user
