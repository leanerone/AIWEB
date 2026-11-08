"""AI 对话路由：SSE 流式对话 + 会话管理 + 内容沉淀。"""
import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import settings
from database.models import ChatMessage, ChatSession, FeedCard, Resource
from database.session import get_db
from routes.deps import get_current_user
from services.ai_service import AiNotConfigured, stream_chat

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    session_id: int | None = None
    message: str
    context_resource_id: int | None = None


@router.get("/sessions")
def list_sessions(db: Session = Depends(get_db), user: object = Depends(get_current_user)):
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.created_by == user.username)
        .order_by(ChatSession.created_at.desc())
        .limit(100)
        .all()
    )
    return {
        "success": True,
        "data": [{"id": s.id, "title": s.title,
                  "created_at": s.created_at.strftime("%Y-%m-%d %H:%M")} for s in sessions],
    }


@router.get("/sessions/{session_id}/messages")
def get_messages(session_id: int, db: Session = Depends(get_db),
                 user: object = Depends(get_current_user)):
    s = db.query(ChatSession).get(session_id)
    if not s or s.created_by != user.username:
        raise HTTPException(status_code=404, detail="会话不存在")
    return {
        "success": True,
        "data": [
            {"id": m.id, "role": m.role, "content": m.content,
             "created_at": m.created_at.strftime("%Y-%m-%d %H:%M")}
            for m in s.messages
        ],
    }


@router.delete("/sessions/{session_id}")
def delete_session(session_id: int, db: Session = Depends(get_db),
                   user: object = Depends(get_current_user)):
    s = db.query(ChatSession).get(session_id)
    if not s or s.created_by != user.username:
        raise HTTPException(status_code=404, detail="会话不存在")
    db.delete(s)
    db.commit()
    return {"success": True}


@router.post("/completions")
def completions(body: ChatRequest, db: Session = Depends(get_db),
                user: object = Depends(get_current_user)):
    """SSE 流式对话。事件序列：meta → delta* → done / error"""
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="消息不能为空")

    session = None
    if body.session_id:
        session = db.query(ChatSession).get(body.session_id)
        if not session or session.created_by != user.username:
            raise HTTPException(status_code=404, detail="会话不存在")
    if not session:
        session = ChatSession(title=body.message.strip()[:40], created_by=user.username)
        db.add(session)
        db.commit()
        db.refresh(session)

    user_msg = ChatMessage(session_id=session.id, role="user", content=body.message)
    db.add(user_msg)
    db.commit()

    # 组装上下文（最近 N 轮）
    history = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.id.desc())
        .limit(settings.CHAT_CONTEXT_ROUNDS * 2)
        .all()
    )
    messages = [{"role": m.role, "content": m.content} for m in reversed(history)]

    # 引用资源作为对话上下文
    if body.context_resource_id:
        res = db.query(Resource).get(body.context_resource_id)
        if res:
            sys_prompt = (
                f"用户正在就平台上的资源向你提问，请结合该资源信息回答。\n"
                f"资源：[{res.type}] {res.name}\n简介：{res.summary}\n详情：\n{res.content[:3000]}"
            )
            messages = [{"role": "system", "content": sys_prompt}] + messages

    session_id = session.id
    session_title = session.title

    def event_stream():
        def sse(event: str, data) -> str:
            return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

        yield sse("meta", {"session_id": session_id, "title": session_title})
        collected = []
        try:
            for piece in stream_chat(db, messages):
                collected.append(piece)
                yield sse("delta", {"text": piece})
        except AiNotConfigured as e:
            yield sse("error", {"message": str(e)})
            return
        except Exception as e:  # 诚实报错，绝不伪造回复
            yield sse("error", {"message": f"AI 调用失败：{e}"})
            return

        full = "".join(collected)
        if full.strip():
            db.add(ChatMessage(session_id=session_id, role="assistant", content=full))
            db.commit()
        yield sse("done", {"session_id": session_id, "reply": full})

    return StreamingResponse(
        event_stream(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/sessions/{session_id}/save-card")
def save_as_card(session_id: int, body: dict, db: Session = Depends(get_db),
                 user: object = Depends(get_current_user)):
    """把某条 AI 回复沉淀为首页内容卡"""
    content = (body.get("content") or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="内容为空")
    s = db.query(ChatSession).get(session_id)
    card = FeedCard(
        kind="ai",
        title=(body.get("title") or (s.title if s else "AI 内容"))[:200],
        content=content,
        summary=content.replace("\n", " ")[:150],
        ref_type="chat", ref_id=session_id,
        created_by=user.username,
    )
    db.add(card)
    db.commit()
    return {"success": True, "data": {"id": card.id}}
