import pytest
from postgrest.exceptions import APIError

from tests.conftest import LOC_1, LOC_2, MATERIAL_A, MATERIAL_B, MATERIAL_DEPRECATED, VENDOR_ID, confirm_payload

MISSING_ID = "99999999-9999-9999-9999-999999999999"


def stock(db, material, loc):
    rows = [r for r in db.rows("inventory") if r["material_id"] == material and r["location_code"] == loc]
    return rows[0]["quantity"] if rows else None


class TestConfirmSuccess:
    def test_creates_receipt_lines_stock_prices_and_audit(self, client, db):
        r = client.post("/intake/confirm", json=confirm_payload())
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "success" and body["line_items_created"] == 2
        assert body["gr_number"].startswith("GR-2026-")
        assert body["total_value"] == pytest.approx(100 * 12.5 + 40 * 11.8)
        assert body["already_confirmed"] is False

        receipt = db.rows("goods_receipts")[0]
        assert receipt["status"] == "completed" and receipt["received_by"] == "user-1"
        assert receipt["total_value"] == pytest.approx(1722.0)

        lines = db.rows("gr_line_items")
        assert len(lines) == 2
        # the catalog line books to the catalog material; the near-duplicate to its pending material
        assert {l["material_id"] for l in lines} == {MATERIAL_A, MATERIAL_B}

        assert stock(db, MATERIAL_A, LOC_1) == 100
        assert stock(db, MATERIAL_B, LOC_2) == 40

        prices = db.rows("price_history")
        assert len(prices) == 2
        assert {p["gr_line_item_id"] for p in prices} == {l["id"] for l in lines}
        assert all(p["vendor_id"] == VENDOR_ID and p["purchase_date"] == "2026-09-19" for p in prices)

        assert [a["action"] for a in db.rows("audit_log")] == ["receipt_confirmed"]

    def test_adds_to_existing_stock(self, client, db):
        db.seed("inventory", material_id=MATERIAL_A, location_code=LOC_1, quantity=1500)
        client.post("/intake/confirm", json=confirm_payload())
        assert stock(db, MATERIAL_A, LOC_1) == 1600
        assert len([r for r in db.rows("inventory") if r["material_id"] == MATERIAL_A]) == 1  # no duplicate row

    def test_zero_price_lines_are_received_but_not_priced(self, client, db):
        body = confirm_payload()
        body["line_items"][0]["unit_price"] = 0
        assert client.post("/intake/confirm", json=body).status_code == 200
        assert len(db.rows("price_history")) == 1

    def test_blank_po_number_is_stored_as_null(self, client, db):
        client.post("/intake/confirm", json=confirm_payload(po_number=""))
        assert db.rows("goods_receipts")[0]["po_number"] is None

    def test_fractional_quantities_are_kept(self, client, db):
        body = confirm_payload()
        body["line_items"][0]["quantity"] = 2.5
        client.post("/intake/confirm", json=body)
        assert stock(db, MATERIAL_A, LOC_1) == 2.5


class TestConfirmValidation:
    def _post(self, client, mutate):
        body = confirm_payload()
        mutate(body)
        return client.post("/intake/confirm", json=body)

    def test_empty_date_is_rejected_with_field_message(self, client):
        r = client.post("/intake/confirm", json=confirm_payload(receipt_date=""))
        assert r.status_code == 422
        assert any("receipt_date" in ".".join(map(str, d["loc"])) for d in r.json()["detail"])

    @pytest.mark.parametrize("qty", [0, -5, None])
    def test_quantity_must_be_positive(self, client, qty):
        assert self._post(client, lambda b: b["line_items"][0].update(quantity=qty)).status_code == 422

    def test_negative_price_rejected(self, client):
        assert self._post(client, lambda b: b["line_items"][0].update(unit_price=-1)).status_code == 422

    @pytest.mark.parametrize("grade", ["", None, "D", "a"])
    def test_quality_grade_must_be_a_b_or_c(self, client, grade):
        assert self._post(client, lambda b: b["line_items"][0].update(quality_grade=grade)).status_code == 422

    def test_blank_location_rejected(self, client):
        assert self._post(client, lambda b: b["line_items"][0].update(location_code="")).status_code == 422

    def test_no_line_items_rejected(self, client):
        assert self._post(client, lambda b: b.update(line_items=[])).status_code == 422

    def test_unknown_location_gives_readable_error_and_writes_nothing(self, client, db):
        r = self._post(client, lambda b: b["line_items"][0].update(location_code="WHSE-Z-NOPE"))
        assert r.status_code == 422 and "WHSE-Z-NOPE" in r.json()["detail"]
        assert db.rows("goods_receipts") == [] and db.rows("inventory") == []

    def test_unknown_vendor_rejected(self, client, db):
        r = client.post("/intake/confirm", json=confirm_payload(vendor_id=MISSING_ID))
        assert r.status_code == 422 and "vendor" in r.json()["detail"].lower()
        assert db.rows("goods_receipts") == []

    def test_malformed_vendor_rejected(self, client):
        assert client.post("/intake/confirm", json=confirm_payload(vendor_id="abc")).status_code == 422

    def test_line_without_material_link_is_rejected(self, client, db):
        r = self._post(client, lambda b: b["line_items"][0].update(material_id=None))
        assert r.status_code == 422 and "Line 1" in r.json()["detail"] and "not linked" in r.json()["detail"]
        assert db.rows("goods_receipts") == []

    def test_deprecated_material_rejected(self, client):
        r = self._post(client, lambda b: b["line_items"][0].update(material_id=MATERIAL_DEPRECATED))
        assert r.status_code == 422 and "deprecated" in r.json()["detail"]

    def test_missing_material_rejected(self, client):
        r = self._post(client, lambda b: b["line_items"][0].update(material_id=MISSING_ID))
        assert r.status_code == 422 and "no longer exists" in r.json()["detail"]

    def test_all_problems_reported_together(self, client):
        def mutate(b):
            b["line_items"][0]["location_code"] = "WHSE-Z"
            b["line_items"][1].update(material_id=None)

        detail = self._post(client, mutate).json()["detail"]
        assert "WHSE-Z" in detail and "Line 2" in detail


class TestConfirmIsAllOrNothing:
    """confirm_receipt now does all its writes inside one database transaction
    (migrations/002_confirm_and_approve_rpcs.sql, plan step 1.2.2) — any failure rolls back
    everything it already wrote, with no manual undo logic on the Python side any more. The fake
    RPC (tests/fake_supabase.py) gives the same guarantee by snapshotting every table first."""

    def test_failure_writing_price_history_undoes_everything(self, client, db):
        db.seed("inventory", material_id=MATERIAL_A, location_code=LOC_1, quantity=1500)
        db.fail("price_history", "insert", APIError({"message": "boom", "code": "XX000", "details": "", "hint": None}))
        r = client.post("/intake/confirm", json=confirm_payload())
        assert r.status_code == 500
        assert "saved" in r.json()["detail"].lower()
        assert db.rows("goods_receipts") == [] and db.rows("gr_line_items") == []
        assert stock(db, MATERIAL_A, LOC_1) == 1500            # restored
        assert stock(db, MATERIAL_B, LOC_2) is None            # the row we created is gone again
        assert db.rows("price_history") == [] and db.rows("audit_log") == []

    def test_failure_creating_line_items_removes_the_header(self, client, db):
        db.fail("gr_line_items", "insert", APIError({"message": "boom", "code": "XX000", "details": "", "hint": None}))
        assert client.post("/intake/confirm", json=confirm_payload()).status_code == 500
        assert db.rows("goods_receipts") == [] and db.rows("inventory") == []

    def test_failure_on_the_second_lines_stock_update_reverts_the_first(self, client, db, monkeypatch):
        """A failure on the second line's inventory write must undo the first line's stock too —
        proved by failing only the second `inventory` insert, mid-transaction."""
        query_cls = type(db.table("inventory"))
        real_execute = query_cls.execute
        seen = {"inventory_inserts": 0}

        def flaky_execute(self):
            if self.name == "inventory" and self.op == "insert":
                seen["inventory_inserts"] += 1
                if seen["inventory_inserts"] == 2:
                    raise APIError({"message": "boom on second line", "code": "XX000", "details": "", "hint": None})
            return real_execute(self)

        monkeypatch.setattr(query_cls, "execute", flaky_execute)
        assert client.post("/intake/confirm", json=confirm_payload()).status_code == 500
        assert stock(db, MATERIAL_A, LOC_1) is None and db.rows("goods_receipts") == []


class TestIdempotency:
    def test_same_draft_id_returns_existing_receipt(self, client, db):
        first = client.post("/intake/confirm", json=confirm_payload()).json()
        second = client.post("/intake/confirm", json=confirm_payload())
        assert second.status_code == 200
        body = second.json()
        assert body["receipt_id"] == first["receipt_id"] and body["gr_number"] == first["gr_number"]
        assert body["already_confirmed"] is True and body["line_items_created"] == 2
        assert len(db.rows("goods_receipts")) == 1
        assert stock(db, MATERIAL_A, LOC_1) == 100   # not doubled

    def test_different_draft_id_creates_a_new_receipt(self, client, db):
        client.post("/intake/confirm", json=confirm_payload())
        client.post("/intake/confirm", json=confirm_payload(client_draft_id="draft-2"))
        assert len(db.rows("goods_receipts")) == 2
        assert stock(db, MATERIAL_A, LOC_1) == 200


class TestReceiptReads:
    def _make(self, client, **kw):
        return client.post("/intake/confirm", json=confirm_payload(**kw)).json()

    def test_list_shows_gr_number_vendor_items_and_total(self, client):
        made = self._make(client)
        rows = client.get("/intake/receipts").json()
        assert len(rows) == 1
        row = rows[0]
        assert row["id"] == made["receipt_id"] and row["gr_number"] == made["gr_number"]
        assert row["vendor_name"] == "FastFix Industries" and row["items_count"] == 2
        assert row["total_value"] == pytest.approx(1722.0) and row["status"] == "completed"

    def test_list_filters(self, client):
        self._make(client)
        self._make(client, client_draft_id="d2", receipt_date="2026-01-05")
        assert len(client.get("/intake/receipts", params={"vendor_id": VENDOR_ID}).json()) == 2
        assert len(client.get("/intake/receipts", params={"status": "completed"}).json()) == 2
        assert client.get("/intake/receipts", params={"status": "rejected"}).json() == []
        assert len(client.get("/intake/receipts", params={"from_date": "2026-09-01"}).json()) == 1
        assert len(client.get("/intake/receipts", params={"to_date": "2026-02-01"}).json()) == 1

    def test_ui_placeholder_values_mean_no_filter(self, client):
        self._make(client)
        r = client.get("/intake/receipts", params={"vendor_id": "all", "status": "all", "from_date": "", "to_date": ""})
        assert r.status_code == 200 and len(r.json()) == 1

    def test_invalid_filters_are_rejected(self, client):
        assert client.get("/intake/receipts", params={"status": "confirmed"}).status_code == 422
        assert client.get("/intake/receipts", params={"from_date": "yesterday"}).status_code == 422
        assert client.get("/intake/receipts", params={"vendor_id": "abc"}).status_code == 404

    def test_list_total_falls_back_to_lines_for_legacy_rows(self, client, db):
        gr = db.seed("goods_receipts", gr_number="GR-OLD", vendor_id=VENDOR_ID, receipt_date="2026-01-01",
                     status="completed", total_value=None)
        db.seed("gr_line_items", gr_id=gr["id"], quantity_received=4, unit_price=2.5)
        row = [r for r in client.get("/intake/receipts").json() if r["gr_number"] == "GR-OLD"][0]
        assert row["total_value"] == 10.0

    def test_pagination_bounds(self, client):
        assert client.get("/intake/receipts", params={"limit": 0}).status_code == 422
        assert client.get("/intake/receipts", params={"limit": 101}).status_code == 422
        assert client.get("/intake/receipts", params={"offset": -1}).status_code == 422

    def test_detail(self, client):
        made = self._make(client)
        r = client.get(f"/intake/receipts/{made['receipt_id']}")
        assert r.status_code == 200
        d = r.json()
        assert d["gr_number"] == made["gr_number"] and d["vendor_name"] == "FastFix Industries"
        assert d["po_number"] == "PO-1" and len(d["line_items"]) == 2
        first = d["line_items"][0]
        assert first["description"] == "Hex bolt M8x25" and first["quantity"] == 100 and first["unit"] == "EA"
        assert first["cnmc"] == "MECH-FSTNR-BOLT-M8X25-SS304-A" and first["location_code"] == LOC_1
        assert first["matched_description"] == "Hexagonal Head Bolt M8x25mm SS304"   # differs from the bill text
        assert first["match_status"] == "exact_match" and first["is_new_material"] is False

    def test_detail_hides_matched_description_when_identical(self, client, db):
        made = self._make(client)
        db.rows("gr_line_items")[0]["raw_description"] = "Hexagonal Head Bolt M8x25mm SS304"
        assert client.get(f"/intake/receipts/{made['receipt_id']}").json()["line_items"][0]["matched_description"] is None

    def test_detail_signs_stored_bill_path_and_passes_legacy_urls_through(self, client, db):
        made = self._make(client, bill_image_path="abc.jpg")
        url = client.get(f"/intake/receipts/{made['receipt_id']}").json()["bill_image_url"]
        assert url == "https://signed.example/abc.jpg"
        db.rows("goods_receipts")[0]["bill_image_url"] = "https://old.example/x.jpg"
        assert client.get(f"/intake/receipts/{made['receipt_id']}").json()["bill_image_url"] == "https://old.example/x.jpg"

    def test_detail_unknown_or_malformed_id_is_404(self, client):
        assert client.get(f"/intake/receipts/{MISSING_ID}").status_code == 404
        assert client.get("/intake/receipts/not-a-uuid").status_code == 404
