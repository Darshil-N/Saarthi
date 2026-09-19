import logging
from typing import Any

from supabase import Client

logger = logging.getLogger(__name__)


def log_action(
    supabase: Client,
    actor_id: str,
    actor_role: str,
    action: str,
    entity_type: str,
    entity_id: str | None = None,
    old_value: Any = None,
    new_value: Any = None,
) -> None:
    """
    Write one row to audit_log. Fire-and-forget; errors are logged and swallowed
    so that a logging failure never aborts a business operation.
    """
    try:
        supabase.table("audit_log").insert({
            "actor_id": actor_id,
            "actor_role": actor_role,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "old_value": old_value,
            "new_value": new_value,
        }).execute()
    except Exception:
        logger.warning("Failed to write audit log entry %s for %s %s", action, entity_type, entity_id, exc_info=True)
