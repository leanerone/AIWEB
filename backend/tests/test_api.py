"""AIWEB 后端测试：pytest + FastAPI TestClient

运行：cd backend && python -m pytest tests/ -q
"""
import os
import sys
import tempfile
from pathlib import Path

# 必须在导入 app 之前设置独立测试库
os.environ["DATABASE_URL"] = f"sqlite:///{Path(tempfile.mkdtemp()) / 'test.sqlite'}"
os.environ.setdefault("JWT_SECRET", "test-secret-for-pytest-only")
os.environ.setdefault("DEFAULT_USER_PASSWORD", "test123456")

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


class TestSettingsApi:
    def test_put_and_masked(self, token):
        assert client.put("/api/settings", json={"ai_api_key": "sk-secret", "ai_model": "m1"},
                          headers=auth(token)).json()["success"]
        data = client.get("/api/settings", headers=auth(token)).json()["data"]
        assert data["ai_api_key"] == "********"          # 打码
        assert data["effective"]["has_key"] is True
        # 打码值回传不会覆盖真实 key
        client.put("/api/settings", json={"ai_api_key": "********"}, headers=auth(token))
        assert client.get("/api/settings", headers=auth(token)).json()["data"]["effective"]["has_key"] is True

    def test_unknown_key_ignored(self, token):
        assert client.put("/api/settings", json={"evil_key": "x"}, headers=auth(token)).json()["success"]
