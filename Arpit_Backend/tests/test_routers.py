from tests.conftest import LOC_1, MATERIAL_A, MATERIAL_B

MISSING_ID = "99999999-9999-9999-9999-999999999999"


def seed_match(db, status="pending"):
    return db.seed("matching_queue", new_material_id=MATERIAL_B, matched_material_id=MATERIAL_A, match_type="near_duplicate",
                   confidence_score=0.9, status=status)


class TestMatchingReview:
    """Approve/reject now goes through the approve_mapping RPC (plan step 1.2.3): reject just
    closes the review, approve additionally merges stock into the survivor and deprecates the
    duplicate, all in one transaction. The old optimistic compare-and-set is replaced by a real
    row lock (FOR UPDATE) inside the RPC, which isn't something a single-threaded fake can
    usefully simulate losing — the property it protects is covered by the 409 test below instead.
    """

    def test_reject_updates_status_and_audits_without_touching_the_materials(self, client, db):
        match = seed_match(db)
        r = client.patch(f"/matching/{match['id']}/reject")
        assert r.status_code == 200 and r.json() == {"status": "rejected", "match_id": match["id"]}
        row = db.rows("matching_queue")[0]
        assert row["status"] == "rejected" and row["reviewed_by"] == "user-1" and row["reviewed_at"]
        audit = db.rows("audit_log")[0]
        assert audit["action"] == "mapping_rejected" and audit["entity_id"] == match["id"]
        assert next(m for m in db.rows("materials") if m["id"] == MATERIAL_B)["status"] == "pending"

    def test_approve_merges_stock_and_deprecates_the_duplicate(self, client, db):
        db.seed("inventory", material_id=MATERIAL_B, location_code=LOC_1, quantity=10)
        db.seed("inventory", material_id=MATERIAL_A, location_code=LOC_1, quantity=5)
        match = seed_match(db)

        r = client.patch(f"/matching/{match['id']}/approve")
        assert r.status_code == 200 and r.json() == {"status": "approved", "match_id": match["id"]}

        row = db.rows("matching_queue")[0]
        assert row["status"] == "approved" and row["reviewed_by"] == "user-1" and row["reviewed_at"]

        duplicate = next(m for m in db.rows("materials") if m["id"] == MATERIAL_B)
        assert duplicate["status"] == "deprecated" and duplicate["deprecated_by"] == "user-1"
        survivor_cnmc = next(m for m in db.rows("materials") if m["id"] == MATERIAL_A)["cnmc"]
        assert survivor_cnmc in duplicate["deprecation_reason"]

        inv = db.rows("inventory")
        assert [i["material_id"] for i in inv if i["location_code"] == LOC_1] == [MATERIAL_A]
        assert next(i for i in inv if i["material_id"] == MATERIAL_A)["quantity"] == 15
        assert [i for i in inv if i["material_id"] == MATERIAL_B] == []

        assert [a["action"] for a in db.rows("audit_log")] == ["materials_merged", "mapping_approved"]

    def test_second_review_is_a_409_and_changes_nothing(self, client, db):
        match = seed_match(db)
        client.patch(f"/matching/{match['id']}/approve")
        r = client.patch(f"/matching/{match['id']}/reject")
        assert r.status_code == 409 and "already reviewed" in r.json()["detail"]
        assert db.rows("matching_queue")[0]["status"] == "approved"

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

    def test_list_status_all_and_specific_status(self, client, db):
        db.seed("v_matching_queue_detailed", status="pending", id="a")
        db.seed("v_matching_queue_detailed", status="approved", id="b")
        db.seed("v_matching_queue_detailed", status="rejected", id="c")
        assert {r["id"] for r in client.get("/matching", params={"status": "all"}).json()} == {"a", "b", "c"}
        assert [r["id"] for r in client.get("/matching", params={"status": "rejected"}).json()] == ["c"]

    def test_list_unknown_status_is_422(self, client):
        assert client.get("/matching", params={"status": "bogus"}).status_code == 422

    def test_stats_counts_by_status(self, client, db):
        db.seed("matching_queue", status="pending")
        db.seed("matching_queue", status="pending")
        db.seed("matching_queue", status="approved")
        db.seed("matching_queue", status="auto_resolved")
        assert client.get("/matching/stats").json() == {
            "total": 4, "pending": 2, "approved": 1, "rejected": 0, "autoResolved": 1,
        }


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

    def test_engineer_counts_lists_and_low_stock(self, client, db):
        # MATERIAL_A (approved) and MATERIAL_B (pending) already exist from the db fixture.
        db.seed("materials", status="approved", cnmc="X-1", standard_description="Extra approved")
        db.seed("inventory", material_id=MATERIAL_A, location_code=LOC_1, quantity=3)
        db.seed("v_low_stock_alerts", material_id=MATERIAL_A, cnmc="MECH-FSTNR-BOLT-M8X25-SS304-A",
                standard_description="Hexagonal Head Bolt M8x25mm SS304", category="MECH",
                unit_of_measure="EA", total_quantity=3, reorder_level=10, alert_type="low_stock")

        body = client.get("/dashboard/engineer").json()
        assert body["totalMaterials"] == 4          # MATERIAL_A, MATERIAL_B, MATERIAL_DEPRECATED, the extra one
        assert body["approvedMaterials"] == 2
        assert body["pendingMaterials"] == 1
        assert body["totalInventoryLocations"] == 1
        assert len(body["lowStock"]) == 1 and body["lowStock"][0]["material_id"] == MATERIAL_A

    def test_engineer_database_failure_is_reported_not_shown_as_zeros(self, client, db):
        db.fail("materials", "select")
        r = client.get("/dashboard/engineer")
        assert r.status_code == 502 and "dashboard" in r.json()["detail"].lower()

    def test_admin_counts_quality_score_and_recent_materials(self, client, db):
        db.seed("materials", status="approved", cnmc="X-1", standard_description="Has specs",
                technical_specs={"a": 1})
        db.seed("matching_queue", status="approved")  # counts as a duplicate even though resolved
        db.seed("matching_queue", status="pending")

        body = client.get("/dashboard/admin").json()
        assert body["total"] == 4 and body["approved"] == 2 and body["pending"] == 1
        assert body["duplicates"] == 2
        assert body["qualityScore"] == 50   # 1 of 2 approved materials has technical_specs
        assert len(body["recentMaterials"]) <= 5

    def test_admin_database_failure_is_reported_not_shown_as_zeros(self, client, db):
        db.fail("materials", "select")
        r = client.get("/dashboard/admin")
        assert r.status_code == 502 and "dashboard" in r.json()["detail"].lower()

    def test_system_health_reports_real_counts_and_gemini_configured(self, client, db):
        db.seed("goods_receipts", gr_number="GR-1")
        db.seed("audit_log", action="x", entity_type="materials", entity_id=MATERIAL_A)

        body = client.get("/dashboard/system-health").json()
        assert body["dbConnected"] is True and isinstance(body["dbPingMs"], int)
        assert body["geminiConfigured"] is True   # conftest sets a dummy GEMINI_API_KEY
        assert body["counts"] == {
            "materials": 3, "goodsReceipts": 1, "auditEntries": 1, "matchingQueue": 0, "nlQueries": 0,
        }

    def test_system_health_reports_db_down_instead_of_erroring(self, client, db):
        db.fail("materials", "select")
        r = client.get("/dashboard/system-health")
        assert r.status_code == 200   # the health page must render even when the thing it checks is down
        body = r.json()
        assert body["dbConnected"] is False and body["counts"] is None


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
