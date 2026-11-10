"""数据模型：用户 / 资源库 / 笔记 / Notes 链接 / AI 会话 / RSS / 内容卡 / 设置 / 收藏 / 通知
/ 个人 AI 配置 / Agent 运行记录 / Agent 工具审计。"""
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.session import Base


def now():
    return datetime.now()


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(64), default="")
    password_hash: Mapped[str | None] = mapped_column(String(256), nullable=True)
    role: Mapped[str] = mapped_column(String(16), default="user")  # admin / user
    department: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class UserAiConfig(Base):
    """个人 AI 配置：每人自己的 Key/Base/模型/人设，加密落库。

    生效链：个人配置 → 全局 Setting KV（仅管理员可写）→ backend/.env。
    """

    __tablename__ = "user_ai_configs"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    api_base: Mapped[str] = mapped_column(String(256), default="")
    api_key_encrypted: Mapped[str] = mapped_column(String(1024), default="")
    model: Mapped[str] = mapped_column(String(128), default="")
    system_prompt: Mapped[str] = mapped_column(Text, default="")
    auto_exec: Mapped[bool] = mapped_column(Boolean, default=False)  # 写工具自动执行（observe/auto）
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)


class AgentRun(Base):
    """一次 Agent 运行（悬浮助手的多步任务）：状态机 running →
    waiting_confirm / waiting_input → running → done / failed / stopped。
    state 存完整对话+工具轨迹，resume 时从这里续跑。"""

    __tablename__ = "agent_runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("chat_sessions.id", ondelete="CASCADE"), index=True)
    username: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(20), default="running", index=True)
    state: Mapped[str] = mapped_column(Text, default="{}")  # JSON：messages / pending 工具调用等
    steps: Mapped[list] = mapped_column(JSON, default=list)  # 任务卡轨迹 [{tool, args_digest, ok, summary}]
    result: Mapped[str] = mapped_column(Text, default="")
    session: Mapped["ChatSession"] = relationship()  # 用于恢复时取会话标题
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)


class AgentToolCall(Base):
    """Agent 工具调用审计：谁在何时用什么参数调了什么工具（结果只存摘要）。"""

    __tablename__ = "agent_tool_calls"
    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("agent_runs.id", ondelete="CASCADE"), index=True)
    username: Mapped[str] = mapped_column(String(64), index=True)
    tool: Mapped[str] = mapped_column(String(64))
    args: Mapped[dict] = mapped_column(JSON, default=dict)
    ok: Mapped[bool] = mapped_column(Boolean, default=True)
    result_digest: Mapped[str] = mapped_column(String(512), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Resource(Base):
    """资源库条目：skill / tool / plugin"""

    __tablename__ = "resources"
    id: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[str] = mapped_column(String(16), index=True)  # skill / tool / plugin
    name: Mapped[str] = mapped_column(String(128), index=True)
    summary: Mapped[str] = mapped_column(Text, default="")
    content: Mapped[str] = mapped_column(Text, default="")  # Markdown 详情
    tags: Mapped[list] = mapped_column(JSON, default=list)
    author: Mapped[str] = mapped_column(String(64), default="")
    license: Mapped[str] = mapped_column(String(64), default="")  # MIT / Apache-2.0 / CC-BY-4.0…
    version: Mapped[str] = mapped_column(String(32), default="")
    # 来源：upload(有附件) / path(内网路径) / url(外链) / none
    source_type: Mapped[str] = mapped_column(String(16), default="none")
    file_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    file_name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    external_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    downloads: Mapped[int] = mapped_column(Integer, default=0)
    views: Mapped[int] = mapped_column(Integer, default=0)
    likes: Mapped[int] = mapped_column(Integer, default=0)
    liked_by: Mapped[list] = mapped_column(JSON, default=list)
    created_by: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)


class ResourceVersion(Base):
    """资源历史版本：每次更新前自动快照旧状态，可一键回滚。"""

    __tablename__ = "resource_versions"
    id: Mapped[int] = mapped_column(primary_key=True)
    resource_id: Mapped[int] = mapped_column(ForeignKey("resources.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(128), default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    content: Mapped[str] = mapped_column(Text, default="")
    tags: Mapped[list] = mapped_column(JSON, default=list)
    file_name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    external_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    updated_by: Mapped[str] = mapped_column(String(64), default="")  # 触发这次更新的人
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class ResourceComment(Base):
    """资源下的讨论/评论"""

    __tablename__ = "resource_comments"
    id: Mapped[int] = mapped_column(primary_key=True)
    resource_id: Mapped[int] = mapped_column(ForeignKey("resources.id", ondelete="CASCADE"), index=True)
    content: Mapped[str] = mapped_column(Text)
    created_by: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Memo(Base):
    """简单笔记"""

    __tablename__ = "memos"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(256), index=True)
    content: Mapped[str] = mapped_column(Text, default="")
    tags: Mapped[list] = mapped_column(JSON, default=list)
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)


class NoteLink(Base):
    """解析过的 HCL Notes 链接，便于复用与检索"""

    __tablename__ = "note_links"
    id: Mapped[int] = mapped_column(primary_key=True)
    raw_text: Mapped[str] = mapped_column(Text, default="")
    url: Mapped[str] = mapped_column(String(768), default="")
    title: Mapped[str] = mapped_column(String(512), default="")
    server: Mapped[str] = mapped_column(String(256), default="")
    database: Mapped[str] = mapped_column(String(512), default="")
    view: Mapped[str] = mapped_column(String(512), default="")
    document: Mapped[str] = mapped_column(String(512), default="")
    replica_id: Mapped[str] = mapped_column(String(64), default="")
    view_id: Mapped[str] = mapped_column(String(64), default="")
    note_id: Mapped[str] = mapped_column(String(64), default="")
    created_by: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class ChatSession(Base):
    __tablename__ = "chat_sessions"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(128), default="新对话")
    created_by: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", order_by="ChatMessage.id"
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("chat_sessions.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(16))  # user / assistant
    content: Mapped[str] = mapped_column(Text, default="")
    meta: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # Agent 模式：工具轨迹等
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    session: Mapped[ChatSession] = relationship(back_populates="messages")


class RssSource(Base):
    __tablename__ = "rss_sources"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    url: Mapped[str] = mapped_column(String(512), unique=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_fetch_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_error: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class RssItem(Base):
    __tablename__ = "rss_items"
    id: Mapped[int] = mapped_column(primary_key=True)
    source_id: Mapped[int] = mapped_column(ForeignKey("rss_sources.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(512))
    link: Mapped[str] = mapped_column(String(768), default="")
    summary: Mapped[str] = mapped_column(Text, default="")
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    source: Mapped[RssSource] = relationship()


class FeedCard(Base):
    """首页内容卡：AI 沉淀 / 精选笔记 / 公告等"""

    __tablename__ = "feed_cards"
    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(16), index=True)  # ai / note / announcement
    title: Mapped[str] = mapped_column(String(256))
    content: Mapped[str] = mapped_column(Text, default="")
    summary: Mapped[str] = mapped_column(String(512), default="")
    ref_type: Mapped[str | None] = mapped_column(String(16), nullable=True)
    ref_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(768), nullable=True)
    created_by: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Setting(Base):
    __tablename__ = "settings"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(Text, default="")


class Bookmark(Base):
    """用户收藏：资源 / 笔记"""

    __tablename__ = "bookmarks"
    __table_args__ = (UniqueConstraint("username", "target_type", "target_id", name="uq_bookmark"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), index=True)
    target_type: Mapped[str] = mapped_column(String(16))  # resource / memo
    target_id: Mapped[int] = mapped_column(Integer, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Notification(Base):
    """站内通知：评论 / 点赞 / 系统公告，按用户投递"""

    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), index=True)  # 收件人
    ntype: Mapped[str] = mapped_column(String(16), default="system")  # comment / like / system
    title: Mapped[str] = mapped_column(String(256))
    content: Mapped[str] = mapped_column(String(512), default="")
    ref_type: Mapped[str | None] = mapped_column(String(16), nullable=True)
    ref_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
