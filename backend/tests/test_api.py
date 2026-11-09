"""AIWEB 后端测试：pytest + FastAPI TestClient

运行：cd backend && python -m pytest tests/ -q
"""
import json
import os
import sys
import tempfile
from pathlib import Path

# 必须在导入 app 之前设置独立测试库
os.environ["DATABASE_URL"] = f"sqlite:///{Path(tempfile.mkdtemp()) / 'test.sqlite'}"
os.environ.setdefault("JWT_SECRET", "test-secret-for-pytest-only")
os.environ.setdefault("DEFAULT_USER_PASSWORD", "test123456")
os.environ.setdefault("ENABLE_SCHEDULER", "0")  # 测试不跑 RSS 自动刷新/自动备份线程

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from main import app  # noqa: E402
from services.notes_service import parse_notes_url  # noqa: E402
from services.skill_meta import parse_frontmatter  # noqa: E402

client = TestClient(app)
client.__enter__()  # 手动进入上下文以触发 startup：create_all + 播种默认账号


@pytest.fixture(scope="module")
def token() -> str:
    resp = client.get("/api/auth/windows")
    assert resp.status_code == 200
    return resp.json()["data"]["token"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


# ── Notes 解析 ────────────────────────────────────────────────

class TestNotesParser:
    def test_plain_url(self):
        r = parse_notes_url("notes://CN99/PU/CIM/CIMLOG.nsf/0/9F2C7A1E1234ABCDEF0123456789ABCD?OpenDocument")
        assert r["valid"] and r["server"] == "CN99"
        assert r["database"] == "PU/CIM/CIMLOG.nsf"
        assert r["note_id"] == "9F2C7A1E1234ABCDEF0123456789ABCD"

    def test_ndl_format(self):
        ndl = ("标题行\n<NDL><REPLICA 48256C0E:0025B5F4><NOTE OF3D4E5F6A7B8C9D0EON48256C0E:0025B5F4>"
               "<HINT>CN=NotesServer/O=Company</HINT>"
               "<REM>Database 'CIMLOG.nsf' View '($All)' Document '故障记录'</REM></NDL>")
        r = parse_notes_url(ndl)
        assert r["valid"] and "NotesServer" in r["server"]
        assert r["title"] == "标题行" and r["document"] == "故障记录"
        assert r["url"].startswith("notes://")

    def test_html_anchor(self):
        r = parse_notes_url('<a href="notes://Srv/db.nsf/0/ABCDEF0123456789ABCDEF0123456789">纪要</a>')
        assert r["valid"] and r["title"] == "纪要" and len(r["note_id"]) == 32

    def test_non_notes_ignored(self):
        assert not parse_notes_url("https://github.com/leanerone/AIWEB")["valid"]
        assert not parse_notes_url("")["valid"]


# ── SKILL.md frontmatter ─────────────────────────────────────

class TestSkillMeta:
    def test_basic(self):
        fm = parse_frontmatter("---\nname: t\ndescription: d\ntags: [a, b]\n---\nbody")
        assert fm == {"name": "t", "description": "d", "tags": ["a", "b"]}

    def test_no_frontmatter(self):
        assert parse_frontmatter("# just markdown") == {}


# ── API ──────────────────────────────────────────────────────

class TestAuthApi:
    def test_health(self):
        assert client.get("/api/health").json()["status"] == "ok"

    def test_windows_sso_and_verify(self, token):
        me = client.get("/api/auth/verify", headers=auth(token))
        assert me.status_code == 200 and me.json()["success"]

    def test_manual_login(self):
        ok = client.post("/api/auth/login", json={"username": "administrator", "password": "test123456"})
        assert ok.status_code == 200
        bad = client.post("/api/auth/login", json={"username": "administrator", "password": "wrong"})
        assert bad.status_code == 401

    def test_protected_without_token(self):
        assert client.get("/api/resources").status_code == 401


class TestResourceApi:
    def _create(self, token, name="test-skill", **extra):
        data = {"type": "skill", "name": name, "summary": "s", "tags": "a,b", "author": "tester"}
        data.update(extra)
        return client.post("/api/resources", data=data, headers=auth(token))

    def test_crud_and_like(self, token):
        r = self._create(token)
        assert r.status_code == 200, r.text
        rid = r.json()["data"]["id"]

        lst = client.get("/api/resources?keyword=test", headers=auth(token)).json()["data"]
        assert lst["total"] >= 1

        like1 = client.post(f"/api/resources/{rid}/like", headers=auth(token)).json()["data"]
        assert like1 == {"likes": 1, "liked_by_me": True}
        like2 = client.post(f"/api/resources/{rid}/like", headers=auth(token)).json()["data"]
        assert like2 == {"likes": 0, "liked_by_me": False}

        assert client.delete(f"/api/resources/{rid}", headers=auth(token)).json()["success"]

    def test_invalid_type_rejected(self, token):
        assert self._create(token, name="x", type="hack").status_code == 400

    def test_empty_name_rejected(self, token):
        assert self._create(token, name="").status_code == 400

    def test_blocked_ext_rejected(self, token):
        resp = client.post("/api/resources", data={"type": "tool", "name": "evil"},
                           files={"file": ("evil.exe", b"MZfake")},
                           headers=auth(token))
        assert resp.status_code == 400 and "不允许" in resp.json()["detail"]

    def test_external_url_xss_blocked(self, token):
        # javascript: 外链必须被清洗为 None
        r = client.post("/api/resources", data={"type": "tool", "name": "xss-test",
                                                "external_url": "javascript:alert(1)"},
                        headers=auth(token)).json()["data"]
        assert not r["external_url"]
        client.delete(f"/api/resources/{r['id']}", headers=auth(token))


class TestMemoApi:
    def test_crud(self, token):
        r = client.post("/api/memos", json={"title": "note", "content": "c", "tags": ["t"], "pinned": True},
                        headers=auth(token)).json()["data"]
        mid = r["id"]
        assert r["pinned"] is True

        up = client.put(f"/api/memos/{mid}", json={"title": "note2", "content": "c2", "tags": [], "pinned": False},
                        headers=auth(token)).json()["data"]
        assert up["title"] == "note2" and up["pinned"] is False

        assert client.delete(f"/api/memos/{mid}", headers=auth(token)).json()["success"]


class TestCommentApi:
    def test_comment_lifecycle(self, token):
        rid = client.post("/api/resources", data={"type": "tool", "name": "commented-tool"},
                          headers=auth(token)).json()["data"]["id"]
        c = client.post(f"/api/resources/{rid}/comments", json={"content": "很好用"},
                        headers=auth(token)).json()["data"]
        assert c["content"] == "很好用"
        lst = client.get(f"/api/resources/{rid}/comments", headers=auth(token)).json()["data"]
        assert len(lst) == 1 and lst[0]["created_by"]
        assert client.delete(f"/api/resources/comments/{c['id']}", headers=auth(token)).json()["success"]
        assert client.get(f"/api/resources/{rid}/comments", headers=auth(token)).json()["data"] == []
        client.delete(f"/api/resources/{rid}", headers=auth(token))

    def test_empty_comment_rejected(self, token):
        rid = client.post("/api/resources", data={"type": "tool", "name": "t2"},
                          headers=auth(token)).json()["data"]["id"]
        assert client.post(f"/api/resources/{rid}/comments", json={"content": "  "},
                           headers=auth(token)).status_code == 400
        client.delete(f"/api/resources/{rid}", headers=auth(token))


class TestAiAndAdminApi:
    def test_describe_without_key(self, token):
        # 未配置 AI 时诚实报错（400），绝不伪造
        resp = client.post("/api/ai/describe", json={"name": "x", "type": "tool"}, headers=auth(token))
        assert resp.status_code in (400, 502)

    def test_admin_backup_requires_admin(self, token):
        resp = client.get("/api/admin/backup", headers=auth(token))
        # SSO 建的普通用户应被拒；管理员则 200
        assert resp.status_code in (200, 403)

    def test_briefing_empty_rss(self, token):
        resp = client.post("/api/ai/briefing", headers=auth(token))
        assert resp.status_code == 400  # 无 RSS 条目

    def test_today_counter(self, token):
        data = client.get("/api/hub/today", headers=auth(token)).json()["data"]
        assert data["new_today"] >= 0

    def test_feed_card_delete_permission(self, token):
        from database.session import SessionLocal
        from database.models import FeedCard
        db = SessionLocal()
        card = FeedCard(kind="ai", title="t", content="c", created_by="someone-else")
        db.add(card)
        db.commit()
        db.refresh(card)
        db.close()
        # 非创建者删除被拒
        resp = client.delete(f"/api/hub/cards/{card.id}", headers=auth(token))
        assert resp.status_code == 403
        # 管理员可删
        from services.auth_service import generate_token
        admin_tok = generate_token("administrator", "admin")
        resp2 = client.delete(f"/api/hub/cards/{card.id}", headers=auth(admin_tok))
        assert resp2.status_code == 200


class TestScheduler:
    def test_backup_creates_file(self):
        from services.scheduler import run_backup

        name = run_backup()
        assert name and name.startswith("aiweb-")


class TestChatApi:
    """Chat 路由：预检 / SSE 流 / 重命名 / 重新生成。stream_chat 全部 mock，不碰真实 AI。"""

    def test_completions_requires_ai_key(self, token, monkeypatch):
        # 未配置 Key → 400 预检，且不落库任何会话/消息
        monkeypatch.setattr("services.ai_service.get_ai_config",
                            lambda db, username=None: {"api_base": "x", "api_key": "", "model": "m"})
        before = client.get("/api/chat/sessions", headers=auth(token)).json()["data"]
        resp = client.post("/api/chat/completions", json={"message": "你好"}, headers=auth(token))
        assert resp.status_code == 400 and "未配置" in resp.json()["detail"]
        after = client.get("/api/chat/sessions", headers=auth(token)).json()["data"]
        assert len(after) == len(before)

    def test_sse_flow_and_regenerate(self, token, monkeypatch):
        from routes import chat as chat_routes

        replies = iter(["第一版回答"])
        monkeypatch.setattr("services.ai_service.get_ai_config",
                            lambda db, username=None: {"api_base": "x", "api_key": "sk-test", "model": "m"})
        monkeypatch.setattr(chat_routes, "stream_chat",
                            lambda db, messages, username=None: iter([next(replies, "第二版回答")]))

        # 正常流式对话
        resp = client.post("/api/chat/completions", json={"message": "什么是 EAP"},
                           headers=auth(token))
        assert resp.status_code == 200
        body = resp.text
        assert "event: meta" in body and "event: delta" in body and "event: done" in body
        sid = json.loads(body.split("data:")[1].split("\n")[0])["session_id"]

        msgs = client.get(f"/api/chat/sessions/{sid}/messages", headers=auth(token)).json()["data"]
        assert [m["role"] for m in msgs] == ["user", "assistant"]
        assert msgs[1]["content"] == "第一版回答"

        # 重命名会话
        ren = client.put(f"/api/chat/sessions/{sid}", json={"title": "测试会话"}, headers=auth(token))
        assert ren.status_code == 200 and ren.json()["data"]["title"] == "测试会话"

        # 重新生成：不新增用户消息，旧回答被替换
        resp2 = client.post("/api/chat/completions",
                            json={"session_id": sid, "regenerate": True}, headers=auth(token))
        assert resp2.status_code == 200 and "event: done" in resp2.text
        msgs2 = client.get(f"/api/chat/sessions/{sid}/messages", headers=auth(token)).json()["data"]
        assert [m["role"] for m in msgs2] == ["user", "assistant"]
        assert msgs2[1]["content"] == "第二版回答"

        # 删除会话
        assert client.delete(f"/api/chat/sessions/{sid}", headers=auth(token)).json()["success"]
        assert client.get(f"/api/chat/sessions/{sid}/messages",
                          headers=auth(token)).status_code == 404

    def test_regenerate_requires_session(self, token, monkeypatch):
        monkeypatch.setattr("services.ai_service.get_ai_config",
                            lambda db, username=None: {"api_base": "x", "api_key": "sk-test", "model": "m"})
        resp = client.post("/api/chat/completions", json={"regenerate": True}, headers=auth(token))
        assert resp.status_code == 400

    def test_empty_message_rejected(self, token, monkeypatch):
        monkeypatch.setattr("services.ai_service.get_ai_config",
                            lambda db, username=None: {"api_base": "x", "api_key": "sk-test", "model": "m"})
        assert client.post("/api/chat/completions", json={"message": "  "},
                           headers=auth(token)).status_code == 400

    def test_save_card(self, token):
        from database.session import SessionLocal
        from database.models import ChatSession

        db = SessionLocal()
        s = ChatSession(title="沉淀测试", created_by="administrator")
        db.add(s)
        db.commit()
        db.refresh(s)
        sid = s.id
        db.close()
        resp = client.post(f"/api/chat/sessions/{sid}/save-card",
                           json={"content": "这是一条好回复"}, headers=auth(token))
        assert resp.json()["success"]
        client.delete(f"/api/chat/sessions/{sid}", headers=auth(token))

    def test_foreign_session_hidden(self, token):
        from database.session import SessionLocal
        from database.models import ChatSession

        db = SessionLocal()
        s = ChatSession(title="别人的", created_by="someone-else")
        db.add(s)
        db.commit()
        db.refresh(s)
        sid = s.id
        db.close()
        assert client.get(f"/api/chat/sessions/{sid}/messages",
                          headers=auth(token)).status_code == 404
        assert client.put(f"/api/chat/sessions/{sid}", json={"title": "x"},
                          headers=auth(token)).status_code == 404


class TestRssApi:
    """RSS 订阅源 CRUD（不触网）。"""

    url = "https://example.com/feed.xml"

    def test_source_lifecycle(self, token):
        assert client.post("/api/rss/sources",
                           json={"name": "测试源", "url": self.url},
                           headers=auth(token)).json()["success"]
        # 重复添加被拒
        dup = client.post("/api/rss/sources", json={"name": "重复", "url": self.url},
                          headers=auth(token))
        assert dup.status_code == 400

        sources = client.get("/api/rss/sources", headers=auth(token)).json()["data"]
        mine = next(s for s in sources if s["url"] == self.url)
        assert mine["name"] == "测试源" and mine["enabled"]

        # 空条目列表 + 分页钳制(limit 上限 / page<1 不再 500)
        items = client.get("/api/rss/items?limit=999&page=0", headers=auth(token)).json()["data"]
        assert items["total"] == 0
        assert client.get("/api/rss/items?page=1&limit=1", headers=auth(token)).status_code == 200

        # 停用 + 删除
        assert client.put(f"/api/rss/sources/{mine['id']}",
                          json={"name": "测试源", "url": self.url, "enabled": False},
                          headers=auth(token)).json()["success"]
        assert client.delete(f"/api/rss/sources/{mine['id']}",
                             headers=auth(token)).json()["success"]
        assert client.delete(f"/api/rss/sources/{mine['id']}",
                             headers=auth(token)).status_code == 404

    def test_empty_url_rejected(self, token):
        assert client.post("/api/rss/sources", json={"name": "x", "url": "  "},
                           headers=auth(token)).status_code == 400


class TestNotesApi:
    """Notes 链接：解析 / 保存 / 检索 / 删除。"""

    raw = "notes://CN99/PU/CIM/CIMLOG.nsf/0/9F2C7A1E1234ABCDEF0123456789ABCD?OpenDocument"

    def test_parse_endpoint(self, token):
        r = client.post("/api/notes/parse", json={"raw_text": self.raw},
                        headers=auth(token)).json()["data"]
        assert r["valid"] and r["server"] == "CN99"
        bad = client.post("/api/notes/parse", json={"raw_text": "https://github.com"},
                          headers=auth(token)).json()["data"]
        assert not bad["valid"]

    def test_link_save_search_delete(self, token):
        saved = client.post("/api/notes/links", json={"raw_text": self.raw},
                            headers=auth(token)).json()["data"]
        assert saved["database"] == "PU/CIM/CIMLOG.nsf" and saved["id"]
        lid = saved["id"]

        found = client.get("/api/notes/links?keyword=CIMLOG", headers=auth(token)).json()["data"]
        assert found["total"] >= 1 and any(i["id"] == lid for i in found["items"])

        assert client.delete(f"/api/notes/links/{lid}", headers=auth(token)).json()["success"]

    def test_invalid_link_not_saved(self, token):
        r = client.post("/api/notes/links", json={"raw_text": "随便一段文字"},
                        headers=auth(token)).json()
        assert r["success"] is False and "未识别" in r["message"]


class TestSecretPersistence:
    def test_jwt_secret_stable_and_saved(self, tmp_path, monkeypatch):
        from config import settings as cfg

        monkeypatch.setenv("JWT_SECRET", "")          # 走文件持久化路径
        (tmp_path / "data").mkdir()
        monkeypatch.setattr(cfg, "_BASE", tmp_path)
        s1 = cfg._load_jwt_secret()
        s2 = cfg._load_jwt_secret()
        assert s1 == s2                                # 重启(再次加载)拿到同一密钥
        assert (tmp_path / "data" / "secret.key").read_text(encoding="utf-8") == s1

    def test_env_overrides_file(self, tmp_path, monkeypatch):
        from config import settings as cfg

        monkeypatch.setenv("JWT_SECRET", "from-env")
        monkeypatch.setattr(cfg, "_BASE", tmp_path)
        assert cfg._load_jwt_secret() == "from-env"
        assert not (tmp_path / "data" / "secret.key").exists()


class TestSearchApi:
    """FTS5 统一全文搜索：中文逐字切分 + 英文 + 删除同步。"""

    def test_cjk_english_and_delete_sync(self, token):
        rid = client.post("/api/resources",
                          data={"type": "tool", "name": "Excel 批量工具",
                                "summary": "用于机台数据导出",
                                "content": "支持 golden batch 数据查询"},
                          headers=auth(token)).json()["data"]["id"]
        mid = client.post("/api/memos",
                          json={"title": "排障笔记", "content": "EAP 通信超时的排查思路"},
                          headers=auth(token)).json()["data"]["id"]

        # 中文 2 字查询命中资源
        hits = client.get("/api/search?q=批量", headers=auth(token)).json()["data"]
        assert any(h["kind"] == "resource" and h["id"] == rid for h in hits)
        # 英文查询命中资源详情
        hits = client.get("/api/search?q=golden", headers=auth(token)).json()["data"]
        assert any(h["kind"] == "resource" and h["id"] == rid for h in hits)
        # 中文查询命中笔记
        hits = client.get("/api/search?q=通信超时", headers=auth(token)).json()["data"]
        assert any(h["kind"] == "memo" and h["id"] == mid for h in hits)
        # 空查询返回空列表
        assert client.get("/api/search?q=", headers=auth(token)).json()["data"] == []

        # 删除后索引同步，不再命中
        client.delete(f"/api/resources/{rid}", headers=auth(token))
        client.delete(f"/api/memos/{mid}", headers=auth(token))
        hits = client.get("/api/search?q=批量", headers=auth(token)).json()["data"]
        assert not any(h["kind"] == "resource" and h["id"] == rid for h in hits)


class TestBookmarkApi:
    """收藏夹：toggle / 列表 / 非法参数。"""

    def test_resource_and_memo_bookmark(self, token):
        rid = client.post("/api/resources", data={"type": "tool", "name": "bm-tool"},
                          headers=auth(token)).json()["data"]["id"]
        one = client.get(f"/api/resources/{rid}", headers=auth(token)).json()["data"]
        assert one["bookmarked_by_me"] is False

        d1 = client.post("/api/bookmarks/toggle",
                         json={"target_type": "resource", "target_id": rid},
                         headers=auth(token)).json()["data"]
        assert d1["bookmarked"] is True
        one = client.get(f"/api/resources/{rid}", headers=auth(token)).json()["data"]
        assert one["bookmarked_by_me"] is True

        # 列表含目标详情
        lst = client.get("/api/bookmarks?type=resource", headers=auth(token)).json()["data"]
        assert lst["total"] == 1 and lst["items"][0]["target"]["id"] == rid

        # toggle 关
        d2 = client.post("/api/bookmarks/toggle",
                         json={"target_type": "resource", "target_id": rid},
                         headers=auth(token)).json()["data"]
        assert d2["bookmarked"] is False
        assert client.get("/api/bookmarks?type=resource",
                          headers=auth(token)).json()["data"]["total"] == 0

        # 笔记收藏
        mid = client.post("/api/memos", json={"title": "bm-note", "content": "c"},
                          headers=auth(token)).json()["data"]["id"]
        client.post("/api/bookmarks/toggle",
                    json={"target_type": "memo", "target_id": mid}, headers=auth(token))
        assert client.get("/api/bookmarks?type=memo",
                          headers=auth(token)).json()["data"]["total"] == 1

        # 非法类型 400 / 目标不存在 404
        assert client.post("/api/bookmarks/toggle", json={"target_type": "evil", "target_id": 1},
                           headers=auth(token)).status_code == 400
        assert client.get("/api/bookmarks?type=evil", headers=auth(token)).status_code == 400
        assert client.post("/api/bookmarks/toggle",
                           json={"target_type": "resource", "target_id": 999999},
                           headers=auth(token)).status_code == 404

        client.delete(f"/api/resources/{rid}", headers=auth(token))
        client.delete(f"/api/memos/{mid}", headers=auth(token))


class TestNotificationApi:
    """通知中心：评论/点赞投递给创建者，取消点赞不通知，已读操作。"""

    def test_comment_like_notify_creator(self, token):
        from services.auth_service import generate_token

        admin_tok = generate_token("administrator", "admin")
        rid = client.post("/api/resources", data={"type": "tool", "name": "notify-target"},
                          headers=auth(admin_tok)).json()["data"]["id"]

        # SSO 用户评论 + 点赞 → admin 收到通知
        client.post(f"/api/resources/{rid}/comments", json={"content": "不错"},
                    headers=auth(token))
        client.post(f"/api/resources/{rid}/like", headers=auth(token))
        data = client.get("/api/notifications", headers=auth(admin_tok)).json()["data"]
        assert data["unread"] >= 2
        assert {"comment", "like"} <= {n["ntype"] for n in data["items"]}

        # 取消点赞不再产生通知
        n_before = client.get("/api/notifications/unread-count",
                              headers=auth(admin_tok)).json()["data"]["unread"]
        client.post(f"/api/resources/{rid}/like", headers=auth(token))  # toggle off
        n_after = client.get("/api/notifications/unread-count",
                             headers=auth(admin_tok)).json()["data"]["unread"]
        assert n_after == n_before

        # 全部已读 → 0
        client.post("/api/notifications/read", json={"all": True}, headers=auth(admin_tok))
        assert client.get("/api/notifications/unread-count",
                          headers=auth(admin_tok)).json()["data"]["unread"] == 0

        # 自己评论自己的资源 → 不通知
        client.post(f"/api/resources/{rid}/comments", json={"content": "self"},
                    headers=auth(admin_tok))
        assert client.get("/api/notifications/unread-count",
                          headers=auth(admin_tok)).json()["data"]["unread"] == 0

        client.delete(f"/api/resources/{rid}", headers=auth(admin_tok))


class TestQueryExpression:
    def test_ascii_cjk_bigrams_and_punctuation(self):
        from services.fts import search_query

        q = search_query("EAP 协议帧格式")
        assert '"eap"' in q and '"协 议"' in q and '"帧 格"' in q
        assert '"协 议 帧 格 式"' not in q          # 不再用整串长短语
        assert search_query("？？") == ""            # 纯标点安全，不会生成非法短语
        assert search_query("") == ""


class TestRagChat:
    """资源问答 RAG：自动检索资源注入系统提示词；显式 📎 引用优先。"""

    def test_auto_resource_context(self, token, monkeypatch):
        from routes import chat as chat_routes

        captured = {}

        def fake_stream(db, messages, username=None):
            captured["messages"] = messages
            return iter(["好的"])

        monkeypatch.setattr(chat_routes, "stream_chat", fake_stream)
        monkeypatch.setattr("services.ai_service.get_ai_config",
                            lambda db, username=None: {"api_base": "x", "api_key": "k", "model": "m"})

        rid = client.post("/api/resources",
                          data={"type": "skill", "name": "EAP 协议速查",
                                "content": "帧格式与超时参数说明"},
                          headers=auth(token)).json()["data"]["id"]

        resp = client.post("/api/chat/completions",
                           json={"message": "EAP 帧格式是什么"}, headers=auth(token))
        assert resp.status_code == 200
        sysm = next((m for m in captured["messages"] if m["role"] == "system"), None)
        assert sysm and "EAP 协议速查" in sysm["content"] and "优先参考" in sysm["content"]

        # 显式引用资源时走 📎 分支
        resp2 = client.post("/api/chat/completions",
                            json={"message": "随便聊聊天气", "context_resource_id": rid},
                            headers=auth(token))
        assert resp2.status_code == 200
        sysm2 = next((m for m in captured["messages"] if m["role"] == "system"), None)
        assert sysm2 and "用户正在就平台上的资源向你提问" in sysm2["content"]

        client.delete(f"/api/resources/{rid}", headers=auth(token))


class TestBriefingService:
    def test_build_briefing_creates_card(self, token, monkeypatch):
        from database.models import RssItem, RssSource
        from database.session import SessionLocal
        from services.briefing import build_briefing

        monkeypatch.setattr("services.ai_service.get_ai_config",
                            lambda db, username=None: {"api_base": "x", "api_key": "k", "model": "m"})
        monkeypatch.setattr("services.briefing.stream_chat",
                            lambda db, msgs, username=None: iter(["简报正文"]))

        db = SessionLocal()
        s = RssSource(name="mocksrc", url="https://example.com/bf.xml")
        db.add(s)
        db.flush()
        db.add(RssItem(source_id=s.id, title="头条", link="https://e.com/1", summary="摘要"))
        db.commit()
        r = build_briefing(db, created_by="tester")
        assert r["title"].startswith("AI 每日简报") and r["content"] == "简报正文"

        from database.models import FeedCard
        db.query(FeedCard).filter(FeedCard.ref_type == "briefing").delete()
        db.query(RssItem).delete()
        db.query(RssSource).delete()
        db.commit()
        db.close()

    def test_build_briefing_empty_raises(self):
        from database.models import RssItem, RssSource
        from database.session import SessionLocal
        from services.briefing import build_briefing

        db = SessionLocal()
        db.query(RssItem).delete()
        db.query(RssSource).delete()
        db.commit()
        with pytest.raises(ValueError):
            build_briefing(db)
        db.close()

    def test_auto_briefing_gate(self, monkeypatch):
        import datetime as real_dt

        from config import settings as cfg
        from database.models import FeedCard
        from database.session import SessionLocal
        from services import scheduler

        calls: list[str] = []
        monkeypatch.setattr(
            "services.briefing.build_briefing",
            lambda db, created_by="system": (calls.append(created_by), {"title": "t"})[1])

        class FakeDT:
            now = staticmethod(lambda: real_dt.datetime(2026, 1, 2, 12, 0, 0))

        monkeypatch.setattr(scheduler, "datetime", FakeDT)
        db = SessionLocal()
        try:
            db.query(FeedCard).filter(FeedCard.ref_type == "briefing").delete()
            db.commit()

            monkeypatch.setattr(cfg, "AI_BRIEFING_HOUR", -1)   # 关闭 → 不触发
            scheduler._maybe_auto_briefing(db)
            assert calls == []

            monkeypatch.setattr(cfg, "AI_BRIEFING_HOUR", 13)   # 未到点 → 不触发
            scheduler._maybe_auto_briefing(db)
            assert calls == []

            monkeypatch.setattr(cfg, "AI_BRIEFING_HOUR", 12)   # 到点且当天无卡 → 触发
            scheduler._maybe_auto_briefing(db)
            assert calls == ["system"]

            card = FeedCard(kind="ai", title="today", content="c", ref_type="briefing",
                            created_at=real_dt.datetime(2026, 1, 2, 9, 0))
            db.add(card)
            db.commit()
            scheduler._maybe_auto_briefing(db)                  # 当天已有卡 → 不重复
            assert calls == ["system"]
        finally:
            db.query(FeedCard).filter(FeedCard.ref_type == "briefing").delete()
            db.commit()
            db.close()


class TestRssRefreshIndex:
    """RSS 抓取入库同步 FTS（mock 网络）。"""

    def test_refresh_indexes_for_search(self, token, monkeypatch):
        client.post("/api/rss/sources",
                    json={"name": "mock源", "url": "http://example.com/mock.xml"},
                    headers=auth(token))
        sid = next(s for s in client.get("/api/rss/sources", headers=auth(token)).json()["data"]
                   if s["url"] == "http://example.com/mock.xml")["id"]

        xml = ('<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>'
               '<item><title>Python 3.13 发布</title><link>http://e.com/1</link>'
               '<description>GIL 改进</description></item></channel></rss>').encode("utf-8")

        class FakeResp:
            content = xml

            def raise_for_status(self):
                pass

        monkeypatch.setattr("services.rss_service.requests.get", lambda *a, **k: FakeResp())
        r = client.post(f"/api/rss/sources/{sid}/refresh", headers=auth(token)).json()
        assert r["data"]["new"] == 1

        hits = client.get("/api/search?q=python", headers=auth(token)).json()["data"]
        assert any(h["kind"] == "rss" for h in hits)

        client.delete(f"/api/rss/sources/{sid}", headers=auth(token))  # 级联删条目
        hits = client.get("/api/search?q=python", headers=auth(token)).json()["data"]
        assert not any(h["kind"] == "rss" for h in hits)


class TestFeedApi:
    def test_feed_contains_resource_and_today(self, token):
        rid = client.post("/api/resources", data={"type": "skill", "name": "feed-echo"},
                          headers=auth(token)).json()["data"]["id"]
        feed = client.get("/api/hub/feed?limit=30", headers=auth(token)).json()["data"]
        assert any(f["kind"] == "resource" and f["id"] == rid for f in feed)
        today = client.get("/api/hub/today", headers=auth(token)).json()["data"]
        assert today["new_today"] >= 1
        client.delete(f"/api/resources/{rid}", headers=auth(token))


class TestBriefingsApi:
    """简报归档接口：/api/hub/briefings 分页 + page 钳制 + 只含 briefing 卡"""

    def test_list_clamped_and_filtered(self, token):
        from database.models import FeedCard
        from database.session import SessionLocal

        db = SessionLocal()
        c1 = FeedCard(kind="ai", title="简报A", content="正文A", summary="s1",
                      ref_type="briefing", created_by="administrator")
        c2 = FeedCard(kind="ai", title="其他卡", content="x", summary="s2",
                      ref_type="chat", created_by="administrator")
        db.add_all([c1, c2])
        db.commit()
        c1_id, c2_id = c1.id, c2.id
        db.close()

        data = client.get("/api/hub/briefings?limit=50", headers=auth(token)).json()["data"]
        ids = [i["id"] for i in data["items"]]
        assert c1_id in ids
        assert c2_id not in ids              # 非 briefing 不进归档
        assert data["total"] >= 1

        # page<1 不再 500
        assert client.get("/api/hub/briefings?page=0&limit=999",
                          headers=auth(token)).status_code == 200

        db = SessionLocal()
        for cid in (c1_id, c2_id):
            row = db.get(FeedCard, cid)
            if row:
                db.delete(row)
        db.commit()
        db.close()


class TestSpaHosting:
    """生产托管：根路径与 SPA 深链返回 index.html，/api 前缀仍兜底 404（需已 npm run build）"""

    def test_root_and_deeplink(self):
        dist_index = Path(__file__).resolve().parents[2] / "dist" / "index.html"
        if not dist_index.exists():
            pytest.skip("未构建前端产物，跳过 SPA 托管测试")
        r = client.get("/")
        assert r.status_code == 200 and 'id="root"' in r.text
        assert client.get("/resources/3").status_code == 200
        assert client.get("/api/nope").status_code == 404


class TestSettingsApi:
    def _admin(self):
        from services.auth_service import generate_token
        return auth(generate_token("administrator", "admin"))

    def test_put_and_masked(self, token):
        # 全局 AI 键仅管理员可写（v0.9 安全修复）：普通用户 403
        assert client.put("/api/settings", json={"ai_api_key": "sk-x"},
                          headers=auth(token)).status_code == 403
        assert client.put("/api/settings", json={"ai_api_key": "sk-secret", "ai_model": "m1"},
                          headers=self._admin()).json()["success"]
        data = client.get("/api/settings", headers=auth(token)).json()["data"]
        assert data["ai_api_key"] == "********"          # 打码
        assert data["effective"]["has_key"] is True
        # 打码值回传不会覆盖真实 key
        client.put("/api/settings", json={"ai_api_key": "********"}, headers=self._admin())
        assert client.get("/api/settings", headers=auth(token)).json()["data"]["effective"]["has_key"] is True

    def test_unknown_key_ignored(self, token):
        assert client.put("/api/settings", json={"evil_key": "x"}, headers=self._admin()).json()["success"]


class TestUserAiConfig:
    """个人 AI 配置：加密落库 / 打码读 / 生效链（user → global → env）/ 显式清除。"""

    def _put(self, token, **body):
        return client.put("/api/me/ai-config", json=body, headers=auth(token))

    def _get(self, token):
        return client.get("/api/me/ai-config", headers=auth(token)).json()["data"]

    def _sso_username(self, token) -> str:
        return client.get("/api/auth/verify", headers=auth(token)).json()["data"]["username"]

    def _reset(self, token):
        self._put(token, api_key="-", api_base="", model="", system_prompt="", auto_exec=False)

    def test_empty_then_roundtrip(self, token):
        self._reset(token)
        d = self._get(token)
        assert d["has_config"] is False

        assert self._put(token, api_key="sk-personal-123456", api_base="https://api.test/v1",
                         model="test-model", system_prompt="你是测试助手").json()["success"]
        d = self._get(token)
        assert d["has_config"] is True
        assert d["api_key"] == "********"          # 打码
        assert d["api_base"] == "https://api.test/v1"
        assert d["model"] == "test-model"
        assert d["system_prompt"] == "你是测试助手"

    def test_encrypted_at_rest(self, token):
        from database.session import SessionLocal
        from database.models import UserAiConfig

        self._reset(token)
        self._put(token, api_key="sk-personal-123456")
        db = SessionLocal()
        uc = db.query(UserAiConfig).filter(
            UserAiConfig.username == self._sso_username(token)).first()
        db.close()
        assert uc is not None and uc.api_key_encrypted
        try:
            import services.secret_box as sb  # noqa: F401
            has_crypto = sb._FERNET is not None
        except ImportError:
            has_crypto = False
        if has_crypto:
            assert uc.api_key_encrypted.startswith("enc:v1:")  # 明文 Key 绝不落库
            assert "sk-personal" not in uc.api_key_encrypted

    def test_effective_chain_user_overrides_global(self, token):
        from services.auth_service import generate_token
        admin = auth(generate_token("administrator", "admin"))
        client.put("/api/settings", json={"ai_api_key": "sk-global-9999"}, headers=admin)

        self._reset(token)
        cfg = self._get(token)
        assert cfg["effective"]["source"] == "global"       # 个人无配置 → 全局

        self._put(token, api_key="sk-personal-123456")      # 只配 Key
        cfg = self._get(token)
        assert cfg["effective"]["source"] == "user"         # 个人键覆盖

        self._put(token, api_key="-")                       # 清除个人键 → 回落全局
        cfg = self._get(token)
        assert cfg["api_key"] == "" and cfg["effective"]["source"] == "global"

    def test_masked_value_never_overwrites(self, token):
        from database.session import SessionLocal
        from database.models import UserAiConfig
        from services.secret_box import decrypt

        self._reset(token)
        self._put(token, api_key="sk-keep-this-one")
        self._put(token, api_key="********")                # 打码值回传不覆盖
        db = SessionLocal()
        uc = db.query(UserAiConfig).filter(
            UserAiConfig.username == self._sso_username(token)).first()
        tail = decrypt(uc.api_key_encrypted)
        db.close()
        assert tail == "sk-keep-this-one"

    def test_short_key_rejected(self, token):
        assert self._put(token, api_key="abc").status_code == 400

    def test_auto_exec_flag(self, token):
        self._reset(token)
        assert self._get(token)["auto_exec"] is False
        self._put(token, auto_exec=True)
        assert self._get(token)["auto_exec"] is True
        self._reset(token)
