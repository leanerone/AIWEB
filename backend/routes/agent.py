"""Agent 路由：悬浮助手的智能体运行入口（SSE）。

POST /api/agent/run     发起新任务（创建会话或续写已有会话）
POST /api/agent/resume  恢复挂起任务（确认写操作 / 回答提问）
"""
from types import SimpleNamespace

from database.models import ChatSession
from database.session import SessionLocal, get_db
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from routes.deps import get_current_user
from services.agent_service import stream_resume, stream_run
from sqlalchemy.orm import Session

router = APIRouter(prefix="/agent", tags=["agent"])

SSE_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}


class AgentRequest(BaseModel):
    session_id: int | None = None
    message: str = ""
    page_context: str | None = None
    regenerate: bool = False  # 重新生成：重答该会话最后一个用户问题，不加新消息


class ResumeRequest(BaseModel):
    run_id: int
    approved: bool | None = None
    answer: str | None = None


@router.post("/run")
def run(body: AgentRequest, db: Session = Depends(get_db),
        user: object = Depends(get_current_user)):
    from database.models import ChatMessage
    from services.ai_service import get_ai_config

    # AI 配置预检：在任何落库之前拦截（与 /chat/completions 行为一致）
    if not get_ai_config(db, user.username)["api_key"]:
        raise HTTPException(status_code=400,
                            detail="AI 未配置：请到「设置 → 个人 AI 设置」填写你的 API Key")

    session = None
    if body.session_id:
        session = db.get(ChatSession, body.session_id)
        if not session or session.created_by != user.username:
            raise HTTPException(status_code=404, detail="会话不存在")

    question = body.message.strip()
    page_context = body.page_context or ""
    if body.regenerate:
        if not session:
            raise HTTPException(status_code=400, detail="请先选择要重新生成的会话")
        all_msgs = (db.query(ChatMessage)
                    .filter(ChatMessage.session_id == session.id)
                    .order_by(ChatMessage.id).all())
        last_user = next((m for m in reversed(all_msgs) if m.role == "user"), None)
        if not last_user:
            raise HTTPException(status_code=400, detail="没有可重新生成的用户消息")
        for m in all_msgs:
            if m.id > last_user.id and m.role == "assistant":
                db.delete(m)  # 删除上一轮助手回答（含任务卡），随后重答
        db.commit()
        question = last_user.content
    else:
        if not question:
            raise HTTPException(status_code=400, detail="消息不能为空")
        if not session:
            session = ChatSession(title=question[:40], created_by=user.username)
            db.add(session)
            db.commit()
            db.refresh(session)
        db.add(ChatMessage(session_id=session.id, role="user", content=question))
        db.commit()

    # SSE 生成器不能复用请求级 db/ORM user：FastAPI>=0.106 在响应体开始流式前就执行
    # `yield` 依赖的收尾（session.close()），流里再访问 user.username 会 DetachedInstanceError。
    # 因此这里只把纯数据（username/session_id）带进生成器，并由生成器自持一个 Session。
    # display_name 也要带：工具通知（如收藏）会用 user.display_name
    username, display_name, session_id = user.username, user.display_name, session.id

    def gen():
        own = SessionLocal()
        try:
            yield from stream_run(own, SimpleNamespace(username=username, display_name=display_name),
                                  own.get(ChatSession, session_id), question, page_context)
        finally:
            own.close()

    return StreamingResponse(gen(), media_type="text/event-stream", headers=SSE_HEADERS)


@router.post("/resume")
def resume(body: ResumeRequest, db: Session = Depends(get_db),
           user: object = Depends(get_current_user)):
    if body.approved is None and (body.answer is None or not body.answer.strip()):
        raise HTTPException(status_code=400, detail="请提供确认结果或回答内容")
    username, display_name = user.username, user.display_name
    approved, answer, run_id = body.approved, (body.answer or "").strip() or None, body.run_id

    def gen():
        own = SessionLocal()
        try:
            yield from stream_resume(own, SimpleNamespace(username=username, display_name=display_name), run_id,
                                     approved=approved, answer=answer)
        finally:
            own.close()

    return StreamingResponse(gen(), media_type="text/event-stream", headers=SSE_HEADERS)


@router.get("/runs/{run_id}")
def get_run(run_id: int, db: Session = Depends(get_db), user: object = Depends(get_current_user)):
    from database.models import AgentRun, AgentToolCall

    run = db.get(AgentRun, run_id)
    if not run or run.username != user.username:
        raise HTTPException(status_code=404, detail="任务不存在")
    calls = (db.query(AgentToolCall)
             .filter(AgentToolCall.run_id == run.id)
             .order_by(AgentToolCall.id).all())
    return {"success": True, "data": {
        "id": run.id, "status": run.status, "steps": run.steps or [],
        "result": run.result,
        "created_at": run.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        "tool_calls": [{"tool": c.tool, "args": c.args, "ok": c.ok,
                        "digest": c.result_digest} for c in calls],
    }}
