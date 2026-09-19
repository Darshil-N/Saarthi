"""A small in-memory stand-in for the supabase-py client, just capable enough for the tests.

It implements the query-builder calls the application uses (select / insert / update / delete,
eq / neq / gte / lte / in_, order, limit, range, single / maybe_single, count="exact", JSON-path
filters and PostgREST-style resource embedding) so business logic can be exercised without a
database. It is NOT a faithful PostgREST: unsupported calls raise AttributeError on purpose.
"""
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
