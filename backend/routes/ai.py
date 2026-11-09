"""AI 能力路由：每日简报（RSS → AI 摘要 → 内容卡）。"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.models import FeedCard, RssItem
from database.session import get_db
from routes.deps import get_current_user
from services.ai_service import AiNotConfigured, stream_chat

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/test")
def test_connection(db: Session = Depends(get_db), user: object = Depends(get_current_user)):
    """测试 AI 连接：GET {base}/models，诚实返回结果（优先测个人配置）"""
    import requests as rq

    from services.ai_service import get_ai_config

    cfg = get_ai_config(db, user.username)
    if not cfg["api_key"]:
        return {"success": False, "message": "未配置 API Key"}
    try:
        resp = rq.get(f"{cfg['api_base']}/models",
                      headers={"Authorization": f"Bearer {cfg['api_key']}"}, timeout=(8, 20))
        resp.raise_for_status()
        data = resp.json()
        models = [m.get("id") for m in data.get("data", []) if m.get("id")][:10]
        return {"success": True, "data": {"base": cfg["api_base"], "model": cfg["model"],
                 "available": models, "count": len(models)}}
    except Exception as e:
        detail = ""
        if getattr(e, "response", None) is not None:
            detail = e.response.text[:200]
        return {"success": False, "message": f"连接失败：{e} {detail}"}


@router.post("/describe")
def describe(body: dict, db: Session = Depends(get_db), user: object = Depends(get_current_user)):
    """AI 生成资源简介：根据名称/类型/补充说明写一句话摘要"""
    name = (body.get("name") or "").strip()
    rtype = (body.get("type") or "tool").strip()
    hints = (body.get("hints") or "").strip()[:500]
    if not name:
        raise HTTPException(status_code=400, detail="请先填写资源名称")
    label = {"skill": "技能包", "tool": "小工具", "plugin": "插件"}.get(rtype, rtype)
    prompt = (
        f"我在内网平台上发布一个{label}，名字叫「{name}」。"
        + (f"补充说明：{hints}。" if hints else "")
        + "请写一句话中文简介（不超过40字），说明它做什么、给谁用，直接输出简介本身。"
    )
    try:
        text = "".join(stream_chat(db, [{"role": "user", "content": prompt}], username=user.username))
    except AiNotConfigured as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI 调用失败：{e}")
    if not text.strip():
        raise HTTPException(status_code=502, detail="AI 未返回内容")
    return {"success": True, "data": {"summary": text.strip()}}


@router.post("/rss-card")
def rss_to_card(body: dict, db: Session = Depends(get_db), user: object = Depends(get_current_user)):
    """把一条 RSS 资讯交给 AI 生成中文知识卡，沉淀到首页动态"""
    from database.models import RssItem

    item = db.get(RssItem, int(body.get("rss_item_id", 0)))
    if not item:
        raise HTTPException(status_code=404, detail="资讯条目不存在")
    prompt = (
        f"把下面这条资讯整理成一张中文知识卡（Markdown，不超过150字）：\n"
        f"格式：一句话核心结论 + 2-3 个要点（- 开头）+ 对企业内网 AI 应用的启示（可选）。\n\n"
        f"标题：{item.title}\n摘要：{item.summary}"
    )
    try:
        content = "".join(stream_chat(db, [{"role": "user", "content": prompt}], username=user.username))
    except AiNotConfigured as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI 调用失败：{e}")
    if not content.strip():
        raise HTTPException(status_code=502, detail="AI 未返回内容")

    card = FeedCard(
        kind="ai", title=f"知识卡 · {item.title[:80]}",
        content=content.strip(),
        summary=content.strip().replace("\n", " ")[:150],
        ref_type="rss", ref_id=item.id, source_url=item.link,
        created_by=user.username,
    )
    db.add(card)
    db.commit()
    return {"success": True, "data": {"id": card.id, "title": card.title}}


@router.post("/briefing")
def daily_briefing(db: Session = Depends(get_db), user: object = Depends(get_current_user)):
    """手动生成「今日 AI 简报」（逻辑见 services/briefing.py）"""
    from services.briefing import build_briefing

    try:
        data = build_briefing(db, created_by=user.username, username=user.username)
    except AiNotConfigured as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI 调用失败：{e}")
    return {"success": True, "data": data}
