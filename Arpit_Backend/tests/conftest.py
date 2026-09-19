import os

# Settings are read at import time; supply dummies so no real .env or network is needed.
os.environ.setdefault("SUPABASE_URL", "http://supabase.invalid")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-service-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("GEMINI_API_KEY", "test-gemini-key")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import dependencies  # noqa: E402
from dependencies import CurrentUser, get_current_user, get_supabase  # noqa: E402
from main import app  # noqa: E402
from tests.fake_supabase import FakeSupabase  # noqa: E402

VENDOR_ID = "11111111-1111-1111-1111-111111111111"
MATERIAL_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"   # approved, in the catalog
MATERIAL_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"   # pending (created during OCR)
MATERIAL_DEPRECATED = "dddddddd-dddd-dddd-dddd-dddddddddddd"
LOC_1 = "WHSE-A-A1-R1-B1"
LOC_2 = "WHSE-A-A1-R1-B2"


@pytest.fixture(autouse=True)
def _clear_auth_cache():
    dependencies._user_cache.clear()
    yield
    dependencies._user_cache.clear()


@pytest.fixture
def db() -> FakeSupabase:
    fake = FakeSupabase()
    fake.seed("vendors", id=VENDOR_ID, name="FastFix Industries", code="VND-001", is_active=True)
    fake.seed("locations", code=LOC_1, is_active=True)
    fake.seed("locations", code=LOC_2, is_active=True)
    long_ago = "2020-01-01T00:00:00+00:00"  # so fixtures never count as "created today" on dashboards
    fake.seed("materials", id=MATERIAL_A, cnmc="MECH-FSTNR-BOLT-M8X25-SS304-A", status="approved", created_at=long_ago,
              standard_description="Hexagonal Head Bolt M8x25mm SS304")
    fake.seed("materials", id=MATERIAL_B, cnmc="MECH-FSTNR-BOLT-M8X25-SS304-A-2", status="pending", created_at=long_ago,
              standard_description="Hex bolt M8 x 25 stainless")
    fake.seed("materials", id=MATERIAL_DEPRECATED, cnmc="OLD-1", status="deprecated", created_at=long_ago,
              standard_description="Old")
    return fake


def make_user(role: str = "entry_operator", user_id: str = "user-1") -> CurrentUser:
    return CurrentUser(id=user_id, email=f"{role}@bharatoil.in", role=role, raw_token="tok")


@pytest.fixture
def client(db):
    """TestClient authenticated as an entry operator, backed by the fake database."""
    app.dependency_overrides[get_supabase] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: make_user("entry_operator")
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def client_as(db):
    """Factory: client authenticated with a chosen role."""
    made = []

    def _factory(role: str):
        app.dependency_overrides[get_supabase] = lambda: db
        app.dependency_overrides[get_current_user] = lambda: make_user(role)
        c = TestClient(app, raise_server_exceptions=False)
        made.append(c)
        return c

    yield _factory
    app.dependency_overrides.clear()


def confirm_payload(**overrides) -> dict:
    """A valid /intake/confirm body: one line for the catalog material, one for a pending material."""
    body = {
        "vendor_id": VENDOR_ID,
        "receipt_date": "2026-09-19",
        "po_number": "PO-1",
        "client_draft_id": "draft-1",
        "line_items": [
            {
                "line_id": "li_001", "description": "Hex bolt M8x25", "quantity": 100, "unit": "EA",
                "unit_price": 12.5, "quality_grade": "A", "location_code": LOC_1,
                "match_status": "exact_match", "matched_material_id": MATERIAL_A,
            },
            {
                "line_id": "li_002", "description": "Hex bolt M8 x 25 stainless", "quantity": 40, "unit": "EA",
                "unit_price": 11.8, "quality_grade": "B", "location_code": LOC_2,
                "match_status": "near_duplicate", "matched_material_id": MATERIAL_A,
                "pending_material_id": MATERIAL_B,
            },
        ],
    }
    body.update(overrides)
    return body
