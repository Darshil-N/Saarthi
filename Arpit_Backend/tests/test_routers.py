import pytest

from tests.conftest import LOC_1, MATERIAL_A, MATERIAL_B

MISSING_ID = "99999999-9999-9999-9999-999999999999"


def seed_match(db, status="pending"):
    return db.seed("matching_queue", new_material_id=MATERIAL_B, matched_material_id=MATERIAL_A, match_type="near_duplicate",
                   confidence_score=0.9, status=status)


class TestMatchingReview:
    @pytest.mark.parametrize("action,expected", [("approve", "approved"), ("reject", "rejected")])
    def test_review_updates_status_and_audits(self, client, db, action, expected):
        match = seed_match(db)
        r = client.patch(f"/matching/{match['id']}/{action}")
        assert r.status_code == 200 and r.json() == {"status": expected, "match_id": match["id"]}
        row = db.rows("matching_queue")[0]
        assert row["status"] == expected and row["reviewed_by"] == "user-1" and row["reviewed_at"]
        audit = db.rows("audit_log")[0]
        assert audit["action"] == f"mapping_{expected}" and audit["entity_id"] == match["id"]

    def test_second_review_is_a_409_and_changes_nothing(self, client, db):
        match = seed_match(db)
        client.patch(f"/matching/{match['id']}/approve")
        r = client.patch(f"/matching/{match['id']}/reject")
        assert r.status_code == 409 and "already reviewed" in r.json()["detail"]
        assert db.rows("matching_queue")[0]["status"] == "approved"

    def test_concurrent_review_loses_cleanly(self, client, db):
        match = seed_match(db)
        # someone else reviews between our status check and our update
        db.before_update = lambda table, filters: db.rows("matching_queue")[0].update(status="rejected")
        assert client.patch(f"/matching/{match['id']}/approve").status_code == 409
        assert db.rows("matching_queue")[0]["status"] == "rejected"

    def test_missing_match_is_404_not_500(self, client):
        assert client.patch(f"/matching/{MISSING_ID}/approve").status_code == 404

    def test_malformed_id_is_404_not_500(self, client):
        assert client.patch("/matching/not-a-uuid/approve").status_code == 404

    def test_accounts_role_can_review(self, client_as, db):
        # Plan D-7 (decided 2026-09-22): accounts is one of the four roles allowed to review mappings.
        match = seed_match(db)
        r = client_as("accounts").patch(f"/matching/{match['id']}/approve")
        assert r.status_code == 200 and r.json()["status"] == "approved"
        assert db.rows("matching_queue")[0]["status"] == "approved"

    def test_list_pending_only(self, client, db):
        db.seed("v_matching_queue_detailed", status="pending", id="a")
        db.seed("v_matching_queue_detailed", status="approved", id="b")
        assert [r["id"] for r in client.get("/matching").json()] == ["a"]


class TestInventory:
    def test_missing_item_is_404_not_500(self, client):
        assert client.get(f"/inventory/{MISSING_ID}").status_code == 404

    def test_malformed_id_is_404(self, client):
        assert client.get("/inventory/nope").status_code == 404

    def test_get_item(self, client, db):
        row = db.seed("inventory", material_id=MATERIAL_A, location_code=LOC_1, quantity=5)
        assert client.get(f"/inventory/{row['id']}").json()["quantity"] == 5

    def test_locations_route_is_not_shadowed_by_the_id_route(self, client):
        assert client.get("/inventory/locations").status_code == 200

    def test_list_filters_and_bounds(self, client, db):
        db.seed("inventory", material_id=MATERIAL_A, location_code=LOC_1, quantity=5, last_updated="2026-01-01")
        db.seed("inventory", material_id=MATERIAL_B, location_code=LOC_1, quantity=9, last_updated="2026-02-01")
        assert len(client.get("/inventory", params={"material_id": MATERIAL_A}).json()) == 1
        assert client.get("/inventory", params={"material_id": "bad"}).status_code == 404
        assert client.get("/inventory", params={"limit": 500}).status_code == 422


class TestMaterials:
    def test_get_missing_and_malformed(self, client):
        assert client.get(f"/materials/{MISSING_ID}").status_code == 404
        assert client.get("/materials/xyz").status_code == 404

    def test_approve_sets_audit_fields(self, client, db):
        r = client.patch(f"/materials/{MATERIAL_B}/approve")
        assert r.status_code == 200 and r.json()["status"] == "approved"
        assert db.rows("audit_log")[0]["action"] == "material_approved"

    def test_approve_missing_is_404(self, client):
        assert client.patch(f"/materials/{MISSING_ID}/approve").status_code == 404

    def test_accounts_cannot_approve(self, client_as):
        assert client_as("accounts").patch(f"/materials/{MATERIAL_B}/approve").status_code == 403

    def test_list_bounds(self, client):
        assert client.get("/materials", params={"limit": 0}).status_code == 422
        assert client.get("/materials", params={"limit": 50}).status_code == 200


class TestDashboard:
    def test_counts(self, client, db):
        db.seed("matching_queue", status="pending", match_type="exact", created_at="2999-01-01T00:00:00+00:00")
        db.seed("matching_queue", status="approved", match_type="near_duplicate", created_at="2999-01-01T00:00:00+00:00")
        db.seed("goods_receipts", gr_number="GR-1", created_at="2999-01-01T00:00:00+00:00")
        body = client.get("/dashboard/entry").json()
        assert body == {"todayReceipts": 1, "pendingApprovals": 1, "newMaterialsToday": 0, "duplicatesDetected": 1}

    def test_database_failure_is_reported_not_shown_as_zeros(self, client, db):
        db.fail("goods_receipts", "select")
        r = client.get("/dashboard/entry")
        assert r.status_code == 502 and "dashboard" in r.json()["detail"].lower()


class TestRequestContext:
    def test_response_carries_request_id(self, client):
        r = client.get("/health")
        assert r.status_code == 200 and len(r.headers["X-Request-ID"]) >= 8

    def test_client_supplied_request_id_is_echoed(self, client):
        assert client.get("/health", headers={"X-Request-ID": "trace-123"}).headers["X-Request-ID"] == "trace-123"

    def test_unhandled_error_is_json_500_with_cors_headers(self, client, db):
        db.fail("vendors", "select")
        r = client.get("/vendors", headers={"Origin": "http://localhost:5173"})
        assert r.status_code == 500
        body = r.json()
        assert body["detail"] == "Internal server error" and body["request_id"] == r.headers["X-Request-ID"]
        # Without CORS headers the browser would report a network error instead of this response.
        assert r.headers["access-control-allow-origin"] == "http://localhost:5173"

    def test_error_details_are_not_leaked(self, client, db):
        db.fail("vendors", "select", RuntimeError("secret connection string"))
        assert "secret" not in client.get("/vendors").text
