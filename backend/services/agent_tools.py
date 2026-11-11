"""Agent 工具注册表：悬浮助手可调用的平台能力。

设计原则（取自 dsh-superagent）：
- 一切工具以「当前登录用户」身份执行——用户权限即 Agent 权限（Mandate 简化版）；
- 只读工具直接放行；写工具默认需用户确认（confirm），auto_exec 开启后自动执行；
- 每次执行写审计（AgentToolCall）；返回给模型的是紧凑文本，写给用户的是中文摘要。

handler 约定：返回 (ok: bool, summary: str, result: str)。
summary 展示在前端任务卡（一行），result 是回传给模型的完整结果文本。
"""
import json
from collections.abc import Callable

from database.models import Bookmark, FeedCard, Memo, Resource, RssItem, RssSource, User
from sqlalchemy import or_
from sqlalchemy.orm import Session

from services import fts

MAX_RESULT_CHARS = 3000  # 单个工具结果回传给模型的长度上限


def _clip(text: str, limit: int = MAX_RESULT_CHARS) -> str:
    return text if len(text) <= limit else text[:limit] + f"\n…（已截断，共 {len(text)} 字符）"


# ── 只读工具 ──────────────────────────────────────────────────


def tool_search_platform(db: Session, user: User, args: dict) -> tuple[bool, str, str]:
    q = str(args.get("query") or "").strip()
    if not q:
        return False, "缺少搜索词", "错误：query 不能为空"
    limit = max(1, min(int(args.get("limit") or 6), 10))
    hits = fts.search(db, q, limit=limit)
    if not hits:
        return True, f"搜索「{q}」无结果", f"平台内没有找到与「{q}」相关的内容。"
    lines: list[str] = []
    for h in hits:
        if h["kind"] == "resource":
            r = db.get(Resource, h["id"])
            if r and getattr(r, "visibility", "public") == "private" and r.created_by != user.username:
                continue  # 别人的私有资源不出现在 AI 视野
        lines.append(f"- [{h['kind']}] #{h['id']} {h['title']}：{h['snippet']}")
    if not lines:
        return True, f"搜索「{q}」无结果", f"平台内没有找到与「{q}」相关的内容。"
    return True, f"搜索「{q}」命中 {len(lines)} 条", "\n".join(lines)


def tool_get_resource(db: Session, user: User, args: dict) -> tuple[bool, str, str]:
    rid = int(args.get("resource_id") or 0)
    from database.models import Resource

    r = db.get(Resource, rid)
    if not r:
        return False, f"资源 #{rid} 不存在", f"错误：资源 #{rid} 不存在"
    if getattr(r, "visibility", "public") == "private" and r.created_by != user.username:
        return False, f"资源 #{rid} 不存在", f"错误：资源 #{rid} 不存在"  # 别人的私有对外等于不存在
    tags = "、".join(r.tags or [])
    summary = (f"资源 #{r.id} [{r.type}] {r.name}\n"
               f"简介：{r.summary}\n标签：{tags}\n作者：{r.author or r.created_by}\n"
               f"下载 {r.downloads} · 点赞 {r.likes} · 浏览 {r.views}\n"
               f"详情 Markdown：\n{r.content or '（无详情）'}")
    return True, f"读取资源「{r.name}」", _clip(summary)


def tool_list_resources(db: Session, user: User, args: dict) -> tuple[bool, str, str]:
    from database.models import Resource

    rtype = str(args.get("type") or "").strip()
    keyword = str(args.get("keyword") or "").strip()
    limit = max(1, min(int(args.get("limit") or 10), 20))
    q = db.query(Resource)
    if rtype in ("skill", "tool", "plugin"):
        q = q.filter(Resource.type == rtype)
    if keyword:
        like = f"%{keyword}%"
        q = q.filter(or_(Resource.name.like(like), Resource.summary.like(like)))
    rows = q.order_by(Resource.updated_at.desc()).limit(limit).all()
    if not rows:
        return True, "资源库为空", "资源库中没有匹配的资源。"
    lines = [f"- #{r.id} [{r.type}] {r.name}：{(r.summary or '')[:60]}" for r in rows]
    return True, f"列出 {len(rows)} 个资源", "\n".join(lines)


def tool_read_memo(db: Session, user: User, args: dict) -> tuple[bool, str, str]:
    mid = int(args.get("memo_id") or 0)
    m = db.get(Memo, mid)
    if not m:
        return False, f"笔记 #{mid} 不存在", f"错误：笔记 #{mid} 不存在"
    return True, f"读取笔记「{m.title}」", _clip(f"笔记 #{m.id} {m.title}（标签：{'、'.join(m.tags or [])}）：\n{m.content}")


def tool_list_memos(db: Session, user: User, args: dict) -> tuple[bool, str, str]:
    keyword = str(args.get("keyword") or "").strip()
    limit = max(1, min(int(args.get("limit") or 10), 20))
    q = db.query(Memo)
    if keyword:
        like = f"%{keyword}%"
        q = q.filter(or_(Memo.title.like(like), Memo.content.like(like)))
    rows = q.order_by(Memo.pinned.desc(), Memo.updated_at.desc()).limit(limit).all()
    if not rows:
        return True, "没有匹配的笔记", "没有找到匹配的笔记。"
    lines = [f"- #{m.id} {m.title}（{m.created_by}，{'置顶' if m.pinned else '更新于 ' + m.updated_at.strftime('%m-%d')}）"
             for m in rows]
    return True, f"列出 {len(rows)} 条笔记", "\n".join(lines)


def tool_list_comments(db: Session, user: User, args: dict) -> tuple[bool, str, str]:
    """读某资源下的评论区讨论"""
    from database.models import Resource, ResourceComment

    rid = int(args.get("resource_id") or 0)
    r = db.get(Resource, rid)
    if not r:
        return False, f"资源 #{rid} 不存在", f"错误：资源 #{rid} 不存在"
    rows = (db.query(ResourceComment)
            .filter(ResourceComment.resource_id == rid)
            .order_by(ResourceComment.id.desc())
            .limit(max(1, min(int(args.get("limit") or 10), 20)))
            .all())
    if not rows:
        return True, f"资源「{r.name}」暂无评论", f"资源「{r.name}」下还没有评论。"
    lines = [f"- {c.created_by}（{c.created_at.strftime('%m-%d %H:%M')}）：{c.content[:120]}" for c in rows]
    return True, f"读取「{r.name}」的 {len(rows)} 条评论", chr(10).join(lines)


def tool_search_notes_links(db: Session, user: User, args: dict) -> tuple[bool, str, str]:
    from database.models import NoteLink

    keyword = str(args.get("keyword") or "").strip()
    limit = max(1, min(int(args.get("limit") or 8), 15))
    q = db.query(NoteLink)
    if keyword:
        like = f"%{keyword}%"
        q = q.filter(or_(NoteLink.title.like(like), NoteLink.database.like(like),
                         NoteLink.document.like(like)))
    rows = q.order_by(NoteLink.id.desc()).limit(limit).all()
    if not rows:
        return True, "没有匹配的 Notes 链接", "Notes 链接库中没有匹配条目。"
    lines = [f"- #{n.id} {n.title or n.document}（{n.server}/{n.database}）" for n in rows]
    return True, f"找到 {len(rows)} 条 Notes 链接", chr(10).join(lines)


def tool_get_briefing(db: Session, user: User, args: dict) -> tuple[bool, str, str]:
    from database.models import FeedCard

    bid = int(args.get("briefing_id") or 0)
    q = db.query(FeedCard).filter(FeedCard.ref_type == "briefing")
    card = db.get(FeedCard, bid) if bid else q.order_by(FeedCard.id.desc()).first()
    if not card:
        return True, "还没有简报", "平台上还没有任何 AI 简报。可以让我帮你生成一份（需确认）。"
    return True, f"读取简报「{card.title[:30]}」", _clip(f"{card.title}\n\n{card.content}")


def tool_list_rss_items(db: Session, user: User, args: dict) -> tuple[bool, str, str]:
    limit = max(1, min(int(args.get("limit") or 10), 20))
    rows = (db.query(RssItem)
            .join(RssSource, RssItem.source_id == RssSource.id)
            .filter(RssSource.enabled.is_(True))
            .order_by(RssItem.published_at.desc().nullslast(), RssItem.id.desc())
            .limit(limit).all())
    if not rows:
        return True, "暂无资讯条目", "目前没有资讯条目（可先到设置页添加订阅源并刷新）。"
    lines = [f"- #{i.id} [{i.source.name}] {i.title}：{(i.summary or '')[:80]}" for i in rows]
    return True, f"列出 {len(rows)} 条最新资讯", "\n".join(lines)


# ── 写工具（默认需确认） ──────────────────────────────────────


def tool_create_memo(db: Session, user: User, args: dict) -> tuple[bool, str, str]:
    title = str(args.get("title") or "").strip()
    content = str(args.get("content") or "").strip()
    if not title:
        return False, "缺少笔记标题", "错误：title 不能为空"
    tags = args.get("tags") or []
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(",") if t.strip()]
    m = Memo(title=title[:200], content=content, tags=tags[:8], created_by=user.username)
    db.add(m)
    db.commit()
    db.refresh(m)
    fts.index_memo(db, m)
    db.commit()
    return True, f"已创建笔记「{m.title}」", f"笔记已创建：#{m.id} {m.title}"


def tool_append_to_memo(db: Session, user: User, args: dict) -> tuple[bool, str, str]:
    """往已有笔记末尾追加一段内容（Markdown），保留原内容"""
    mid = int(args.get("memo_id") or 0)
    m = db.get(Memo, mid)
    if not m:
        return False, f"笔记 #{mid} 不存在", f"错误：笔记 #{mid} 不存在"
    addition = str(args.get("content") or "").strip()
    if not addition:
        return False, "追加内容为空", "错误：content 不能为空"
    sep = chr(10) * 2 if (m.content and not m.content.endswith(chr(10))) else (chr(10) if m.content else "")
    m.content = f"{m.content}{sep}{addition}" + chr(10)
    db.commit()
    fts.index_memo(db, m)
    db.commit()
    return True, f"已追加到笔记「{m.title}」", f"已向笔记 #{m.id}「{m.title}」追加 {len(addition)} 字。"


def tool_bookmark_resource(db: Session, user: User, args: dict) -> tuple[bool, str, str]:
    rid = int(args.get("resource_id") or 0)
    from database.models import Resource

    r = db.get(Resource, rid)
    if not r:
        return False, f"资源 #{rid} 不存在", f"错误：资源 #{rid} 不存在"
    q = db.query(Bookmark).filter(Bookmark.username == user.username,
                                  Bookmark.target_type == "resource",
                                  Bookmark.target_id == rid)
    existing = q.first()
    if existing:
        db.delete(existing)
        db.commit()
        return True, f"已取消收藏「{r.name}」", f"已取消收藏资源 #{rid}。"
    db.add(Bookmark(username=user.username, target_type="resource", target_id=rid))
    db.commit()
    from routes.notifications import notify

    if r.created_by and r.created_by != user.username:
        notify(db, r.created_by, "system",
               f"{user.display_name or user.username}（通过 AI 助手）收藏了你的资源「{r.name}」",
               ref_type="resource", ref_id=r.id)
        db.commit()
    return True, f"已收藏「{r.name}」", f"已收藏资源 #{rid}。"


def tool_generate_briefing(db: Session, user: User, args: dict) -> tuple[bool, str, str]:
    from services.briefing import build_briefing

    data = build_briefing(db, created_by=user.username, username=user.username)
    return True, "已生成今日 AI 简报", f"简报已生成并沉淀到首页动态：#{data['id']} {data['title']}"


def tool_save_feed_card(db: Session, user: User, args: dict) -> tuple[bool, str, str]:
    title = str(args.get("title") or "").strip()
    content = str(args.get("content") or "").strip()
    if not content:
        return False, "内容为空", "错误：content 不能为空"
    card = FeedCard(
        kind="ai", title=(title or "AI 助手分享")[:200], content=content,
        summary=content.replace("\n", " ")[:150], ref_type="chat", created_by=user.username,
    )
    db.add(card)
    db.commit()
    return True, f"已沉淀内容卡「{card.title[:30]}」", f"内容卡已发布：#{card.id}"


# ── 特殊工具（由 agent_service 拦截，不真正执行） ─────────────


def tool_ask_user(db: Session, user: User, args: dict) -> tuple[bool, str, str]:
    return True, "", ""  # 占位：ask_user 在 agent_service 中走 waiting_input 分支


ToolDef = dict  # {"name","description","parameters","handler","write","summary_args"}

TOOLS: dict[str, ToolDef] = {}


def _register(name: str, description: str, parameters: dict, handler: Callable,
              write: bool, summary_args: list[str]):
    TOOLS[name] = {
        "name": name, "description": description, "parameters": parameters,
        "handler": handler, "write": write, "summary_args": summary_args,
    }


_register("search_platform",
          "全文搜索平台内容（资源/笔记/资讯），了解平台上有什么时先调它",
          {"type": "object", "properties": {
              "query": {"type": "string", "description": "搜索词，支持中文"},
              "limit": {"type": "integer", "description": "返回条数，默认 6"}},
           "required": ["query"]},
          tool_search_platform, write=False, summary_args=["query"])

_register("list_resources",
          "列出资源库条目，可按类型/关键词筛选",
          {"type": "object", "properties": {
              "type": {"type": "string", "enum": ["skill", "tool", "plugin"]},
              "keyword": {"type": "string"},
              "limit": {"type": "integer"}},
           "required": []},
          tool_list_resources, write=False, summary_args=["type", "keyword"])

_register("get_resource",
          "读取某个资源的完整详情（简介/标签/详情正文）",
          {"type": "object", "properties": {
              "resource_id": {"type": "integer", "description": "资源 id"}},
           "required": ["resource_id"]},
          tool_get_resource, write=False, summary_args=["resource_id"])

_register("list_memos",
          "列出笔记（可按关键词筛选），别人的笔记也可读",
          {"type": "object", "properties": {
              "keyword": {"type": "string"}, "limit": {"type": "integer"}},
           "required": []},
          tool_list_memos, write=False, summary_args=["keyword"])

_register("read_memo",
          "读取某条笔记的完整内容",
          {"type": "object", "properties": {
              "memo_id": {"type": "integer"}},
           "required": ["memo_id"]},
          tool_read_memo, write=False, summary_args=["memo_id"])

_register("list_comments",
          "读取某资源下的评论区讨论（了解大家的使用反馈）",
          {"type": "object", "properties": {
              "resource_id": {"type": "integer"},
              "limit": {"type": "integer"}},
           "required": ["resource_id"]},
          tool_list_comments, write=False, summary_args=["resource_id"])

_register("search_notes_links",
          "检索平台收藏的 HCL Notes 链接库（标题/数据库/文档）",
          {"type": "object", "properties": {
              "keyword": {"type": "string"}, "limit": {"type": "integer"}},
           "required": []},
          tool_search_notes_links, write=False, summary_args=["keyword"])

_register("get_briefing",
          "读取最新（或指定 id 的）AI 每日简报全文",
          {"type": "object", "properties": {
              "briefing_id": {"type": "integer", "description": "不传则返回最新一份"}},
           "required": []},
          tool_get_briefing, write=False, summary_args=["briefing_id"])

_register("list_rss_items",
          "列出最新抓取的 RSS 资讯条目",
          {"type": "object", "properties": {
              "limit": {"type": "integer"}},
           "required": []},
          tool_list_rss_items, write=False, summary_args=["limit"])

_register("create_memo",
          "创建一条新笔记（Markdown），写入者是当前用户",
          {"type": "object", "properties": {
              "title": {"type": "string"},
              "content": {"type": "string", "description": "Markdown 正文"},
              "tags": {"type": "array", "items": {"type": "string"}}},
           "required": ["title", "content"]},
          tool_create_memo, write=True, summary_args=["title"])

_register("append_to_memo",
          "向已有笔记末尾追加一段 Markdown 内容（不覆盖原文）",
          {"type": "object", "properties": {
              "memo_id": {"type": "integer"},
              "content": {"type": "string", "description": "要追加的 Markdown"}},
           "required": ["memo_id", "content"]},
          tool_append_to_memo, write=True, summary_args=["memo_id"])

_register("bookmark_resource",
          "收藏/取消收藏一个资源（toggle）",
          {"type": "object", "properties": {
              "resource_id": {"type": "integer"}},
           "required": ["resource_id"]},
          tool_bookmark_resource, write=True, summary_args=["resource_id"])

_register("generate_briefing",
          "抓取最新资讯并生成今日 AI 简报，沉淀到首页动态",
          {"type": "object", "properties": {}, "required": []},
          tool_generate_briefing, write=True, summary_args=[])

_register("save_feed_card",
          "把一段内容沉淀为首页内容卡（全员可见）",
          {"type": "object", "properties": {
              "title": {"type": "string"},
              "content": {"type": "string", "description": "Markdown 正文"}},
           "required": ["content"]},
          tool_save_feed_card, write=True, summary_args=["title"])

_register("ask_user",
          "当信息不足或需要用户决策时，向用户提出一个具体问题（最多 4 个选项）",
          {"type": "object", "properties": {
              "question": {"type": "string"},
              "options": {"type": "array", "items": {"type": "string"},
                          "description": "可选的候选回答"}},
           "required": ["question"]},
          tool_ask_user, write=False, summary_args=["question"])


def openai_schema() -> list[dict]:
    """导出为 OpenAI tools 参数格式"""
    return [{"type": "function",
             "function": {"name": t["name"], "description": t["description"],
                          "parameters": t["parameters"]}}
            for t in TOOLS.values()]


def args_digest(tool: str, args: dict) -> str:
    """一行参数摘要（任务卡/审计用）"""
    t = TOOLS.get(tool)
    if not t:
        return json.dumps(args, ensure_ascii=False)[:120]
    parts = [f"{k}={str(args.get(k, ''))[:60]}" for k in t["summary_args"]]
    return f"{tool}({', '.join(parts)})" if parts else tool
