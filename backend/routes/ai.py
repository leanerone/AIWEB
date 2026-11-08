"""AI 能力路由：每日简报（RSS → AI 摘要 → 内容卡）。"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.models import FeedCard, RssItem, RssSource
from database.session import get_db
from routes.deps import get_current_user
from services.ai_service import AiNotConfigured, stream_chat

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/test")
def test_connection(db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    """测试 AI 连接：GET {base}/models，诚实返回结果"""
    import requests as rq

    from services.ai_service import get_ai_config

    cfg = get_ai_config(db)
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
        text = "".join(stream_chat(db, [{"role": "user", "content": prompt}]))
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
        content = "".join(stream_chat(db, [{"role": "user", "content": prompt}]))
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
    """把启用的 RSS 源里最新条目交给 AI 生成「今日 AI 简报」，沉淀为内容卡"""
    items = (
        db.query(RssItem)
        .join(RssSource, RssItem.source_id == RssSource.id)
        .filter(RssSource.enabled.is_(True))
        .order_by(RssItem.published_at.desc().nullslast(), RssItem.id.desc())
        .limit(15)
        .all()
    )
    if not items:
        raise HTTPException(status_code=400, detail="没有可用的 RSS 条目：先到设置页添加订阅源并刷新")

    lines = "\n".join(f"- [{i.source.name}] {i.title}：{i.summary[:120]}" for i in items)
    prompt = (
        "以下是今天抓取的科技/AI 资讯标题与摘要。请写一份简明的中文简报（Markdown）：\n"
        "1. 用 3-5 条要点概括今天值得关注的动态；\n"
        "2. 最后加一行「# 亮点」点评最有价值的一条；\n"
        "总长度不超过 400 字，直接输出简报内容。\n\n" + lines
    )
    try:
        report = "".join(stream_chat(db, [{"role": "user", "content": prompt}]))
    except AiNotConfigured as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI 调用失败：{e}")
    if not report.strip():
        raise HTTPException(status_code=502, detail="AI 未返回内容")

    card = FeedCard(
        kind="ai",
        title=f"AI 每日简报 · {datetime.now().strftime('%m-%d %H:%M')}",
        content=report.strip(),
        summary=report.strip().replace("\n", " ")[:150],
        ref_type="briefing",
        created_by=user.username,
    )
    db.add(card)
    db.commit()
    return {"success": True, "data": {"id": card.id, "title": card.title, "content": card.content}}
