import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

sys.path.insert(0, os.path.dirname(__file__))
from config import settings
from supabase import create_client

sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

accounts = {
    "admin@bharatoil.in": "Demo@1234",
    "engineer@bharatoil.in": "Demo@1234",
    "accounts@bharatoil.in": "Demo@1234",
    "operator@bharatoil.in": "Demo@1234",
}

users = sb.auth.admin.list_users()
by_email = {u.email: u.id for u in users}

for email, pw in accounts.items():
    uid = by_email.get(email)
    if not uid:
        print(f"  [skip] no auth user for {email}")
        continue
    sb.auth.admin.update_user_by_id(uid, {"password": pw})
    print(f"  [set] {email} -> password updated")

print("DONE")
