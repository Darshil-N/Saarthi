import os, sys, random
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(__file__))
from config import settings
from supabase import create_client

sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
random.seed(42)

USERS = {
    "admin": "4eca0787-59b4-497c-b5d9-72c476ab3419",
    "engineer": "a7a0214d-c08f-44ba-ab03-f3922efa08f6",
    "accounts": "0d928861-a11e-4b50-9159-fee783cf475d",
    "operator": "0859fc0e-14b9-4c97-9f3c-ac2cd7e5bebb",
}

materials = sb.table("materials").select("id,cnmc,category,standard_description,status").execute().data
materials = [m for m in materials if m["status"] == "approved"]
vendors = sb.table("vendors").select("id,code,name").execute().data
locations = sb.table("locations").select("code,warehouse").execute().data
existing_inv = sb.table("inventory").select("material_id,location_code").execute().data
existing_inv_keys = {(r["material_id"], r["location_code"]) for r in existing_inv}
existing_ph = sb.table("price_history").select("material_id").execute().data
materials_with_price = {r["material_id"] for r in existing_ph}

locs_by_wh = {}
for l in locations:
    locs_by_wh.setdefault(l["warehouse"], []).append(l["code"])

cat_to_wh = {"MECH": "WHSE-A", "ELEC": "WHSE-B", "CHEM": "WHSE-C", "CONS": "WHSE-C", "CIVIL": "WHSE-A"}

def rand_date(days_back_max):
    d = datetime.now(timezone.utc) - timedelta(days=random.randint(1, days_back_max))
    return d

# ---- 1. Inventory for materials missing it ----
inv_payload = []
for m in materials:
    wh = cat_to_wh.get(m["category"], "WHSE-A")
    candidate_locs = [c for c in locs_by_wh.get(wh, []) if (m["id"], c) not in existing_inv_keys]
    if not candidate_locs:
        continue
    has_any = any(mid == m["id"] for mid, _ in existing_inv_keys)
    if has_any:
        continue
    loc = random.choice(candidate_locs)
    profile = random.choice(["healthy", "low", "overstock"])
    if profile == "healthy":
        qty, reorder, mx = random.randint(200, 800), 100, 1000
    elif profile == "low":
        qty, reorder, mx = random.randint(5, 40), 50, 500
    else:
        qty, reorder, mx = random.randint(900, 1500), 100, 1000
    inv_payload.append(dict(material_id=m["id"], location_code=loc, quantity=qty,
                            reserved_quantity=random.randint(0, min(20, qty)),
                            reorder_level=reorder, max_stock=mx))

if inv_payload:
    sb.table("inventory").upsert(inv_payload, on_conflict="material_id,location_code", ignore_duplicates=True).execute()
print(f"[inventory] added {len(inv_payload)} rows")

# ---- 2. Price history for materials missing it ----
ph_payload = []
for m in materials:
    if m["id"] in materials_with_price:
        continue
    chosen_vendors = random.sample(vendors, k=min(2, len(vendors)))
    base_price = round(random.uniform(20, 5000), 2)
    for i, v in enumerate(chosen_vendors):
        price = round(base_price * random.uniform(0.9, 1.15), 2)
        ph_payload.append(dict(
            material_id=m["id"], vendor_id=v["id"], unit_price=price,
            quantity=random.randint(10, 500),
            purchase_date=rand_date(200).date().isoformat(),
        ))

if ph_payload:
    sb.table("price_history").insert(ph_payload).execute()
print(f"[price_history] added {len(ph_payload)} rows")

# ---- 3. Historical goods receipts + line items ----
statuses = ["completed", "completed", "completed", "processing"]
gr_count = 0
li_count = 0
for _ in range(8):
    v = random.choice(vendors)
    user_key = random.choice(["operator", "admin"])
    receipt_date = rand_date(150).date().isoformat()
    gr_payload = {
        "vendor_id": v["id"],
        "receipt_date": receipt_date,
        "po_number": f"PO-2026-{random.randint(1000,9999)}",
        "received_by": USERS[user_key],
        "status": random.choice(statuses),
    }
    gr_resp = sb.table("goods_receipts").insert(gr_payload).execute()
    if not gr_resp.data:
        continue
    gr_id = gr_resp.data[0]["id"]
    gr_count += 1

    line_items = []
    for m in random.sample(materials, k=random.randint(2, 4)):
        qty = random.randint(5, 200)
        price = round(random.uniform(20, 5000), 2)
        line_items.append(dict(
            gr_id=gr_id, material_id=m["id"], quantity_received=qty,
            unit_of_measure="EA", unit_price=price,
            quality_grade=random.choice(["A", "A", "B"]),
            raw_description=m["standard_description"],
            match_status="exact_match",
        ))
    if line_items:
        sb.table("gr_line_items").insert(line_items).execute()
        li_count += len(line_items)

print(f"[goods_receipts] added {gr_count} receipts, {li_count} line items")

# ---- 4. Audit log entries ----
actions = [
    ("MATERIAL_APPROVED", "materials"), ("CNMC_GENERATED", "materials"),
    ("GR_CONFIRMED", "goods_receipts"), ("MAPPING_APPROVED", "matching_queue"),
    ("INVENTORY_UPDATED", "inventory"),
]
audit_payload = []
for _ in range(15):
    action, entity_type = random.choice(actions)
    user_key = random.choice(list(USERS.keys()))
    entity_id = random.choice(materials)["id"] if entity_type == "materials" else None
    if not entity_id:
        entity_id = random.choice(materials)["id"]  # fallback, any valid uuid works for display
    audit_payload.append(dict(
        actor_id=USERS[user_key], actor_role=user_key if user_key != "operator" else "entry_operator",
        action=action, entity_type=entity_type, entity_id=entity_id,
        new_value={"note": "demo seed"}, created_at=rand_date(90).isoformat(),
    ))
if audit_payload:
    sb.table("audit_log").insert(audit_payload).execute()
print(f"[audit_log] added {len(audit_payload)} rows")

# ---- 5. NL query log ----
queries = [
    ("Where are M8 bolts and how many do we have?", "SELECT * FROM v_inventory_full WHERE standard_description ILIKE '%M8%bolt%'", 3),
    ("Which materials are below reorder level?", "SELECT * FROM v_low_stock_alerts", 5),
    ("Show me all gate valves in stock", "SELECT * FROM v_inventory_full WHERE category='MECH' AND subcategory='VALVE'", 2),
    ("What's the total inventory value by category?", "SELECT * FROM get_inventory_value_by_category()", 4),
    ("List pending material approvals", "SELECT * FROM v_matching_queue_detailed WHERE status='pending'", 3),
]
nl_payload = []
for q, sql, n in queries:
    user_key = random.choice(["engineer", "admin"])
    nl_payload.append(dict(
        user_id=USERS[user_key], natural_language_query=q, generated_sql=sql,
        sql_explanation="Auto-generated SELECT query", query_result_count=n,
        execution_time_ms=random.randint(120, 900), was_successful=True,
        created_at=rand_date(60).isoformat(),
    ))
if nl_payload:
    sb.table("nl_query_log").insert(nl_payload).execute()
print(f"[nl_query_log] added {len(nl_payload)} rows")

print("DONE")
