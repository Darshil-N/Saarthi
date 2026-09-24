from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from gotrue.errors import AuthApiError

import dependencies
import routers.auth as auth_router
from dependencies import get_supabase
from main import app
from tests.fake_supabase import FakeSupabase

USER_ID = "22222222-2222-2222-2222-222222222222"


class StubVerifier:
    """Stands in for the Supabase Auth client that validates access tokens."""

    def __init__(self, valid=None, error=None):
        self.valid, self.error, self.calls = valid or {}, error, 0
        self.auth = SimpleNamespace(get_user=self._get_user)

    def _get_user(self, token):
        self.calls += 1
        if self.error:
            raise self.error
        if token not in self.valid:
            raise AuthApiError("invalid JWT", 401, "bad_jwt")
        return SimpleNamespace(user=SimpleNamespace(id=self.valid[token], email="op@bharatoil.in"))


@pytest.fixture
def auth_db():
    fake = FakeSupabase()
    fake.seed("profiles", id=USER_ID, role="entry_operator", is_active=True, full_name="Op")
    return fake


@pytest.fixture
def api(auth_db, monkeypatch):
    verifier = StubVerifier(valid={"good": USER_ID})
    monkeypatch.setattr(dependencies, "_get_token_verifier", lambda: verifier)
    app.dependency_overrides[get_supabase] = lambda: auth_db
    with TestClient(app, raise_server_exceptions=False) as c:
        c.verifier = verifier
        yield c
    app.dependency_overrides.clear()


def bearer(token="good"):
    return {"Authorization": f"Bearer {token}"}


class TestGetCurrentUser:
    def test_missing_token_is_401(self, api):
        assert api.get("/vendors").status_code == 401

    def test_invalid_token_is_401_without_leaking_details(self, api):
        r = api.get("/vendors", headers=bearer("bad"))
        assert r.status_code == 401
        assert r.json()["detail"] == "Invalid or expired token"

    def test_auth_service_outage_is_503_not_401(self, api, monkeypatch):
        monkeypatch.setattr(dependencies, "_get_token_verifier", lambda: StubVerifier(error=ConnectionError("down")))
        assert api.get("/vendors", headers=bearer()).status_code == 503

    def test_valid_token_works(self, api):
        assert api.get("/vendors", headers=bearer()).status_code == 200

    def test_user_without_profile_is_403_not_a_default_role(self, api, auth_db):
        auth_db.tables["profiles"].clear()
        r = api.get("/vendors", headers=bearer())
        assert r.status_code == 403
        assert "profile" in r.json()["detail"].lower()

    def test_deactivated_user_is_403(self, api, auth_db):
        auth_db.tables["profiles"][0]["is_active"] = False
        r = api.get("/vendors", headers=bearer())
        assert r.status_code == 403
        assert "deactivated" in r.json()["detail"]

    def test_verification_is_cached_between_requests(self, api):
        api.get("/vendors", headers=bearer())
        api.get("/vendors", headers=bearer())
        assert api.verifier.calls == 1

    def test_failed_checks_are_not_cached(self, api, auth_db):
        auth_db.tables["profiles"][0]["is_active"] = False
        assert api.get("/vendors", headers=bearer()).status_code == 403
        auth_db.tables["profiles"][0]["is_active"] = True
        assert api.get("/vendors", headers=bearer()).status_code == 200


class TestRoleGuards:
    @pytest.mark.parametrize("role,expected", [("entry_operator", 422), ("admin", 422), ("engineer", 403), ("accounts", 403)])
    def test_confirm_requires_entry_role(self, client_as, role, expected):
        # 422 = passed the role check and failed body validation; 403 = rejected by the role check.
        assert client_as(role).post("/intake/confirm", json={}).status_code == expected

    @pytest.mark.parametrize("role,expected", [("entry_operator", 200), ("engineer", 403), ("accounts", 403)])
    def test_barcode_requires_entry_role(self, client_as, role, expected):
        assert client_as(role).post("/intake/barcode", json={"code": "X"}).status_code == expected

    def test_ocr_requires_entry_role(self, client_as):
        r = client_as("engineer").post("/intake/ocr", files={"file": ("a.png", b"x", "image/png")})
        assert r.status_code == 403


class TestLogin:
    def _patch_signin(self, monkeypatch, result=None, error=None):
        def sign_in(creds):
            if error:
                raise error
            return result
        monkeypatch.setattr(auth_router, "new_auth_client", lambda: SimpleNamespace(auth=SimpleNamespace(sign_in_with_password=sign_in)))

    def _session_result(self):
        return SimpleNamespace(
            session=SimpleNamespace(access_token="acc", refresh_token="ref"),
            user=SimpleNamespace(id=USER_ID, email="op@bharatoil.in"),
        )

    def test_success_returns_role_from_profile(self, api, monkeypatch):
        self._patch_signin(monkeypatch, self._session_result())
        r = api.post("/auth/login", json={"email": "op@bharatoil.in", "password": "x"})
        assert r.status_code == 200
        body = r.json()
        assert body["role"] == "entry_operator" and body["access_token"] == "acc" and body["user_id"] == USER_ID

    def test_wrong_password_is_generic_401(self, api, monkeypatch):
        self._patch_signin(monkeypatch, error=AuthApiError("Invalid login credentials", 400, "invalid_credentials"))
        r = api.post("/auth/login", json={"email": "op@bharatoil.in", "password": "nope"})
        assert r.status_code == 401
        assert r.json()["detail"] == "Invalid email or password"

    def test_login_without_profile_is_403(self, api, auth_db, monkeypatch):
        auth_db.tables["profiles"].clear()
        self._patch_signin(monkeypatch, self._session_result())
        assert api.post("/auth/login", json={"email": "a@b.in", "password": "x"}).status_code == 403

    def test_login_of_deactivated_user_is_403(self, api, auth_db, monkeypatch):
        auth_db.tables["profiles"][0]["is_active"] = False
        self._patch_signin(monkeypatch, self._session_result())
        assert api.post("/auth/login", json={"email": "a@b.in", "password": "x"}).status_code == 403

    def test_login_outage_is_503(self, api, monkeypatch):
        self._patch_signin(monkeypatch, error=ConnectionError("down"))
        assert api.post("/auth/login", json={"email": "a@b.in", "password": "x"}).status_code == 503


class TestLogoutAndMe:
    def test_logout_revokes_and_forgets_token(self, api, auth_db):
        revoked = []
        auth_db.auth.admin.sign_out = lambda jwt: revoked.append(jwt)
        api.get("/vendors", headers=bearer())          # populate the cache
        assert api.post("/auth/logout", headers=bearer()).status_code == 200
        assert revoked == ["good"]
        api.get("/vendors", headers=bearer())
        assert api.verifier.calls == 2                 # cache entry was dropped by logout

    def test_logout_succeeds_even_if_revocation_fails(self, api, auth_db):
        def boom(jwt):
            raise RuntimeError("supabase down")
        auth_db.auth.admin.sign_out = boom
        assert api.post("/auth/logout", headers=bearer()).status_code == 200

    def test_me_returns_profile(self, api):
        r = api.get("/auth/me", headers=bearer())
        assert r.status_code == 200 and r.json()["email"] == "op@bharatoil.in"
