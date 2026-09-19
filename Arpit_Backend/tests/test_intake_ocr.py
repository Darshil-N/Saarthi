import pytest

import routers.intake as intake
from config import settings
from services.ai_common import AIQuotaError, AIServiceError
from services.ocr_service import OCRUnreadableError
from tests.conftest import LOC_1, MATERIAL_A, VENDOR_ID

PNG = ("bill.png", b"\x89PNG fake image bytes", "image/png")

CANDIDATE = {
    "id": MATERIAL_A, "cnmc": "MECH-FSTNR-BOLT-M8X25-SS304-A", "category": "MECH", "subcategory": "FSTNR",
    "material_type": "BOLT", "quality_grade": "A", "unit_of_measure": "EA",
    "standard_description": "Hexagonal Head Bolt M8x25mm SS304", "technical_specs": {"thread": "M8"}, "similarity": 0.93,
}


def raw_line(**kw):
    line = {"line_id": "li_001", "description": "Hex bolt M8x25 SS", "quantity": 100.0, "unit": "EA",
            "unit_price": 12.5, "batch_number": None, "hsn_code": None, "quality_grade": None}
    line.update(kw)
    return line


def match_result(**kw):
    result = {
        "match_status": "new_material", "matched_material_id": None, "matched_description": None,
        "match_type": "different", "confidence": 0.0, "vector_similarity": 0.0,
        "match_reason": "No similar material found in the master.", "cnmc": None,
        "embedding": [0.1, 0.2], "master_candidate": None, "auto_link": False,
    }
    result.update(kw)
    return result


@pytest.fixture
def ocr(monkeypatch):
    """Patch the AI-facing calls; tests set `state` to choose what the 'AI' returns."""
    state = {"lines": [raw_line()], "match": match_result(), "cnmc": None, "ocr_error": None}

    async def fake_run_ocr(file_bytes, content_type):
        if state["ocr_error"]:
            raise state["ocr_error"]
        return state["lines"]

    async def fake_run_matching(supabase, description, incoming_specs=None):
        return state["match"]

    async def fake_generate_cnmc(supabase, description, specs="", quality=""):
        return state["cnmc"] or {
            "cnmc": "MECH-VALVE-GATE-2IN-A", "category": "MECH", "subcategory": "VALVE", "type": "GATE",
            "spec": "2IN", "quality": "A", "standard_description": "Gate Valve 2 inch", "short_description": "Gate Valve",
        }

    async def fake_upload(supabase, file_bytes, content_type):
        return "stored-bill.png"

    monkeypatch.setattr(intake, "run_ocr", fake_run_ocr)
    monkeypatch.setattr(intake, "run_matching", fake_run_matching)
    monkeypatch.setattr(intake, "generate_cnmc", fake_generate_cnmc)
    monkeypatch.setattr(intake, "upload_bill_to_storage", fake_upload)
    return state


def upload(client, file=PNG, **data):
    return client.post("/intake/ocr", files={"file": file}, data=data)


class TestUploadValidation:
    def test_unsupported_type_is_415(self, client, ocr):
        r = upload(client, ("notes.txt", b"hello", "text/plain"))
        assert r.status_code == 415 and "JPG" in r.json()["detail"]

    def test_empty_file_is_422(self, client, ocr):
        assert upload(client, ("a.png", b"", "image/png")).status_code == 422

    def test_oversized_file_is_413(self, client, ocr, monkeypatch):
        monkeypatch.setattr(settings, "MAX_UPLOAD_BYTES", 10)
        r = upload(client, ("a.png", b"x" * 11, "image/png"))
        assert r.status_code == 413 and "too large" in r.json()["detail"]

    def test_jpg_alias_and_pdf_are_accepted(self, client, ocr):
        assert upload(client, ("a.jpg", b"x", "image/jpg")).status_code == 200
        assert upload(client, ("a.pdf", b"x", "application/pdf")).status_code == 200


class TestOcrErrors:
    def test_unreadable_bill_is_422_with_advice(self, client, ocr):
        ocr["ocr_error"] = OCRUnreadableError("nothing")
        r = upload(client)
        assert r.status_code == 422 and "clearer photo" in r.json()["detail"]

    def test_quota_is_429_not_a_fake_422(self, client, ocr):
        ocr["ocr_error"] = AIQuotaError("quota")
        r = upload(client)
        assert r.status_code == 429 and "quota" in r.json()["detail"].lower()

    def test_ai_outage_is_502(self, client, ocr):
        ocr["ocr_error"] = AIServiceError("down")
        assert upload(client).status_code == 502

    def test_failed_ocr_leaves_nothing_behind(self, client, ocr, db):
        ocr["ocr_error"] = OCRUnreadableError("nothing")
        before = len(db.rows("materials"))
        upload(client)
        assert len(db.rows("materials")) == before


class TestLineClassification:
    def test_new_material_gets_pending_material_cnmc_and_audit(self, client, ocr, db):
        before = len(db.rows("materials"))
        r = upload(client, vendor_id=VENDOR_ID)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["receipt_id"].startswith("draft-")
        assert body["bill_image_path"] == "stored-bill.png"
        assert body["bill_image_url"] == "https://signed.example/stored-bill.png"

        line = body["line_items"][0]
        assert line["match_status"] == "new_material" and line["is_new_material"] is True
        assert line["cnmc"] == "MECH-VALVE-GATE-2IN-A" and line["pending_material_id"]
        assert line["quantity"] == 100.0 and line["total_price"] == 1250.0 and line["vendor_id"] == VENDOR_ID
        assert line["quality_grade"] == "A"  # default when the bill does not say

        created = db.rows("materials")[before:]
        assert len(created) == 1 and created[0]["status"] == "pending" and created[0]["embedding"] == [0.1, 0.2]
        assert created[0]["created_by"] == "user-1" and created[0]["material_type"] == "GATE"
        assert [a["action"] for a in db.rows("audit_log")] == ["cnmc_generated"]
        assert db.rows("matching_queue") == []      # nothing resembles it, so nothing to review

    def test_certain_exact_match_links_to_catalog_without_creating_anything(self, client, ocr, db):
        ocr["match"] = match_result(
            match_status="exact_match", matched_material_id=MATERIAL_A, matched_description=CANDIDATE["standard_description"],
            match_type="exact", confidence=0.99, cnmc=CANDIDATE["cnmc"], master_candidate=CANDIDATE, auto_link=True,
        )
        before = len(db.rows("materials"))
        line = upload(client).json()["line_items"][0]
        assert line["pending_material_id"] is None and line["matched_material_id"] == MATERIAL_A
        assert line["cnmc"] == CANDIDATE["cnmc"] and line["is_new_material"] is False
        assert len(db.rows("materials")) == before and db.rows("matching_queue") == []

    def test_near_duplicate_creates_pending_material_and_review_entry(self, client, ocr, db):
        ocr["match"] = match_result(
            match_status="near_duplicate", matched_material_id=MATERIAL_A, matched_description=CANDIDATE["standard_description"],
            match_type="near_duplicate", confidence=0.82, vector_similarity=0.93, match_reason="Same bolt, other wording",
            cnmc=CANDIDATE["cnmc"], master_candidate=CANDIDATE,
        )
        line = upload(client).json()["line_items"][0]
        assert line["match_status"] == "near_duplicate" and line["matched_material_id"] == MATERIAL_A
        assert line["pending_material_id"] and line["pending_material_id"] != MATERIAL_A
        # the catalog CNMC is taken (and so is "-2" in this fixture), so a unique numeric suffix is appended
        assert line["cnmc"] == CANDIDATE["cnmc"] + "-3"
        assert len({m["cnmc"] for m in db.rows("materials")}) == len(db.rows("materials"))

        queue = db.rows("matching_queue")
        assert len(queue) == 1
        assert queue[0]["new_material_id"] == line["pending_material_id"] and queue[0]["matched_material_id"] == MATERIAL_A
        assert queue[0]["status"] == "pending" and queue[0]["match_type"] == "near_duplicate"
        # the pending material mirrors the catalog entry it resembles
        pending = [m for m in db.rows("materials") if m["id"] == line["pending_material_id"]][0]
        assert pending["category"] == "MECH" and pending["material_type"] == "BOLT" and pending["technical_specs"] == {"thread": "M8"}

    def test_uncertain_line_without_candidate_does_not_crash(self, client, ocr, db):
        # AI matching unavailable: status uncertain, no candidate. This used to raise AttributeError.
        ocr["match"] = match_result(match_status="uncertain", match_reason="AI matching unavailable - needs manual review.")
        r = upload(client)
        assert r.status_code == 200
        line = r.json()["line_items"][0]
        assert line["match_status"] == "uncertain" and line["pending_material_id"]

    def test_line_ids_are_unique_and_every_line_is_processed(self, client, ocr):
        ocr["lines"] = [raw_line(line_id="li_001", description="A"), raw_line(line_id="li_002", description="B")]
        lines = upload(client).json()["line_items"]
        assert [l["description"] for l in lines] == ["A", "B"]
        assert len({l["line_id"] for l in lines}) == 2

    def test_material_insert_failure_leaves_line_unlinked_but_does_not_abort(self, client, ocr, db):
        db.fail("materials", "insert")
        r = upload(client)
        assert r.status_code == 200 and r.json()["line_items"][0]["pending_material_id"] is None


class TestOcrToConfirmContract:
    """What OCR returns must be acceptable to /confirm once the operator fills in the location."""

    def test_new_material_flow_updates_stock_of_the_pending_material(self, client, ocr, db):
        line = upload(client, vendor_id=VENDOR_ID).json()
        item = line["line_items"][0]
        item["location_code"] = LOC_1
        r = client.post("/intake/confirm", json={
            "vendor_id": VENDOR_ID, "receipt_date": "2026-09-19", "client_draft_id": line["receipt_id"],
            "bill_image_path": line["bill_image_path"], "line_items": [item],
        })
        assert r.status_code == 200, r.text
        inv = db.rows("inventory")
        assert len(inv) == 1 and inv[0]["material_id"] == item["pending_material_id"] and inv[0]["quantity"] == 100
        assert db.rows("goods_receipts")[0]["bill_image_url"] == "stored-bill.png"

    def test_auto_linked_flow_updates_stock_of_the_catalog_material(self, client, ocr, db):
        ocr["match"] = match_result(match_status="exact_match", matched_material_id=MATERIAL_A, match_type="exact",
                                    confidence=0.99, cnmc=CANDIDATE["cnmc"], master_candidate=CANDIDATE, auto_link=True)
        line = upload(client).json()
        item = line["line_items"][0]
        item["location_code"] = LOC_1
        r = client.post("/intake/confirm", json={"vendor_id": VENDOR_ID, "receipt_date": "2026-09-19", "line_items": [item]})
        assert r.status_code == 200, r.text
        assert db.rows("inventory")[0]["material_id"] == MATERIAL_A

    def test_line_the_operator_did_not_fix_is_rejected_with_a_clear_message(self, client, ocr):
        item = upload(client).json()["line_items"][0]
        item["quantity"] = 0                # OCR could not read the quantity; operator forgot to fix it
        item["location_code"] = LOC_1
        r = client.post("/intake/confirm", json={"vendor_id": VENDOR_ID, "receipt_date": "2026-09-19", "line_items": [item]})
        assert r.status_code == 422 and "quantity" in str(r.json()["detail"]).lower()
