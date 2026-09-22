"""A small in-memory stand-in for the supabase-py client, just capable enough for the tests.

It implements the query-builder calls the application uses (select / insert / update / delete,
eq / neq / gte / lte / in_, order, limit, range, single / maybe_single, count="exact", JSON-path
filters and PostgREST-style resource embedding) so business logic can be exercised without a
database. It is NOT a faithful PostgREST: unsupported calls raise AttributeError on purpose.

It also fakes the two database functions in migrations/002_confirm_and_approve_rpcs.sql
(confirm_receipt, approve_mapping) as plain Python, since there is no real Postgres to run the
SQL against in tests. Each is wrapped so that any exception restores a snapshot taken before it
ran, the same all-or-nothing guarantee Postgres gives a real transaction for free.
"""
import copy
import itertools
import re
import uuid
from collections import defaultdict
from types import SimpleNamespace

from postgrest.exceptions import APIError

# (parent table, embedded name) -> (kind, local key, child table, child key)
RELATIONS = {
    ("goods_receipts", "vendors"): ("many_to_one", "vendor_id", "vendors", "id"),
    ("goods_receipts", "gr_line_items"): ("one_to_many", "id", "gr_line_items", "gr_id"),
    ("gr_line_items", "materials"): ("many_to_one", "material_id", "materials", "id"),
}

UNIQUE = {
    "inventory": ("material_id", "location_code"),
    "materials": ("cnmc",),
    "matching_queue": ("new_material_id", "matched_material_id"),
}


def _split_top_level(cols: str) -> list[str]:
    parts, depth, cur = [], 0, ""
    for ch in cols:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            parts.append(cur.strip())
            cur = ""
        else:
            cur += ch
    if cur.strip():
        parts.append(cur.strip())
    return parts


class FakeSupabase:
    def __init__(self):
        self.tables: dict[str, list[dict]] = defaultdict(list)
        self._clock = itertools.count(1)
        self._gr_seq = itertools.count(1)
        self.failures: dict[tuple[str, str], Exception] = {}
        self.before_update = None  # optional hook(table, filters) to simulate concurrent writers
        self.calls: list[tuple[str, str]] = []
        self.storage = SimpleNamespace(from_=self._bucket)
        self.auth = SimpleNamespace(admin=SimpleNamespace(sign_out=lambda jwt: None))

    # -- test helpers -----------------------------------------------------------------
    def seed(self, table: str, **row) -> dict:
        row.setdefault("id", str(uuid.uuid4()))
        row.setdefault("created_at", f"2026-09-19T00:00:{next(self._clock):02d}+00:00")
        self.tables[table].append(row)
        return row

    def fail(self, table: str, op: str, exc: Exception | None = None):
        self.failures[(table, op)] = exc or RuntimeError(f"injected failure on {table}.{op}")

    def rows(self, table: str) -> list[dict]:
        return self.tables[table]

    def _bucket(self, name):
        return SimpleNamespace(
            upload=lambda **kw: None,
            create_signed_url=lambda path, ttl: {"signedURL": f"https://signed.example/{path}"},
        )

    def table(self, name: str) -> "FakeQuery":
        return FakeQuery(self, name)

    def rpc(self, name: str, params: dict | None = None) -> "FakeRpc":
        return FakeRpc(self, name, params or {})

    # -- fake database functions (migrations/002_confirm_and_approve_rpcs.sql) --------

    def _run_atomically(self, fn, *args):
        """Snapshot every table, run fn, and restore the snapshot if fn raises — the same
        all-or-nothing guarantee a real Postgres transaction gives confirm_receipt/approve_mapping
        for free."""
        snapshot = copy.deepcopy(dict(self.tables))
        try:
            return fn(*args)
        except Exception:
            self.tables.clear()
            self.tables.update(snapshot)
            raise

    @staticmethod
    def _raise(message: str, code: str = "P0001"):
        raise APIError({"message": message, "code": code, "details": "", "hint": None})

    def _receipt_result(self, gr: dict, already_confirmed: bool) -> dict:
        line_count = len([l for l in self.tables["gr_line_items"] if l.get("gr_id") == gr["id"]])
        return {
            "receipt_id": gr["id"], "gr_number": gr["gr_number"],
            "total_value": gr.get("total_value"), "line_items_created": line_count,
            "already_confirmed": already_confirmed,
        }

    def _confirm_receipt(self, payload: dict) -> dict:
        def run():
            received_by = payload.get("received_by")
            client_draft_id = payload.get("client_draft_id") or None
            line_items = payload.get("line_items") or []
            if not received_by:
                self._raise("VALIDATION: received_by is required")
            if not line_items:
                self._raise("VALIDATION: at least one line item is required")

            if client_draft_id:
                existing = next(
                    (r for r in self.tables["goods_receipts"]
                     if r.get("received_by") == received_by and r.get("client_draft_id") == client_draft_id),
                    None,
                )
                if existing:
                    return self._receipt_result(existing, already_confirmed=True)

            total_value = round(sum(float(l["quantity"]) * float(l["unit_price"]) for l in line_items), 2)
            gr = self.table("goods_receipts").insert({
                "vendor_id": payload.get("vendor_id"),
                "receipt_date": payload.get("receipt_date"),
                "po_number": payload.get("po_number"),
                "bill_image_url": payload.get("bill_image_path"),
                "received_by": received_by,
                "status": "completed",
                "total_value": total_value,
                "client_draft_id": client_draft_id,
            }).execute().data[0]

            for line in line_items:
                material_id = line.get("material_id")
                new_mat = line.get("new_material")

                if not material_id and new_mat:
                    cnmc = new_mat.get("cnmc")
                    suffix = 1
                    while True:
                        try:
                            mat = self.table("materials").insert({
                                "cnmc": cnmc, "status": "pending",
                                "category": new_mat.get("category") or "MISC",
                                "subcategory": new_mat.get("subcategory") or "GEN",
                                "material_type": new_mat.get("material_type") or "GEN",
                                "spec": new_mat.get("spec"),
                                "quality_grade": new_mat.get("quality_grade"),
                                "standard_description": new_mat.get("standard_description") or line.get("raw_description"),
                                "short_description": new_mat.get("short_description"),
                                "technical_specs": new_mat.get("technical_specs"),
                                "unit_of_measure": new_mat.get("unit_of_measure") or line.get("unit"),
                                "embedding": new_mat.get("embedding"),
                                "created_by": received_by,
                            }).execute().data[0]
                            material_id = mat["id"]
                            break
                        except APIError:
                            suffix += 1
                            cnmc = f"{new_mat.get('cnmc')}-{suffix}"

                    self.table("audit_log").insert({
                        "actor_id": received_by, "actor_role": payload.get("received_by_role"),
                        "action": "cnmc_generated", "entity_type": "materials", "entity_id": material_id,
                        "new_value": {"cnmc": cnmc},
                    }).execute()

                    cand = line.get("candidate_match")
                    if cand and cand.get("matched_material_id"):
                        try:
                            self.table("matching_queue").insert({
                                "new_material_id": material_id,
                                "matched_material_id": cand["matched_material_id"],
                                "match_type": cand.get("match_type"),
                                "confidence_score": cand.get("confidence_score"),
                                "vector_similarity": cand.get("vector_similarity"),
                                "match_reason": cand.get("match_reason"),
                                "status": "pending",
                            }).execute()
                        except APIError:
                            pass  # ON CONFLICT (new_material_id, matched_material_id) DO NOTHING

                if not material_id:
                    self._raise("VALIDATION: a line item has neither material_id nor new_material data")

                mat_row = next((m for m in self.tables["materials"] if m["id"] == material_id), None)
                if not mat_row or mat_row.get("status") == "deprecated":
                    self._raise("VALIDATION: the material for one of the line items no longer exists or has been deprecated")

                line_row = self.table("gr_line_items").insert({
                    "gr_id": gr["id"], "material_id": material_id,
                    "quantity_received": line["quantity"], "unit_of_measure": line["unit"],
                    "unit_price": line["unit_price"], "quality_grade": line.get("quality_grade"),
                    "quality_notes": line.get("quality_notes"), "location_code": line.get("location_code"),
                    "barcode": line.get("barcode"), "batch_number": line.get("batch_number"),
                    "expiry_date": line.get("expiry_date"), "raw_description": line.get("raw_description"),
                    "match_status": line.get("match_status"),
                    "total_price": line["quantity"] * line["unit_price"],
                }).execute().data[0]

                existing_inv = next(
                    (i for i in self.tables["inventory"]
                     if i["material_id"] == material_id and i["location_code"] == line["location_code"]),
                    None,
                )
                if existing_inv:
                    existing_inv["quantity"] = existing_inv.get("quantity", 0) + line["quantity"]
                else:
                    self.table("inventory").insert({
                        "material_id": material_id, "location_code": line["location_code"],
                        "quantity": line["quantity"],
                    }).execute()

                if line["unit_price"] > 0:
                    self.table("price_history").insert({
                        "material_id": material_id, "vendor_id": payload.get("vendor_id"),
                        "gr_line_item_id": line_row["id"], "unit_price": line["unit_price"],
                        "quantity": line["quantity"], "purchase_date": payload.get("receipt_date"),
                    }).execute()

            self.table("audit_log").insert({
                "actor_id": received_by, "actor_role": payload.get("received_by_role"),
                "action": "receipt_confirmed", "entity_type": "goods_receipts", "entity_id": gr["id"],
                "new_value": {"gr_number": gr["gr_number"]},
            }).execute()

            return self._receipt_result(gr, already_confirmed=False)

        return self._run_atomically(run)

    def _approve_mapping(self, params: dict) -> dict:
        def run():
            match_id = params.get("p_match_id")
            reviewer_id = params.get("p_reviewer_id")
            reviewer_role = params.get("p_reviewer_role")
            action = params.get("p_action")
            if action not in ("approve", "reject"):
                self._raise("VALIDATION: action must be approve or reject")

            match = next((m for m in self.tables["matching_queue"] if m["id"] == match_id), None)
            if not match:
                self._raise(f"NOT_FOUND: match {match_id} does not exist")
            if match.get("status") != "pending":
                self._raise(f"ALREADY_REVIEWED: this match was already reviewed (status: {match['status']})")

            new_status = "approved" if action == "approve" else "rejected"
            merged_qty, merged_bins = 0, 0

            if action == "approve":
                new_id, matched_id = match["new_material_id"], match["matched_material_id"]
                for inv in [i for i in self.tables["inventory"] if i["material_id"] == new_id]:
                    existing = next(
                        (i for i in self.tables["inventory"]
                         if i["material_id"] == matched_id and i["location_code"] == inv["location_code"]),
                        None,
                    )
                    if existing:
                        existing["quantity"] = existing.get("quantity", 0) + inv["quantity"]
                    else:
                        self.table("inventory").insert({
                            "material_id": matched_id, "location_code": inv["location_code"],
                            "quantity": inv["quantity"],
                        }).execute()
                    merged_qty += inv["quantity"]
                    merged_bins += 1
                self.tables["inventory"] = [i for i in self.tables["inventory"] if i["material_id"] != new_id]

                for row in self.tables["gr_line_items"]:
                    if row.get("material_id") == new_id:
                        row["material_id"] = matched_id
                for row in self.tables["price_history"]:
                    if row.get("material_id") == new_id:
                        row["material_id"] = matched_id

                existing_pairs = {
                    (r.get("source_system"), r.get("legacy_code"))
                    for r in self.tables["material_code_mappings"] if r.get("material_id") == matched_id
                }
                keep = []
                for row in self.tables["material_code_mappings"]:
                    if row.get("material_id") == new_id:
                        key = (row.get("source_system"), row.get("legacy_code"))
                        if key in existing_pairs:
                            continue  # duplicate of a mapping the survivor already has: dropped
                        row["material_id"] = matched_id
                        existing_pairs.add(key)
                    keep.append(row)
                self.tables["material_code_mappings"] = keep

                mat = next((m for m in self.tables["materials"] if m["id"] == new_id), None)
                survivor = next((m for m in self.tables["materials"] if m["id"] == matched_id), None)
                if mat:
                    mat["status"] = "deprecated"
                    mat["deprecated_by"] = reviewer_id
                    mat["deprecation_reason"] = (
                        f"Merged into {(survivor or {}).get('cnmc', matched_id)} via mapping approval"
                    )

                self.table("audit_log").insert({
                    "actor_id": reviewer_id, "actor_role": reviewer_role, "action": "materials_merged",
                    "entity_type": "materials", "entity_id": new_id,
                    "old_value": {"status": "pending"},
                    "new_value": {"status": "deprecated", "merged_into": matched_id,
                                  "inventory_bins_merged": merged_bins, "quantity_merged": merged_qty},
                }).execute()

            match["status"] = new_status
            match["reviewed_by"] = reviewer_id
            match["reviewed_at"] = f"2026-09-19T00:00:{next(self._clock):02d}+00:00"

            self.table("audit_log").insert({
                "actor_id": reviewer_id, "actor_role": reviewer_role,
                "action": "mapping_approved" if action == "approve" else "mapping_rejected",
                "entity_type": "matching_queue", "entity_id": match_id,
                "old_value": {"status": "pending"}, "new_value": {"status": new_status},
            }).execute()

            return {"status": new_status, "match_id": match_id,
                    "inventory_bins_merged": merged_bins, "quantity_merged": merged_qty}

        return self._run_atomically(run)


class FakeRpc:
    """Fakes supabase.rpc(name, params).execute(). Only the two functions this project defines
    (migrations/002_confirm_and_approve_rpcs.sql) are known; anything else raises AttributeError
    on purpose, same as an unsupported FakeQuery call."""

    _HANDLERS = {
        "confirm_receipt": lambda db, params: db._confirm_receipt(params.get("p_payload") or {}),
        "approve_mapping": lambda db, params: db._approve_mapping(params),
    }

    def __init__(self, db: FakeSupabase, name: str, params: dict):
        self.db, self.name, self.params = db, name, params

    def execute(self):
        self.db.calls.append((self.name, "rpc"))
        failure = self.db.failures.get((self.name, "rpc"))
        if failure:
            raise failure
        handler = self._HANDLERS.get(self.name)
        if handler is None:
            raise AttributeError(f"FakeSupabase.rpc: no fake for {self.name!r}")
        return SimpleNamespace(data=handler(self.db, self.params), count=None)


class FakeQuery:
    def __init__(self, db: FakeSupabase, table: str):
        self.db, self.name = db, table
        self.op = "select"
        self.cols = "*"
        self.payload = None
        self.filters: list[tuple] = []
        self.orders: list[tuple[str, bool]] = []
        self.count_mode = None
        self.limit_n = None
        self.range_ = None
        self.single_mode = None

    # -- builders ---------------------------------------------------------------------
    def select(self, *cols, count=None):
        self.op, self.cols, self.count_mode = "select", ",".join(cols) if cols else "*", count
        return self

    def insert(self, payload):
        self.op, self.payload = "insert", payload
        return self

    def update(self, payload):
        self.op, self.payload = "update", payload
        return self

    def delete(self):
        self.op = "delete"
        return self

    def eq(self, col, val):
        self.filters.append(("eq", col, val)); return self

    def neq(self, col, val):
        self.filters.append(("neq", col, val)); return self

    def gte(self, col, val):
        self.filters.append(("gte", col, val)); return self

    def lte(self, col, val):
        self.filters.append(("lte", col, val)); return self

    def in_(self, col, vals):
        self.filters.append(("in", col, list(vals))); return self

    def order(self, col, desc=False):
        self.orders.append((col, desc)); return self

    def limit(self, n):
        self.limit_n = n; return self

    def range(self, a, b):
        self.range_ = (a, b); return self

    def single(self):
        self.single_mode = "single"; return self

    def maybe_single(self):
        self.single_mode = "maybe"; return self

    # -- evaluation -------------------------------------------------------------------
    @staticmethod
    def _value(row, col):
        if "->>" in col:
            base, key = col.split("->>", 1)
            blob = row.get(base)
            return blob.get(key) if isinstance(blob, dict) else None
        return row.get(col)

    def _matches(self, row) -> bool:
        for kind, col, val in self.filters:
            v = self._value(row, col)
            if kind == "eq" and not (v == val or (v is not None and str(v) == str(val))):
                return False
            if kind == "neq" and v == val:
                return False
            if kind == "gte" and not (v is not None and str(v) >= str(val)):
                return False
            if kind == "lte" and not (v is not None and str(v) <= str(val)):
                return False
            if kind == "in" and v not in val:
                return False
        return True

    def _embed(self, table, rows, cols):
        tokens = [t for t in _split_top_level(cols) if re.match(r"^\w+\(.*\)$", t, re.S)]
        if not tokens:
            return [dict(r) for r in rows]
        out = []
        for r in rows:
            r = dict(r)
            for token in tokens:
                name, inner = re.match(r"^(\w+)\((.*)\)$", token, re.S).groups()
                kind, local, child_table, child_key = RELATIONS[(table, name)]
                related = [c for c in self.db.tables[child_table] if c.get(child_key) == r.get(local)]
                related = self._embed(child_table, related, inner)
                r[name] = related if kind == "one_to_many" else (related[0] if related else None)
            out.append(r)
        return out

    def _check_unique(self, row):
        cols = UNIQUE.get(self.name)
        if not cols or any(row.get(c) is None for c in cols):
            return
        for existing in self.db.tables[self.name]:
            if all(existing.get(c) == row.get(c) for c in cols):
                raise APIError({"message": f"duplicate key on {self.name}", "code": "23505",
                                "details": f"materials_cnmc_key" if self.name == "materials" else "", "hint": None})

    def execute(self):
        db = self.db
        db.calls.append((self.name, self.op))
        failure = db.failures.get((self.name, self.op))
        if failure:
            raise failure

        if self.op == "insert":
            rows = self.payload if isinstance(self.payload, list) else [self.payload]
            created = []
            for row in rows:
                row = dict(row)
                row.setdefault("id", str(uuid.uuid4()))
                row.setdefault("created_at", f"2026-09-19T00:00:{next(db._clock):02d}+00:00")
                if self.name == "goods_receipts":
                    row.setdefault("gr_number", f"GR-2026-{next(db._gr_seq):05d}")
                self._check_unique(row)
                db.tables[self.name].append(row)
                created.append(dict(row))
            return SimpleNamespace(data=created, count=None)

        if self.op == "update":
            if db.before_update:
                db.before_update(self.name, list(self.filters))
            hits = [r for r in db.tables[self.name] if self._matches(r)]
            for r in hits:
                r.update(self.payload)
            return SimpleNamespace(data=[dict(r) for r in hits], count=None)

        if self.op == "delete":
            hits = [r for r in db.tables[self.name] if self._matches(r)]
            db.tables[self.name] = [r for r in db.tables[self.name] if r not in hits]
            if self.name == "goods_receipts":  # ON DELETE CASCADE
                gone = {r["id"] for r in hits}
                db.tables["gr_line_items"] = [r for r in db.tables["gr_line_items"] if r.get("gr_id") not in gone]
            return SimpleNamespace(data=[dict(r) for r in hits], count=None)

        rows = [r for r in db.tables[self.name] if self._matches(r)]
        for col, desc in reversed(self.orders):
            rows.sort(key=lambda r: (r.get(col) is None, r.get(col)), reverse=desc)
        total = len(rows)
        if self.range_:
            rows = rows[self.range_[0]: self.range_[1] + 1]
        if self.limit_n is not None:
            rows = rows[: self.limit_n]
        rows = self._embed(self.name, rows, self.cols)

        if self.single_mode == "maybe":
            if not rows:
                return None
            if len(rows) > 1:
                raise APIError({"message": "multiple rows", "code": "PGRST116", "details": "", "hint": None})
            return SimpleNamespace(data=rows[0], count=total)
        if self.single_mode == "single":
            if len(rows) != 1:
                raise APIError({"message": "no rows", "code": "PGRST116", "details": "The result contains 0 rows", "hint": None})
            return SimpleNamespace(data=rows[0], count=total)
        return SimpleNamespace(data=rows, count=total if self.count_mode else None)
